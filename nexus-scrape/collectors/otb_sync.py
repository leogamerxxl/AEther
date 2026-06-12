"""Own OTB collector -> otb_observations. Plan s3.

Channels: --csv PATH (stdlib; template columns: stay_date,rooms_sold,
rooms_remaining,adr_ron) or Google Sheet (OTB_SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON;
requires optional google-auth). GDPR by construction: the template has no guest
fields. Idempotent per (stay_date, observation day): same-day re-runs patch.
"No new data" is NOT a failure (SLA 48h). Pickup regression is the validator's
job, not an error here.
Usage: python collectors/otb_sync.py [--dry-run] [--csv PATH]
"""
import argparse
import csv
import io
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib import provenance as pv
from lib.sb import SB, SBError, iso, log_run, ssl_context, today_start_iso, utcnow

AGENT = "collector.otb"
CAPACITY = int(os.environ.get("OTB_CAPACITY", "52"))


def read_rows(csv_path=None):
    csv_path = csv_path or os.environ.get("OTB_CSV_PATH")
    if csv_path:
        text = Path(csv_path).read_text(encoding="utf-8-sig")
        return list(csv.DictReader(io.StringIO(text))), {"channel": "csv", "path": csv_path}
    sheet_id = os.environ.get("OTB_SHEET_ID")
    if not sheet_id:
        raise ValueError("no --csv given and OTB_SHEET_ID not set")
    try:
        from google.oauth2 import service_account  # type: ignore
        import google.auth.transport.requests  # type: ignore
    except ImportError:
        raise ValueError("Google Sheet channel needs: pip install google-auth") from None
    import urllib.request
    creds = service_account.Credentials.from_service_account_file(
        os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"],
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
    creds.refresh(google.auth.transport.requests.Request())
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/A:D"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {creds.token}"})
    with urllib.request.urlopen(req, timeout=60, context=ssl_context()) as r:
        values = json.loads(r.read().decode()).get("values", [])
    if not values:
        return [], {"channel": "sheet"}
    header = [h.strip() for h in values[0]]
    return [dict(zip(header, row)) for row in values[1:]], {"channel": "sheet"}


def validate_row(raw, today):
    errors = []
    out = {}
    try:
        out["stay_date"] = date.fromisoformat(str(raw.get("stay_date", "")).strip())
        if out["stay_date"] < today - timedelta(days=1):
            errors.append("stay_date in the past")
    except ValueError:
        errors.append(f"bad stay_date: {raw.get('stay_date')!r}")
    for f in ("rooms_sold", "rooms_remaining"):
        try:
            out[f] = int(str(raw.get(f, "")).strip())
            if out[f] < 0:
                errors.append(f"{f} negative")
        except ValueError:
            errors.append(f"bad {f}: {raw.get(f)!r}")
    if "rooms_sold" in out and "rooms_remaining" in out and out["rooms_sold"] + out["rooms_remaining"] > CAPACITY:
        errors.append(f"rooms exceed capacity {CAPACITY}")
    adr_raw = str(raw.get("adr_ron", "")).strip()
    out["adr"] = None
    if adr_raw:
        try:
            out["adr"] = round(float(adr_raw), 2)
            if not (50 <= out["adr"] <= 2000):
                errors.append(f"adr out of band: {out['adr']}")
        except ValueError:
            errors.append(f"bad adr_ron: {adr_raw!r}")
    return out, errors


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--csv")
    a = ap.parse_args(argv)
    started = utcnow()
    today = utcnow().date()

    try:
        raws, channel = read_rows(a.csv)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2

    now = iso(utcnow())
    valid, rejected = [], []
    for raw in raws:
        if not any(str(v).strip() for v in raw.values()):
            continue
        row, errors = validate_row(raw, today)
        if errors:
            rejected.append({"row": raw, "errors": errors})
            continue
        adr = row["adr"]
        revpar = round(adr * row["rooms_sold"] / CAPACITY, 2) if adr is not None else None
        valid.append({
            "property_id": pv.PROPERTY_TERRA, "observed_at": now,
            "stay_date": row["stay_date"].isoformat(),
            "rooms_sold": row["rooms_sold"], "rooms_remaining": row["rooms_remaining"],
            "adr": adr, "revpar": revpar,
            "confidence": pv.otb_confidence(adr is not None),
            "raw_jsonb": raw,
        })

    summary = {"channel": channel, "simulated": bool(a.csv and "fixture" in str(a.csv)),
               "valid": len(valid), "rejected": rejected, "inserted": 0, "patched": 0}

    if a.dry_run:
        preview = [{k: r[k] for k in ("stay_date", "rooms_sold", "rooms_remaining", "adr", "revpar", "confidence")} for r in valid]
        print(json.dumps({"agent": AGENT, "dry_run": True, **summary, "preview": preview}, indent=2))
        return 0

    try:
        sb = SB()
    except SBError as e:
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2
    try:
        existing = sb.select("otb_observations", select="id,stay_date",
                             property_id=f"eq.{pv.PROPERTY_TERRA}",
                             observed_at=f"gte.{today_start_iso()}")
        emap = {e["stay_date"]: e["id"] for e in (existing or [])}
        for r in valid:
            if r["stay_date"] in emap:
                sb.patch("otb_observations", {"id": f"eq.{emap[r['stay_date']]}"},
                         {k: r[k] for k in ("rooms_sold", "rooms_remaining", "adr", "revpar", "confidence", "observed_at", "raw_jsonb")})
                summary["patched"] += 1
            else:
                sb.insert("otb_observations", [r])
                summary["inserted"] += 1
        status = "succeeded" if valid else "degraded"
        log_run(sb, AGENT, status, channel, summary, started)
        print(json.dumps({"agent": AGENT, "status": status, **summary}, indent=2))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, AGENT, "failed", channel, summary, started, error=e)
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())