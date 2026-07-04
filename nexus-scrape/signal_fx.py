"""FX affordability signal - eurozone tourists'' purchasing power on the coast.

Compares the latest BNR EUR/RON against the trailing 30-day mean already in
macro_observations. Weak EUR (RON strengthening) = coastal stays get pricier
for the euro guest; strong EUR = cheaper. Deterministic, evidence = the macro
observation ids used. Info-severity unless the shift is sharp.

Usage: python signal_fx.py [--dry-run]
"""
import argparse
import json
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.sb import SB, log_run, utcnow, iso  # noqa: E402
from lib.provenance import SOURCE_BNR, PROPERTY_TERRA, FX_CONFIDENCE  # noqa: E402

ENGINE_VERSION = "signal_fx_v1"
SHARP_SHIFT_PCT = 1.5
BASELINE_DAYS = 30


def build_fx_object(rows, now_iso, expires_iso):
    """rows: [{id, value_numeric, observed_at}] newest first. Returns [] if <2 points."""
    if len(rows) < 2:
        return []
    latest = float(rows[0]["value_numeric"])
    base_vals = [float(r["value_numeric"]) for r in rows[1:]]
    baseline = sum(base_vals) / len(base_vals)
    shift_pct = round((latest - baseline) / baseline * 100, 2)
    sharp = abs(shift_pct) >= SHARP_SHIFT_PCT
    if shift_pct > 0.1:
        direction = "in crestere - sejururile devin mai ieftine pentru turistii din zona euro"
    elif shift_pct < -0.1:
        direction = "in scadere - sejururile devin mai scumpe pentru turistii din zona euro"
    else:
        direction = "stabil - puterea de cumparare a turistilor din zona euro neschimbata"
    causal = (f"EUR/RON {latest:.4f} vs media pe {len(base_vals)} zile {baseline:.4f} "
              f"({'+' if shift_pct >= 0 else ''}{shift_pct}%). Curs {direction}.")
    return [{
        "altitude_level": "country",
        "entity_type": "market",
        "entity_id": None,
        "property_id": PROPERTY_TERRA,
        "signal_type": "fx_affordability_shift",
        "severity": "medium" if sharp else "info",
        "confidence": round(FX_CONFIDENCE * 0.9, 4),
        "evidence": [{"source_id": SOURCE_BNR,
                      "observation_ids": [r["id"] for r in rows],
                      "observed_at": str(rows[0]["observed_at"]),
                      "coverage": len(rows)}],
        "causal_hypothesis": causal,
        "forecast_impact": None,
        "recommended_actions": [],
        "visual_anchor": {"kind": "country", "label": "Romania", "property_id": PROPERTY_TERRA},
        "status": "active",
        "observed_at": now_iso,
        "expires_at": expires_iso,
        "dedupe_key": "fx_affordability_shift:current",
        "engine_version": ENGINE_VERSION,
        "raw_jsonb": {"latest": latest, "baseline_mean": round(baseline, 4),
                      "baseline_days": len(base_vals), "shift_pct": shift_pct, "pair": "EUR/RON"},
    }]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = utcnow()
    try:
        sb = SB()
    except Exception as e:  # noqa: BLE001
        print(f"[signal_fx] config error: {e}", file=sys.stderr)
        return 2
    try:
        since = iso(utcnow() - timedelta(days=BASELINE_DAYS))
        rows = sb.select("macro_observations", select="id,value_numeric,observed_at",
                         metric_code="eq.fx_eur_ron", observed_at=f"gte.{since}",
                         order="observed_at.desc", limit="60") or []
        now_iso, expires_iso = iso(utcnow()), iso(utcnow() + timedelta(hours=26))
        objs = build_fx_object(rows, now_iso, expires_iso)
        summary = {"fx_points": len(rows), "objects": len(objs),
                   "shift_pct": (objs[0]["raw_jsonb"]["shift_pct"] if objs else None)}
        if args.dry_run:
            print(json.dumps({"dry_run": True, **summary}, default=str, indent=2))
            return 0
        if objs:
            sb.upsert("intelligence_objects", objs, on_conflict="property_id,dedupe_key")
        status = "ok" if objs else "degraded"
        log_run(sb, "signal_fx", status, {}, summary, started,
                error=(None if objs else "insufficient fx history"))
        print(json.dumps({"status": status, **summary}, default=str))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, "signal_fx", "failed", {}, {}, started, error=e)
        print(f"[signal_fx] FAILED: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())