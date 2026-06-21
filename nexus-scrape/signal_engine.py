"""Deterministic signal engine (Phase 1 keystone).

Reads world-model observations (rate_observations + macro_observations) and writes
unified `intelligence_objects`. Math first: the engine computes the numbers; an LLM
may later enrich `causal_hypothesis` but never invents them. No recommendation is
emitted on thin data (Truth Doctrine). Idempotent upsert by (property_id, dedupe_key).

v1 signal: `market_rate_pressure` -- per upcoming stay-date, the comp-set median ADR,
coverage and dispersion, with full evidence (observation ids) and honest confidence.

Usage: python signal_engine.py [--horizon 7] [--fresh-window-h 48] [--dry-run]
"""
import argparse
import json
import os
import statistics
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.sb import SB, log_run, utcnow, iso  # noqa: E402
from lib.provenance import SOURCE_APIFY, PROPERTY_TERRA, rate_confidence  # noqa: E402

COMP_SET_TERRA = "497f9665-d8bc-4e0a-ba01-6dda25c2d9b7"
COMP_SET_SIZE = 12
ENGINE_VERSION = "signal_engine_v1"
HORIZON_DEFAULT = int(os.environ.get("SIGNALS_HORIZON", "7"))
MIN_COVERAGE = int(os.environ.get("MIN_RATE_COVERAGE", "10"))
FRESH_WINDOW_H = int(os.environ.get("SIGNALS_FRESH_WINDOW_H", "48"))
RON_CODES = {"RON", "LEI", "lei", "ron", None, ""}


def _to_ron(amount, code, fx_eur_ron):
    """Native currency stored; convert to RON only here for comparison (Principiu 7)."""
    if amount is None:
        return None
    if code in RON_CODES:
        return float(amount)
    if code == "EUR" and fx_eur_ron:
        return float(amount) * float(fx_eur_ron)
    return None  # unknown currency -> excluded honestly, never guessed


def latest_fx(sb):
    rows = sb.select("macro_observations", select="value_numeric,observed_at",
                     metric_code="eq.fx_eur_ron", order="observed_at.desc", limit="1")
    return rows[0]["value_numeric"] if rows else None


def load_latest_rates(sb, horizon, fresh_window_h):
    today = utcnow().date()
    end = (today + timedelta(days=horizon)).isoformat()
    since = iso(utcnow() - timedelta(hours=fresh_window_h))
    rows = sb.select(
        "rate_observations",
        select=("id,scraped_property_id,stay_date,rate_amount,currency_code,room_type,"
                "availability_state,rooms_remaining,observed_at"),
        stay_date=f"gte.{today.isoformat()}",
        observed_at=f"gte.{since}",
        order="stay_date.asc,observed_at.desc",
        limit="5000",
    ) or []
    latest = {}  # (property, stay_date) -> newest row (rows arrive observed_at desc)
    for r in rows:
        if r["stay_date"] > end:
            continue
        latest.setdefault((r["scraped_property_id"], r["stay_date"]), r)
    return list(latest.values())


