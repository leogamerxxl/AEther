"""Validation gates (plan s8/s11). Reads collector_status + data sanity checks,
emits BLOCK/DEGRADE/PASS verdict + recommendations_allowed, logs to agent_runs.
Exit 0 always when checks ran (verdict travels in data); 2 on internal error.
Usage: python validate.py [--json]
"""
import json
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import provenance as pv
from lib.gates import verdict
from lib.sb import SB, SBError, log_run, today_start_iso, utcnow


def rate_anomalies(sb):
    week_ago = (utcnow().date().toordinal() - 7)
    rows = sb.select("rate_observations",
                     select="scraped_property_id,stay_date,rate_amount,observed_at",
                     observed_at=f"gte.{(utcnow().date().fromordinal(week_ago)).isoformat()}",
                     limit=20000) or []
    today = utcnow().date().isoformat()
    by_prop = {}
    for r in rows:
        by_prop.setdefault(r["scraped_property_id"], []).append(r)
    flags = []
    for prop, rs in by_prop.items():
        med = statistics.median(float(x["rate_amount"]) for x in rs)
        if med <= 0:
            continue
        for x in rs:
            if str(x["observed_at"]).startswith(today):
                ratio = float(x["rate_amount"]) / med
                if ratio > 1.6 or ratio < 0.4:
                    flags.append({"property": prop, "stay_date": x["stay_date"],
                                  "rate": float(x["rate_amount"]), "median_7d": round(med, 2),
                                  "ratio": round(ratio, 2)})
    return flags


def otb_regressions(sb):
    rows = sb.select("otb_observations", select="stay_date,rooms_sold,observed_at",
                     property_id=f"eq.{pv.PROPERTY_TERRA}",
                     order="stay_date.asc,observed_at.desc", limit=2000) or []
    latest, prior = {}, {}
    for r in rows:
        d = r["stay_date"]
        if d not in latest:
            latest[d] = r
        elif d not in prior:
            prior[d] = r
    return [{"stay_date": d, "rooms_sold_now": latest[d]["rooms_sold"],
             "rooms_sold_prev": prior[d]["rooms_sold"]}
            for d in latest if d in prior
            and (prior[d]["rooms_sold"] or 0) - (latest[d]["rooms_sold"] or 0) > 2]


def main(argv=None):
    started = utcnow()
    try:
        sb = SB()
    except SBError as e:
        print(json.dumps({"agent": "validator", "status": "failed", "error": str(e)}))
        return 2
    try:
        status_rows = sb.select("collector_status", select="*") or []
        inputs = sb.select("brief_inputs", select="kind,subject_id", kind="eq.comp_rate") or []
        coverage = len({i["subject_id"] for i in inputs})
        v = verdict(status_rows, coverage)
        report = {
            **v,
            "collectors": {r["agent_code"]: {
                "freshness_state": r["freshness_state"],
                "last_observed_at": r["last_observed_at"],
                "row_count_today": r["row_count_today"],
                "last_success_at": r.get("last_success_at"),
                "last_error": r.get("last_error"),
            } for r in status_rows},
            "anomalies": rate_anomalies(sb),
            "otb_regressions": otb_regressions(sb),
            "fx_plausible": None,
        }
        fx = sb.select("brief_inputs", select="value_numeric,target_date", kind="eq.fx",
                       metric="eq.fx_eur_ron", limit=1) or []
        if fx:
            v_fx = float(fx[0]["value_numeric"])
            report["fx_plausible"] = 4.5 <= v_fx <= 5.5
        log_run(sb, "validator", "succeeded", {}, report, started)
        print(json.dumps({"agent": "validator", **report}, indent=2, default=str))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, "validator", "failed", {}, {}, started, error=e)
        print(json.dumps({"agent": "validator", "status": "failed", "error": str(e)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())