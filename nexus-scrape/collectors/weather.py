"""Visual Crossing weather collector -> macro_observations (7 days x 4 metrics).

Replaces OpenWeatherMap: free tier (no card), metric units need no conversion.
Coords from properties.lat/lng (Terra); WEATHER_LAT/WEATHER_LNG env fallback.
Idempotent per (metric, effective_date) per observation day.
Usage: python collectors/weather.py [--dry-run] [--fixture PATH]
"""
import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import provenance as pv
from lib.sb import SB, SBError, iso, log_run, ssl_context, today_start_iso, utcnow

AGENT = "collector.weather"
VC_URL = ("https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/"
          "{lat},{lng}?unitGroup=metric&include=days"
          "&elements=datetime,tempmax,precipprob,windspeed,humidity&key={key}&contentType=json")
DEFAULT_LAT, DEFAULT_LNG = 43.8167, 28.6000  # Neptun fallback

METRICS = (
    ("temp_max_c", "tempmax", "C"),
    ("precip_prob_pct", "precipprob", "%"),
    ("wind_kmh", "windspeed", "km/h"),
    ("humidity_pct", "humidity", "%"),
)


def fetch(fixture, lat, lng):
    if fixture:
        return json.loads(Path(fixture).read_text(encoding="utf-8"))
    key = os.environ["VISUALCROSSING_API_KEY"]
    url = VC_URL.format(lat=lat, lng=lng, key=key)
    req = urllib.request.Request(url, headers={"User-Agent": "AetherCollector/1.0"})
    with urllib.request.urlopen(req, timeout=60, context=ssl_context()) as r:
        return json.loads(r.read().decode())


def build_rows(data, now_iso):
    today = utcnow().date()
    rows = []
    for day in (data.get("days") or [])[:7]:
        try:
            eff = datetime.strptime(day["datetime"], "%Y-%m-%d").date()
        except (KeyError, ValueError):
            continue
        ahead = (eff - today).days
        if ahead < 0:
            continue
        for code, vc_key, unit in METRICS:
            val = day.get(vc_key)
            if val is None:
                continue
            rows.append({
                "category_id": pv.CAT_CLIMATE, "source_id": pv.SOURCE_WEATHER,
                "country_id": pv.COUNTRY_RO, "region_id": pv.REGION_COAST,
                "observed_at": now_iso, "effective_date": eff.isoformat(),
                "metric_code": code, "value_numeric": round(float(val), 1), "unit": unit,
                "confidence": pv.weather_confidence(ahead),
                "metadata_jsonb": {"days_ahead": ahead, "provider": "visualcrossing"},
                "raw_jsonb": day,
            })
    return rows


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fixture")
    a = ap.parse_args(argv)
    started = utcnow()
    lat = float(os.environ.get("WEATHER_LAT", DEFAULT_LAT))
    lng = float(os.environ.get("WEATHER_LNG", DEFAULT_LNG))
    inp = {"lat": lat, "lng": lng, "simulated": bool(a.fixture), "provider": "visualcrossing"}

    sb = None
    if not a.dry_run:
        try:
            sb = SB()
            prop = sb.select("properties", select="lat,lng", id=f"eq.{pv.PROPERTY_TERRA}", limit=1)
            if prop and prop[0].get("lat") and prop[0].get("lng"):
                lat, lng = float(prop[0]["lat"]), float(prop[0]["lng"])
                inp.update({"lat": lat, "lng": lng, "coords_from": "properties"})
        except SBError as e:
            print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
            return 2

    try:
        data = fetch(a.fixture, lat, lng)
        rows = build_rows(data, iso(utcnow()))
        if not rows:
            raise ValueError("no forecast days parsed")
    except Exception as e:  # noqa: BLE001
        if sb:
            log_run(sb, AGENT, "failed", inp, {}, started, error=e)
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2

    summary = {"simulated": bool(a.fixture), "rows": len(rows), "inserted": 0, "patched": 0,
               "days": sorted({r["effective_date"] for r in rows}),
               "sample": [{k: rows[0][k] for k in ("metric_code", "effective_date", "value_numeric", "confidence")}] if rows else []}

    if a.dry_run:
        preview = [{k: r[k] for k in ("metric_code", "effective_date", "value_numeric", "unit", "confidence")} for r in rows[:8]]
        print(json.dumps({"agent": AGENT, "dry_run": True, **summary, "preview": preview}, indent=2))
        return 0

    try:
        existing = sb.select("macro_observations", select="id,metric_code,effective_date",
                             source_id=f"eq.{pv.SOURCE_WEATHER}",
                             observed_at=f"gte.{today_start_iso()}")
        emap = {f"{e['metric_code']}|{e['effective_date']}": e["id"] for e in (existing or [])}
        for r in rows:
            k = f"{r['metric_code']}|{r['effective_date']}"
            if k in emap:
                sb.patch("macro_observations", {"id": f"eq.{emap[k]}"},
                         {"value_numeric": r["value_numeric"], "confidence": r["confidence"],
                          "observed_at": r["observed_at"], "raw_jsonb": r["raw_jsonb"]})
                summary["patched"] += 1
            else:
                sb.insert("macro_observations", [r])
                summary["inserted"] += 1
        log_run(sb, AGENT, "succeeded", inp, summary, started)
        print(json.dumps({"agent": AGENT, "status": "succeeded", **summary}, indent=2))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, AGENT, "failed", inp, summary, started, error=e)
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())