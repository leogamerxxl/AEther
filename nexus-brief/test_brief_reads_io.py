"""Tests: the brief RENDERS market intelligence from intelligence_objects and does
not re-derive it. No DB, no secrets. Run: python test_brief_reads_io.py
"""
import sys
from datetime import date, datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generator as G  # noqa: E402

TODAY = date(2026, 6, 14)


def _io(stay_date, median, coverage, obs_ids, fresh=True):
    now = datetime.now(timezone.utc)
    return {
        "id": f"io-{stay_date}",
        "signal_type": "market_rate_pressure",
        "status": "active",
        "confidence": 0.21,
        "observed_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=(24 if fresh else -100))).isoformat(),
        "evidence": [{"source_id": "s", "observation_ids": obs_ids, "observed_at": now.isoformat()}],
        "raw_jsonb": {"stay_date": stay_date, "median_adr_ron": median, "coverage": coverage,
                      "min_adr_ron": median - 50, "max_adr_ron": median + 50},
    }


def _avail(sid, target_date):
    # 3 of these -> pressure section is cited (keeps the citation walker clean)
    return {"kind": "comp_availability", "target_date": target_date, "subject_id": sid,
            "value_text": "sold_out", "observation_id": f"av-{sid}",
            "observed_at": "2026-06-12T20:00:00+00:00", "confidence": 0.85}


def _data(ios, rates_fresh=True):
    inputs = [_avail(f"p{i}", "2026-06-15") for i in range(3)]
    return {"inputs": inputs, "intelligence": ios, "simulated": False, "status": [
        {"agent_code": "collector.booking_rates",
         "freshness_state": ("fresh" if rates_fresh else "dead"),
         "last_observed_at": "2026-06-14T05:00"},
        {"agent_code": "collector.weather", "freshness_state": "fresh", "last_observed_at": "2026-06-14T05:00"},
        {"agent_code": "collector.bnr_fx", "freshness_state": "fresh", "last_observed_at": "2026-06-14T05:00"},
        {"agent_code": "collector.otb", "freshness_state": "dead", "last_observed_at": None},
    ]}


def _sect(b, key):
    return next(s for s in b.sections if s["key"] == key)


def test_renders_from_io_under_block():
    # coverage 0 (no comp_rate) -> gate BLOCK, yet market still renders from the IO
    b = G.build(G.index(_data([_io("2026-06-15", 500, 11, ["a", "b"]),
                               _io("2026-06-20", 700, 11, ["c"])])), TODAY)
    G.check_citations(b)                                   # must not raise
    ms = _sect(b, "market")
    txt = " ".join(ms["lines_ro"])
    assert "500" in txt and "700" in txt, txt             # medians come from IO.raw_jsonb
    assert ms["cites"], "market must cite"
    cited = next(c for c in b.citations if c["id"] == ms["cites"][0])
    assert set(cited["observation_ids"]) == {"a", "b", "c"}   # citation = IO evidence chain
    assert "market_rate_pressure" in cited["computed"]
    assert set(b.rendered_io_ids) == {"io-2026-06-15", "io-2026-06-20"}
    # BLOCK preserved: recommendation suppressed
    assert b.gate["verdict"] == "BLOCK"
    assert "NICIO RECOMANDARE" in " ".join(_sect(b, "action")["lines_ro"])
    print("  ok market renders from IO + cites evidence; BLOCK still suppresses the rec")


def test_no_io_degrades_cleanly():
    b = G.build(G.index(_data([])), TODAY)
    G.check_citations(b)                                   # must not raise
    ms = _sect(b, "market")
    assert not ms["cites"]
    assert "indisponibil" in " ".join(ms["lines_ro"]).lower()
    print("  ok no IO -> market degrades honestly, citation walker passes")


def test_stale_io_ignored():
    b = G.build(G.index(_data([_io("2026-06-15", 500, 11, ["a"], fresh=False)])), TODAY)
    ms = _sect(b, "market")
    assert not ms["cites"], "a stale IO must not render as a fresh market signal"
    assert "indisponibil" in " ".join(ms["lines_ro"]).lower()
    print("  ok stale IO ignored -> degrade")


def _rate_input(sid, target_date):
    return {"kind": "comp_rate", "target_date": target_date, "subject_id": sid,
            "value_numeric": 500, "observation_id": f"r-{sid}",
            "observed_at": "2026-06-14T05:00:00+00:00", "confidence": 0.85}


def test_rec_renders_from_io_when_gate_allows():
    io = _io("2026-06-16", 800, 10, ["x1", "x2"])
    io["severity"] = "medium"
    io["recommended_actions"] = [{"type": "hold_or_raise", "stay_date": "2026-06-16",
                                  "label": "Retineti sau cresteti tariful pentru 2026-06-16: 8/11 hoteluri concurente epuizate.",
                                  "basis": {"compression": 0.7273, "soldout": 8, "observed": 10, "urlset": 11}}]
    data = _data([io])
    data["inputs"] += [_rate_input(f"c{i}", "2026-06-16") for i in range(10)]  # coverage 10 -> not BLOCK
    b = G.build(G.index(data), TODAY)
    G.check_citations(b)
    act = _sect(b, "action")
    txt = " ".join(act["lines_ro"])
    assert "8/11" in txt and "epuizate" in txt, txt          # engine label rendered verbatim
    assert act["cites"], "action must cite the IO evidence"
    cited = next(c for c in b.citations if c["id"] == act["cites"][0])
    assert set(cited["observation_ids"]) == {"x1", "x2"}     # citation = IO evidence chain
    assert b.gate["recommendations_allowed"] is True
    print("  ok rec renders from IO recommended_actions + cites evidence")


def test_null_median_never_prints_zero():
    io = _io("2026-06-16", 1, 0, ["y1"])  # placeholder; overridden to None below
    io["raw_jsonb"]["median_adr_ron"] = None
    io["raw_jsonb"]["min_adr_ron"] = None
    io["raw_jsonb"]["max_adr_ron"] = None
    io["causal_hypothesis"] = "Niciun tarif disponibil pentru 2026-06-16 - piata pare epuizata. Compresie: 9/11 hoteluri epuizate."
    b = G.build(G.index(_data([io])), TODAY)
    G.check_citations(b)
    ms = _sect(b, "market")
    txt = " ".join(ms["lines_ro"])
    assert "0 RON" not in txt, txt                            # never render median 0
    assert "epuizat" in txt.lower()
    assert ms["cites"]
    print("  ok null median -> compression narrative, no fabricated 0 RON")

def run():
    tests = [test_renders_from_io_under_block, test_no_io_degrades_cleanly, test_stale_io_ignored,
             test_rec_renders_from_io_when_gate_allows, test_null_median_never_prints_zero]
    failed = 0
    for t in tests:
        try:
            t()
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  FAIL {t.__name__}: {e}")
    print(f"  {len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(run())