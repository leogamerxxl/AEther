"""Deterministic weather-demand signal computer (real-data loop proof).

Second signal_type in the engine family: reads REAL weather observations
(macro_observations, Visual Crossing) and writes a unified `intelligence_object`
of type `weather_demand_outlook`, scoped to the pilot property. Math first: the
computer classifies each upcoming stay-date deterministically (beach-favorable
vs adverse) from temp/precip/wind; no LLM, no fabricated revenue impact, no
recommendation (Truth Doctrine - display the signal, do not invent a price move).
Idempotent upsert by (property_id, dedupe_key).

Usage: python signal_weather.py [--horizon 7] [--fresh-window-h 48] [--dry-run]
"""
import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.sb import SB, log_run, utcnow, iso  # noqa: E402
from lib.provenance import SOURCE_WEATHER, PROPERTY_TERRA, weather_confidence  # noqa: E402

ENGINE_VERSION = "signal_weather_v1"
HORIZON_DEFAULT = int(os.environ.get("SIGNALS_HORIZON", "7"))
FRESH_WINDOW_H = int(os.environ.get("SIGNALS_FRESH_WINDOW_H", "48"))

# Beach-favorability thresholds (Black Sea coast). Deterministic, not learned.
BEACH_TMAX_C = 26.0
BEACH_PRECIP_MAX = 30.0
BEACH_WIND_MAX = 35.0
ADVERSE_TMAX_C = 20.0
ADVERSE_PRECIP = 60.0


def load_weather(sb, horizon, fresh_window_h):
    today = utcnow().date()
    end = (today + timedelta(days=horizon)).isoformat()
    since = iso(utcnow() - timedelta(hours=fresh_window_h))
    rows = sb.select(
        "macro_observations",
        select="id,metric_code,effective_date,value_numeric,observed_at,source_id",
        source_id=f"eq.{SOURCE_WEATHER}",
        effective_date=f"gte.{today.isoformat()}",
        observed_at=f"gte.{since}",
        order="effective_date.asc,observed_at.desc",
        limit="2000",
    ) or []
    by = {}  # effective_date -> {metric_code -> newest row}
    for r in rows:
        if r["effective_date"] > end:
            continue
        by.setdefault(r["effective_date"], {}).setdefault(r["metric_code"], r)
    return by


def _num(row):
    return float(row["value_numeric"]) if row and row.get("value_numeric") is not None else None


def build_weather_objects(by_date, today_iso, now_iso, expires_iso):
    dates = sorted(d for d in by_date if d >= today_iso)
    classified, tmaxes, obs_ids = [], [], []
    observed_max = None
    for d in dates:
        m = by_date[d]
        tv = _num(m.get("temp_max_c"))
        if tv is None:
            continue
        pv = _num(m.get("precip_prob_pct"))
        wv = _num(m.get("wind_kmh"))
        tmaxes.append(tv)
        for row in m.values():
            if row.get("id"):
                obs_ids.append(row["id"])
            ts = row.get("observed_at")
            if ts and (observed_max is None or ts > observed_max):
                observed_max = ts
        fav = tv >= BEACH_TMAX_C and (pv is None or pv <= BEACH_PRECIP_MAX) and (wv is None or wv <= BEACH_WIND_MAX)
        adv = tv < ADVERSE_TMAX_C or (pv is not None and pv >= ADVERSE_PRECIP)
        classified.append({"date": d, "tmax_c": round(tv, 1), "precip_pct": pv, "wind_kmh": wv,
                           "class": "favorable" if fav else "adverse" if adv else "marginal"})
    n = len(classified)
    if n == 0:
        return []
    favorable = sum(1 for c in classified if c["class"] == "favorable")
    confs = [weather_confidence((date.fromisoformat(c["date"]) - date.fromisoformat(today_iso)).days)
             for c in classified]
    confidence = round(sum(confs) / n, 4)
    tmin, tmax = round(min(tmaxes)), round(max(tmaxes))
    severity = "low" if favorable >= 4 else "medium" if favorable == 0 else "info"
    d0, d1 = classified[0]["date"], classified[-1]["date"]
    causal = (f"Prognoză {d0[8:10]}.{d0[5:7]}-{d1[8:10]}.{d1[5:7]}: {favorable}/{n} zile favorabile "
              f"plajei (≥26°C, ≤30% precipitații, vânt ≤35 km/h). "
              f"Maxime {tmin}-{tmax}°C. Sursă Visual Crossing.")
    return [{
        "altitude_level": "property",
        "entity_type": "property",
        "entity_id": PROPERTY_TERRA,
        "property_id": PROPERTY_TERRA,
        "signal_type": "weather_demand_outlook",
        "severity": severity,
        "confidence": confidence,
        "evidence": [{"source_id": SOURCE_WEATHER, "observation_ids": obs_ids,
                      "observed_at": observed_max, "coverage": n}],
        "causal_hypothesis": causal,
        "forecast_impact": None,
        "recommended_actions": [],
        "visual_anchor": {"kind": "property", "label": "Hotel Terra Neptun", "property_id": PROPERTY_TERRA},
        "status": "active",
        "observed_at": now_iso,
        "expires_at": expires_iso,
        "dedupe_key": "weather_demand_outlook:7d",
        "engine_version": ENGINE_VERSION,
        "raw_jsonb": {"window_start": d0, "window_end": d1, "favorable_days": favorable,
                      "days": classified, "tmax_min_c": tmin, "tmax_max_c": tmax,
                      "thresholds": {"tmax_c": BEACH_TMAX_C, "precip_pct": BEACH_PRECIP_MAX,
                                     "wind_kmh": BEACH_WIND_MAX}},
    }]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--horizon", type=int, default=HORIZON_DEFAULT)
    ap.add_argument("--fresh-window-h", type=int, default=FRESH_WINDOW_H)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = utcnow()

    try:
        sb = SB()
    except Exception as e:  # noqa: BLE001
        print(f"[signal_weather] config error: {e}", file=sys.stderr)
        return 2

    try:
        by_date = load_weather(sb, args.horizon, args.fresh_window_h)
        today_iso = utcnow().date().isoformat()
        now_iso, expires_iso = iso(utcnow()), iso(utcnow() + timedelta(hours=24))
        objs = build_weather_objects(by_date, today_iso, now_iso, expires_iso)
        summary = {"horizon": args.horizon, "days": len(by_date), "objects": len(objs),
                   "favorable_days": (objs[0]["raw_jsonb"]["favorable_days"] if objs else 0),
                   "severity": (objs[0]["severity"] if objs else None)}
        if args.dry_run:
            print(json.dumps({"dry_run": True, **summary}, default=str, indent=2))
            return 0
        if objs:
            sb.upsert("intelligence_objects", objs, on_conflict="property_id,dedupe_key")
        status = "ok" if objs else "degraded"
        log_run(sb, "signal_weather", status, {"horizon": args.horizon}, summary, started,
                error=(None if objs else "no fresh weather observations in window"))
        print(json.dumps({"status": status, **summary}, default=str))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, "signal_weather", "failed", {"horizon": args.horizon}, {}, started, error=e)
        print(f"[signal_weather] FAILED: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())