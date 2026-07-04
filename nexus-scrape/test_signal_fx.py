"""Pure tests for the FX affordability signal. Run: python test_signal_fx.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from signal_fx import build_fx_object  # noqa: E402


def _row(i, v):
    return {"id": f"fx-{i}", "value_numeric": v, "observed_at": f"2026-07-{i:02d}T12:00:00+00:00"}


def run():
    failed = 0
    # stable: latest 5.246 vs mean(5.24, 5.238) -> tiny shift -> info, no recs
    o = build_fx_object([_row(4, 5.246), _row(3, 5.24), _row(2, 5.238)], "N", "E")[0]
    ok1 = o["severity"] == "info" and o["recommended_actions"] == [] and abs(o["raw_jsonb"]["shift_pct"]) < 0.5
    print(("  ok" if ok1 else "  FAIL") + f" stable: shift={o['raw_jsonb']['shift_pct']}% sev={o['severity']}")
    failed += 0 if ok1 else 1
    # sharp weakening of RON (EUR up 2%) -> medium
    o2 = build_fx_object([_row(4, 5.36), _row(3, 5.25), _row(2, 5.25)], "N", "E")[0]
    ok2 = o2["severity"] == "medium" and "ieftine" in o2["causal_hypothesis"]
    print(("  ok" if ok2 else "  FAIL") + f" sharp: shift={o2['raw_jsonb']['shift_pct']}% sev={o2['severity']}")
    failed += 0 if ok2 else 1
    # insufficient history -> honest empty
    ok3 = build_fx_object([_row(1, 5.24)], "N", "E") == []
    print(("  ok" if ok3 else "  FAIL") + " single point -> no object")
    failed += 0 if ok3 else 1
    print(f"  {3 - failed}/3 passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(run())