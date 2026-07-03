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


def test_soldout_excluded_from_median():
    rows = [_rate("p1", "2026-06-20", 400), _rate("p2", "2026-06-20", 500),
            _rate("p3", "2026-06-20", 0), _rate("p4", "2026-06-20", 0)]  # 2 sold-out
    objs = build_objects(rows, fx=5.0, now_iso="N", expires_iso="E")
    o = objs[0]
    assert o["raw_jsonb"]["median_adr_ron"] == 450.0   # median of 400,500 only
    assert o["raw_jsonb"]["coverage"] == 2             # zero-priced excluded
    assert len(o["evidence"][0]["observation_ids"]) == 4   # sold-out rows are compression evidence
    assert o["raw_jsonb"]["soldout_count"] == 2
    assert o["raw_jsonb"]["compression"] == round(2 / 12, 4)  # default denom = COMP_SET_SIZE
    assert o["recommended_actions"] == []                     # 0.17 < 0.5 threshold
    print(f"  ok sold-out excluded: median={o['raw_jsonb']['median_adr_ron']} cov={o['raw_jsonb']['coverage']}")


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


def _sold(pid, sd):
    r = _rate(pid, sd, 0)
    r["availability_state"] = "sold_out"
    r["rooms_remaining"] = None
    return r


def test_compression_recommendation():
    rows = [_sold(f"s{i}", "2026-07-10") for i in range(8)] + \
           [_rate("p1", "2026-07-10", 700), _rate("p2", "2026-07-10", 900)]
    objs = build_objects(rows, fx=5.0, now_iso="N", expires_iso="E", urlset_size=11,
                         name_map={"p1": "Hotel A"})
    o = objs[0]
    assert o["raw_jsonb"]["compression"] == round(8 / 11, 4)   # 0.7273 -> medium
    assert o["severity"] == "medium"
    assert len(o["recommended_actions"]) == 1
    act = o["recommended_actions"][0]
    assert act["type"] == "hold_or_raise" and act["basis"]["soldout"] == 8
    assert o["raw_jsonb"]["median_adr_ron"] == 800.0           # priced only
    assert len(o["raw_jsonb"]["comps"]) == 10
    assert o["raw_jsonb"]["comps"][0]["availability_state"] == "sold_out"  # sold-out first
    assert o["forecast_impact"] is None                        # no RON claim without OTB
    print(f"  ok compression rec: {act['basis']}")


def test_high_compression_and_null_median():
    rows = [_sold(f"s{i}", "2026-07-11") for i in range(9)] + [_rate("p1", "2026-07-11", 650)]
    o = build_objects(rows, fx=5.0, now_iso="N", expires_iso="E", urlset_size=11)[0]
    assert o["severity"] == "high" and o["raw_jsonb"]["compression"] == round(9 / 11, 4)
    all_sold = [_sold(f"s{i}", "2026-07-12") for i in range(6)]
    o2 = build_objects(all_sold, fx=5.0, now_iso="N", expires_iso="E", urlset_size=11)[0]
    assert o2["raw_jsonb"]["median_adr_ron"] is None            # priced=0 -> null, never 0
    assert len(o2["recommended_actions"]) == 1                  # observed=6 floor met
    print("  ok high threshold + null median on all-sold-out")


def test_rec_floor_blocks_thin_observed():
    rows = [_sold(f"s{i}", "2026-07-13") for i in range(4)]     # observed 4 < 6
    o = build_objects(rows, fx=5.0, now_iso="N", expires_iso="E", urlset_size=11)[0]
    assert o["recommended_actions"] == [] and o["severity"] == "info"
    print("  ok rec floor: thin observed -> no recommendation")


def run():
    tests = [test_currency, test_thin_coverage_no_recommendation, test_soldout_excluded_from_median, test_grouping_and_threshold, test_fixture_file,
             test_compression_recommendation, test_high_compression_and_null_median,
             test_rec_floor_blocks_thin_observed]
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