"""Pure tests for the outcome verdict (no DB). Run: python test_outcome_engine.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from outcome_engine import judge  # noqa: E402


def run():
    failed = 0
    cases = [
        # baseline_cmp, observed_cmp, expected
        (0.68, 0.71, "supported"),      # pressure rose -> hold/raise validated
        (0.68, 0.60, "supported"),      # held within tolerance above floor
        (0.68, 0.45, "inconclusive"),   # softened below floor but not collapsed
        (0.68, 0.30, "contradicted"),   # market opened up sharply
        (0.52, 0.50, "supported"),      # floor edge holds
    ]
    for b, o, exp in cases:
        v, d = judge({"compression": b}, {"compression": o})
        if v != exp:
            failed += 1
            print(f"  FAIL {b}->{o}: got {v}, want {exp}")
        else:
            print(f"  ok {b}->{o} = {v} (delta {d['compression_delta']})")
    print(f"  {len(cases) - failed}/{len(cases)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(run())