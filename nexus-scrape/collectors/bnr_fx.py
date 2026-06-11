"""BNR FX collector -> macro_observations (fx_eur_ron, fx_usd_ron). Plan s5.

Official XML, no API key. Idempotent on (source, metric, effective_date).
Usage: python collectors/bnr_fx.py [--dry-run] [--fixture PATH]
"""
import argparse
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import provenance as pv
from lib.sb import SB, SBError, iso, log_run, ssl_context, utcnow

AGENT = "collector.bnr_fx"
BNR_URL = "https://www.bnr.ro/nbrfxrates.xml"
NS = {"b": "http://www.bnr.ro/xsd"}


def fetch_xml(fixture=None):
    if fixture:
        return Path(fixture).read_bytes()
    req = urllib.request.Request(BNR_URL, headers={"User-Agent": "AetherCollector/1.0"})
    with urllib.request.urlopen(req, timeout=60, context=ssl_context()) as r:
        return r.read()


def parse(xml_bytes):
    root = ET.fromstring(xml_bytes)
    cube = root.find(".//b:Cube", NS)
    if cube is None:
        raise ValueError("BNR XML: no Cube element")
    pub_date = cube.attrib["date"]
    out = []
    for rate in cube.findall("b:Rate", NS):
        cur = rate.attrib.get("currency")
        if cur not in ("EUR", "USD"):
            continue
        mult = int(rate.attrib.get("multiplier", "1"))
        out.append({"metric_code": f"fx_{cur.lower()}_ron",
                    "effective_date": pub_date,
                    "value": round(float(rate.text) / mult, 4)})
    if not any(r["metric_code"] == "fx_eur_ron" for r in out):
        raise ValueError("BNR XML: EUR rate missing")
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fixture")
    a = ap.parse_args(argv)
    started = utcnow()
    inp = {"source": a.fixture or BNR_URL, "simulated": bool(a.fixture)}

    try:
        xml_bytes = fetch_xml(a.fixture)
        parsed = parse(xml_bytes)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2

    now = iso(utcnow())
    rows = [{
        "category_id": pv.CAT_ECONOMIC, "source_id": pv.SOURCE_BNR,
        "country_id": pv.COUNTRY_RO, "observed_at": now,
        "effective_date": p["effective_date"], "metric_code": p["metric_code"],
        "value_numeric": p["value"], "unit": "RON",
        "confidence": pv.FX_CONFIDENCE,
        "raw_jsonb": {"xml": xml_bytes.decode("utf-8", "replace")[:8000]},
    } for p in parsed]

    summary = {"simulated": bool(a.fixture), "parsed": len(rows), "inserted": 0, "skipped": 0,
               "values": [{k: r[k] for k in ("metric_code", "effective_date", "value_numeric", "confidence")} for r in rows]}

    if a.dry_run:
        print(json.dumps({"agent": AGENT, "dry_run": True, **summary}, indent=2))
        return 0

    try:
        sb = SB()
    except SBError as e:
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2
    try:
        for r in rows:
            existing = sb.select("macro_observations", select="id",
                                 source_id=f"eq.{pv.SOURCE_BNR}",
                                 metric_code=f"eq.{r['metric_code']}",
                                 effective_date=f"eq.{r['effective_date']}", limit=1)
            if existing:
                summary["skipped"] += 1
            else:
                sb.insert("macro_observations", [r])
                summary["inserted"] += 1
        log_run(sb, AGENT, "succeeded", inp, summary, started)
        print(json.dumps({"agent": AGENT, "status": "succeeded", **summary}, indent=2))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, AGENT, "failed", inp, summary, started, error=e)
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())