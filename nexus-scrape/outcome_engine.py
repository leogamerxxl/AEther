"""Outcome engine - answers the 8th question: did the action work?

For each ACCEPTED decision (io_actions) with no outcome yet, once POST-decision
observations exist for the same stay-date, compare the market state now against
the state frozen at decision time (action_snapshot.basis) and record a
deterministic verdict:
  supported     - the pressure held (>= max(0.5, baseline-0.10)): hold/raise was right
  contradicted  - the market opened up sharply (compression < 0.35)
  inconclusive  - anything in between; measured again on later runs? No - one
                  verdict per action (unique) at first measurable moment.
No forecast, no LLM, no invented deltas - trajectory comparison only.

Usage: python outcome_engine.py [--dry-run]
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.sb import SB, log_run, utcnow, iso  # noqa: E402

ENGINE_VERSION = "outcome_engine_v1"
SUPPORT_FLOOR = 0.5
SUPPORT_TOLERANCE = 0.10
CONTRADICT_BELOW = 0.35


def judge(baseline: dict, observed: dict) -> tuple[str, dict]:
    """Deterministic verdict from decision-time basis vs current market state."""
    b = float(baseline.get("compression") or 0)
    o = float(observed.get("compression") or 0)
    delta = round(o - b, 4)
    if o >= max(SUPPORT_FLOOR, b - SUPPORT_TOLERANCE):
        verdict = "supported"
    elif o < CONTRADICT_BELOW:
        verdict = "contradicted"
    else:
        verdict = "inconclusive"
    return verdict, {"compression_delta": delta}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = utcnow()
    try:
        sb = SB()
    except Exception as e:  # noqa: BLE001
        print(f"[outcome_engine] config error: {e}", file=sys.stderr)
        return 2

    try:
        actions = sb.select("io_actions",
                            select="id,io_id,property_id,decision,decided_at,action_snapshot") or []
        done = {o["action_id"] for o in (sb.select("outcomes", select="action_id") or [])}
        pending = [a for a in actions if a["id"] not in done and a["decision"] == "accepted"]
        results = []
        for a in pending:
            ios = sb.select("intelligence_objects",
                            select="id,observed_at,raw_jsonb,evidence",
                            id=f"eq.{a['io_id']}", limit="1") or []
            if not ios:
                continue
            io = ios[0]
            # only judge on evidence NEWER than the decision (post-decision market state)
            if str(io["observed_at"]) <= str(a["decided_at"]):
                continue
            baseline = (a.get("action_snapshot") or {}).get("basis") or {}
            raw = io.get("raw_jsonb") or {}
            observed = {"compression": raw.get("compression"), "soldout": raw.get("soldout_count"),
                        "observed": raw.get("observed"), "median_adr_ron": raw.get("median_adr_ron")}
            if not baseline or observed["compression"] is None:
                continue
            verdict, delta = judge(baseline, observed)
            ev = [oid for e in (io.get("evidence") or []) for oid in (e.get("observation_ids") or [])]
            results.append({
                "action_id": a["id"], "io_id": a["io_id"], "property_id": a["property_id"],
                "org_id": "00000000-0000-0000-0000-000000000000",  # overwritten by trg_out_org
                "kind": "market_validation", "measured_at": iso(utcnow()),
                "baseline": baseline, "observed": observed, "delta": delta,
                "verdict": verdict, "evidence_ids": ev, "engine_version": ENGINE_VERSION,
            })
        summary = {"pending": len(pending), "measured": len(results),
                   "verdicts": [r["verdict"] for r in results]}
        if args.dry_run:
            print(json.dumps({"dry_run": True, **summary}, default=str, indent=2))
            return 0
        if results:
            sb.insert("outcomes", results)
        status = "ok" if results or not pending else "degraded"
        log_run(sb, "outcome_engine", status, {}, summary, started,
                error=(None if results or not pending else "pending actions lack post-decision evidence"))
        print(json.dumps({"status": status, **summary}, default=str))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, "outcome_engine", "failed", {}, {}, started, error=e)
        print(f"[outcome_engine] FAILED: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())