def build_objects(latest_rows, fx, now_iso, expires_iso):
    by_date = {}
    for r in latest_rows:
        ron = _to_ron(r.get("rate_amount"), r.get("currency_code"), fx)
        if ron is None:
            continue
        by_date.setdefault(r["stay_date"], []).append((ron, r))

    objs = []
    for stay_date in sorted(by_date):
        items = by_date[stay_date]
        adrs = [a for a, _ in items]
        rows = [r for _, r in items]
        coverage = len(rows)
        med = round(statistics.median(adrs), 2)
        lo, hi = round(min(adrs), 2), round(max(adrs), 2)
        quality = sum(rate_confidence(r) for r in rows) / coverage
        coverage_factor = min(1.0, coverage / COMP_SET_SIZE)
        confidence = round(quality * coverage_factor, 4)
        disp_pct = round((hi - lo) / med * 100, 1) if med else 0.0
        thin = coverage < MIN_COVERAGE

        causal = (f"Median comp-set pentru {stay_date}: {med} RON pe {coverage}/{COMP_SET_SIZE} "
                  f"hoteluri. Interval {lo}-{hi} RON (dispersie {disp_pct}%).")
        if thin:
            causal += f" Acoperire sub prag ({coverage}/{MIN_COVERAGE}) - fara recomandare."

        objs.append({
            "altitude_level": "market",
            "entity_type": "competitive_set",
            "entity_id": COMP_SET_TERRA,
            "property_id": PROPERTY_TERRA,
            "signal_type": "market_rate_pressure",
            "severity": "info" if thin else "low",
            "confidence": confidence,
            "evidence": [{
                "source_id": SOURCE_APIFY,
                "observation_ids": [r["id"] for r in rows],
                "observed_at": max(r["observed_at"] for r in rows),
                "coverage": coverage,
            }],
            "causal_hypothesis": causal,
            "forecast_impact": None,
            "recommended_actions": [],
            "visual_anchor": {"kind": "market", "label": "Comp-set litoral",
                              "property_id": PROPERTY_TERRA},
            "status": "active",
            "observed_at": now_iso,
            "expires_at": expires_iso,
            "dedupe_key": f"market_rate_pressure:{stay_date}",
            "engine_version": ENGINE_VERSION,
            "raw_jsonb": {"stay_date": stay_date, "median_adr_ron": med, "min_adr_ron": lo,
                          "max_adr_ron": hi, "coverage": coverage, "dispersion_pct": disp_pct,
                          "currency": "RON"},
        })
    return objs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--horizon", type=int, default=HORIZON_DEFAULT)
    ap.add_argument("--fresh-window-h", type=int, default=FRESH_WINDOW_H)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fixture", type=str, default=None,
                    help="run build_objects against a JSON file of rate rows (no DB, no secrets)")
    args = ap.parse_args()
    started = utcnow()

    if args.fixture:
        rows = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
        fx = float(os.environ.get("FIXTURE_FX_EUR_RON", "5.0"))
        now_iso, expires_iso = iso(utcnow()), iso(utcnow() + timedelta(hours=24))
        objs = build_objects(rows, fx, now_iso, expires_iso)
        print(json.dumps({
            "fixture": args.fixture, "rate_rows": len(rows), "objects": len(objs),
            "stay_dates": [o["dedupe_key"].split(":", 1)[1] for o in objs],
            "coverage": {o["dedupe_key"].split(":", 1)[1]: o["raw_jsonb"]["coverage"] for o in objs},
        }, default=str, indent=2))
        return 0

    try:
        sb = SB()
    except Exception as e:  # noqa: BLE001
        print(f"[signal_engine] config error: {e}", file=sys.stderr)
        return 2

    try:
        fx = latest_fx(sb)
        latest_rows = load_latest_rates(sb, args.horizon, args.fresh_window_h)
        now_iso, expires_iso = iso(utcnow()), iso(utcnow() + timedelta(hours=24))
        objs = build_objects(latest_rows, fx, now_iso, expires_iso)
        summary = {
            "horizon": args.horizon, "fresh_window_h": args.fresh_window_h,
            "rate_rows": len(latest_rows), "objects": len(objs),
            "stay_dates": [o["dedupe_key"].split(":", 1)[1] for o in objs],
        }
        if args.dry_run:
            print(json.dumps({"dry_run": True, **summary}, default=str, indent=2))
            return 0
        if objs:
            sb.upsert("intelligence_objects", objs, on_conflict="property_id,dedupe_key")
        status = "ok" if objs else "degraded"
        log_run(sb, "signal_engine", status, {"horizon": args.horizon}, summary, started,
                error=(None if objs else "no upcoming rate observations in fresh window"))
        print(json.dumps({"status": status, **summary}, default=str))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, "signal_engine", "failed", {"horizon": args.horizon}, {}, started, error=e)
        print(f"[signal_engine] FAILED: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())