"""OWM weather collector -> macro_observations (7 target days x 4 metrics). Plan s4.

Real mode: One Call 3.0 with OWM_API_KEY; coords from properties.lat/lng
(Terra), env WEATHER_LAT/WEATHER_LNG fallback. Fixture mode: --fixture (days may
carry "date" ISO field instead of epoch "dt"). Idempotent per
(metric, effective_date) per observation day: same-day re-runs patch values.
Usage: python collectors/weather.py [--dry-run] [--fixture PATH]
"""
import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import provenance as pv
from lib.sb import SB, SBError, iso, log_run, ssl_context, today_start_iso, utcnow

AGENT = "collector.weather"
OWM_URL = ("https://api.openweathermap.org/data/3.0/onecall"
           "?lat={lat}&lon={lon}&units=metric&exclude=minutely,hourly,alerts,current&appid={key}")
DEFAULT_LAT, DEFAULT_LNG = 43.8167, 28.6000  # Neptun fallback

METRICS = (
    ("temp_max_c", lambda d: round(float(d["temp"]["max"]), 1), "C"),
    ("precip_prob_pct", lambda d: round(float(d.get("pop", 0)) * 100), "%"),
    ("wind_kmh", lambda d: round(float(d["wind_speed"]) * 3.6, 1), "km/h"),
    ("humidity_pct", lambda d: float(d["humidity"]), "%"),
)


def fetch(fixture, lat, lng):
    if fixture:
        return json.loads(Path(fixture).read_text(encoding="utf-8"))
    key = os.environ["OWM_API_KEY"]
    with urllib.request.urlopen(OWM_URL.format(lat=lat, lon=lng, key=key), timeout=60, context=ssl_context()) as r:
        return json.loads(r.read().decode())


def day_date(day):
    if "date" in day:
        return datetime.strptime(day["date"], "%Y-%m-%d").date()
    return datetime.fromtimestamp(int(day["dt"]), tz=timezone.utc).date()


def build_rows(data, now_iso):
    today = utcnow().date()
    rows = []
    for day in (data.get("daily") or [])[:7]:
        eff = day_date(day)
        ahead = (eff - today).days
        if ahead < 0:
            continue
        for code, fn, unit in METRICS:
            try:
                val = fn(day)
            except (KeyError, TypeError, ValueError):
                continue
            rows.append({
                "category_id": pv.CAT_CLIMATE, "source_id": pv.SOURCE_OWM,
                "country_id": pv.COUNTRY_RO, "region_id": pv.REGION_COAST,
                "observed_at": now_iso, "effective_date": eff.isoformat(),
                "metric_code": code, "value_numeric": val, "unit": unit,
                "confidence": pv.weather_confidence(ahead),
                "metadata_jsonb": {"days_ahead": ahead},
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
    inp = {"lat": lat, "lng": lng, "simulated": bool(a.fixture)}

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
            raise ValueError("no forecast days parsed (fixture dates in the past?)")
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
                             source_id=f"eq.{pv.SOURCE_OWM}",
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