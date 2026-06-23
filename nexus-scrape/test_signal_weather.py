"""Pure-function tests for the weather signal computer (no DB, no secrets).
Run: python test_signal_weather.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from signal_weather import build_weather_objects  # noqa: E402


def _day(d, tmax, precip, wind):
    def row(metric, val):
        return {"id": f"wx-{d}-{metric}", "metric_code": metric, "effective_date": d,
                "value_numeric": val, "observed_at": "2026-06-23T19:00:00+00:00"}
    return {"temp_max_c": row("temp_max_c", tmax), "precip_prob_pct": row("precip_prob_pct", precip),
            "wind_kmh": row("wind_kmh", wind)}


def test_favorable_window():
    by = {
        "2026-06-23": _day("2026-06-23", 29, 10, 12),   # favorable
        "2026-06-24": _day("2026-06-24", 31, 5, 18),    # favorable
        "2026-06-25": _day("2026-06-25", 27, 20, 22),   # favorable
        "2026-06-26": _day("2026-06-26", 28, 15, 30),   # favorable
        "2026-06-27": _day("2026-06-27", 18, 70, 40),   # adverse
    }
    objs = build_weather_objects(by, "2026-06-23", "N", "E")
    assert len(objs) == 1
    o = objs[0]
    assert o["signal_type"] == "weather_demand_outlook"
    assert o["raw_jsonb"]["favorable_days"] == 4
    assert o["severity"] == "low"                       # >=4 favorable
    assert o["recommended_actions"] == []               # Truth Doctrine
    assert o["forecast_impact"] is None
    assert o["dedupe_key"] == "weather_demand_outlook:7d"
    assert o["property_id"]
    assert len(o["evidence"][0]["observation_ids"]) == 15  # 5 days x 3 metrics
    assert 0 < o["confidence"] <= 1
    print(f"  ok favorable window: fav={o['raw_jsonb']['favorable_days']} "
          f"sev={o['severity']} conf={o['confidence']}")


def test_adverse_window_no_rec():
    by = {
        "2026-06-23": _day("2026-06-23", 17, 80, 45),
        "2026-06-24": _day("2026-06-24", 19, 65, 38),
    }
    objs = build_weather_objects(by, "2026-06-23", "N", "E")
    assert objs[0]["raw_jsonb"]["favorable_days"] == 0
    assert objs[0]["severity"] == "medium"              # 0 favorable -> demand risk
    assert objs[0]["recommended_actions"] == []
    print(f"  ok adverse window: sev={objs[0]['severity']} (no recommendation)")


def test_empty():
    assert build_weather_objects({}, "2026-06-23", "N", "E") == []
    print("  ok empty -> no object")


def run():
    tests = [test_favorable_window, test_adverse_window_no_rec, test_empty]
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