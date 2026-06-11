"""Shared brief gates (plan s8): one verdict, used by validate.py AND the brief
generator so they can never disagree.

BLOCK   = competitor rates stale/dead or coverage below minimum -> brief ships
          WITHOUT recommendations (suppressed), sections labeled.
DEGRADE = secondary sources (OTB/weather/FX) cooling/stale/dead -> labeled.
PASS    = all fresh.
"""
import os

MIN_RATE_COVERAGE = int(os.environ.get("MIN_RATE_COVERAGE", "10"))

SECONDARY = (
    ("collector.otb", "OTB"),
    ("collector.weather", "meteo"),
    ("collector.bnr_fx", "curs BNR"),
)


def verdict(status_rows, rate_coverage):
    s = {r.get("agent_code"): r for r in (status_rows or [])}
    rates_state = (s.get("collector.booking_rates") or {}).get("freshness_state", "dead")
    reasons = []
    if rates_state in ("stale", "dead"):
        reasons.append(f"tarife concurenta: {rates_state}")
    if rate_coverage is not None and rate_coverage < MIN_RATE_COVERAGE:
        reasons.append(f"acoperire {rate_coverage}/{MIN_RATE_COVERAGE} hoteluri")
    block = bool(reasons)

    degraded = []
    for code, label in SECONDARY:
        st = (s.get(code) or {}).get("freshness_state", "dead")
        if st != "fresh":
            degraded.append({"source": label, "state": st})

    return {
        "verdict": "BLOCK" if block else ("DEGRADE" if degraded else "PASS"),
        "recommendations_allowed": not block,
        "reasons": reasons,
        "degraded": degraded,
        "rates_state": rates_state,
        "rate_coverage": rate_coverage,
    }