"""Pure-function tests for the signal engine (no DB, no secrets).
Run: python test_signal_engine.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from signal_engine import build_objects, _to_ron, COMP_SET_TERRA  # noqa: E402


def _rate(pid, sd, amt, code="RON"):
    return {"id": f"obs-{pid}-{sd}", "scraped_property_id": pid, "stay_date": sd,
            "rate_amount": amt, "currency_code": code, "room_type": "double",
            "availability_state": "available", "rooms_remaining": 3,
            "observed_at": "2026-06-12T20:00:00+00:00"}


def test_currency():
    assert _to_ron(100, "RON", None) == 100.0
    assert _to_ron(100, "EUR", 5.0) == 500.0
    assert _to_ron(100, "USD", 5.0) is None      # unknown -> excluded, never guessed
    assert _to_ron(None, "RON", None) is None
    print("  ok currency (RON/EUR/unknown/none)")


def test_thin_coverage_no_recommendation():
    rows = [_rate("p1", "2026-06-20", 400), _rate("p2", "2026-06-20", 460),
            _rate("p3", "2026-06-20", 520)]
    objs = build_objects(rows, fx=5.0, now_iso="N", expires_iso="E")
    assert len(objs) == 1
    o = objs[0]
    assert o["raw_jsonb"]["median_adr_ron"] == 460.0
    assert o["raw_jsonb"]["coverage"] == 3
    assert o["severity"] == "info"               # 3 < MIN_COVERAGE
    assert o["recommended_actions"] == []        # Truth Doctrine: no rec on thin data
    assert o["forecast_impact"] is None
    assert o["dedupe_key"] == "market_rate_pressure:2026-06-20"
    assert o["entity_id"] == COMP_SET_TERRA
    assert len(o["evidence"][0]["observation_ids"]) == 3
    assert 0 < o["confidence"] <= 1
    assert o["confidence"] < 0.85                 # low coverage depresses confidence
    print(f"  ok thin coverage: median={o['raw_jsonb']['median_adr_ron']} "
          f"conf={o['confidence']} sev={o['severity']}")


def test_grouping_and_threshold():
    rows = [_rate(f"p{i}", "2026-06-21", 400 + i * 10) for i in range(11)]
    rows.append(_rate("p0", "2026-06-22", 300))
    objs = build_objects(rows, fx=5.0, now_iso="N", expires_iso="E")
    by = {o["dedupe_key"]: o for o in objs}
    assert set(by) == {"market_rate_pressure:2026-06-21", "market_rate_pressure:2026-06-22"}
    big = by["market_rate_pressure:2026-06-21"]
    assert big["raw_jsonb"]["coverage"] == 11
    assert big["severity"] == "low"              # coverage >= MIN_COVERAGE
    print("  ok grouping + severity threshold (11 -> low, 1 -> info)")


def test_fixture_file():
    import json as _json
    p = Path(__file__).resolve().parent / "fixtures" / "rates_sample.json"
    rows = _json.loads(p.read_text(encoding="utf-8"))
    objs = build_objects(rows, fx=5.0, now_iso="N", expires_iso="E")
    by = {o["dedupe_key"]: o for o in objs}
    full = by["market_rate_pressure:2026-07-01"]
    assert full["raw_jsonb"]["coverage"] == 12        # 11 RON + 1 EUR converted
    assert full["severity"] == "low"                  # full coverage -> graded
    thin = by["market_rate_pressure:2026-07-02"]
    assert thin["severity"] == "info"                 # 4 < MIN_COVERAGE
    assert thin["recommended_actions"] == []          # Truth Doctrine on thin data
    print(f"  ok fixture file: {len(objs)} objects, 07-01 cov={full['raw_jsonb']['coverage']}")


def run():
    tests = [test_currency, test_thin_coverage_no_recommendation, test_grouping_and_threshold, test_fixture_file]
    failed = 0
    for t in tests:
        try:
            t()
        except AssertionError as e:
            failed += 1
            print(f"  FAIL {t.__name__}: {e}")
    print(f"  {len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(run())