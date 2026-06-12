"""Resend mailer for the morning brief (deliverables 4/6/7).

Reads daily_briefs for the date; refuses missing/null-html briefs and
double-sends (without --force); writes sent_at + recipient_count; --sentinel
verifies today's brief went out and alerts if not (06:55 stage).
Usage:
  python send.py [--date YYYY-MM-DD] [--to a@b,c@d] [--force]
  python send.py --sentinel
"""
import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "nexus-scrape"))
from lib import provenance as pv
from lib.sb import SB, SBError, iso, log_run, ssl_context, utcnow

AGENT = "mail.send"


def resend_post(key, payload):
    req = urllib.request.Request(
        "https://api.resend.com/emails", method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "User-Agent": "AetherCollector/1.0"},
        data=json.dumps(payload).encode())
    with urllib.request.urlopen(req, timeout=60, context=ssl_context()) as r:
        return json.loads(r.read().decode())


def ops_alert(subject, text):
    key, to = os.environ.get("RESEND_API_KEY"), os.environ.get("ALERT_EMAIL")
    print(f"[ALERT] {subject}: {text}", file=sys.stderr)
    if key and to:
        try:
            resend_post(key, {"from": os.environ.get("ALERT_FROM", "onboarding@resend.dev"),
                              "to": [to], "subject": subject, "text": text})
        except Exception as e:  # noqa: BLE001
            print(f"[ALERT] resend failed too: {e}", file=sys.stderr)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--date")
    ap.add_argument("--to")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--sentinel", action="store_true")
    a = ap.parse_args(argv)
    started = utcnow()
    day = a.date or utcnow().date().isoformat()

    try:
        sb = SB()
    except SBError as e:
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2

    rows = sb.select("daily_briefs", select="id,sent_at,rendered_html,content_jsonb",
                     property_id=f"eq.{pv.PROPERTY_TERRA}", brief_date=f"eq.{day}", limit=1) or []
    row = rows[0] if rows else None

    if a.sentinel:
        if row and row.get("sent_at"):
            print(json.dumps({"agent": AGENT, "sentinel": "ok", "sent_at": row["sent_at"]}))
            return 0
        ops_alert(f"AETHER sentinel: brief {day} NOT sent",
                  "Briful de azi nu a fost trimis. Verificati pipeline-ul (agent_runs).")
        return 2

    try:
        if not row:
            raise ValueError(f"no brief generated for {day}")
        if not row.get("rendered_html"):
            raise ValueError(f"brief {day} has null rendered_html - refusing to send")
        if row.get("sent_at") and not a.force:
            print(json.dumps({"agent": AGENT, "status": "skipped",
                              "reason": f"already sent at {row['sent_at']}"}))
            return 0
        recipients = [x.strip() for x in (a.to or os.environ.get("BRIEF_RECIPIENTS", "")).split(",") if x.strip()]
        if not recipients:
            raise ValueError("no recipients (set BRIEF_RECIPIENTS or --to)")
        sender = os.environ.get("BRIEF_FROM")
        if not sender:
            raise ValueError("BRIEF_FROM not set")
        key = os.environ["RESEND_API_KEY"]
        content = row.get("content_jsonb") or {}
        res = resend_post(key, {
            "from": sender, "to": recipients,
            "subject": content.get("subject", f"AETHER Brief {day}"),
            "html": row["rendered_html"],
            "text": content.get("text", ""),
        })
        sb.patch("daily_briefs", {"id": f"eq.{row['id']}"},
                 {"sent_at": iso(utcnow()), "recipient_count": len(recipients)})
        meta = {"resend_id": res.get("id"), "recipients": len(recipients), "date": day}
        log_run(sb, AGENT, "succeeded", {"date": day}, meta, started)
        print(json.dumps({"agent": AGENT, "status": "succeeded", **meta}))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, AGENT, "failed", {"date": day}, {}, started, error=e)
        ops_alert(f"AETHER send FAILED for {day}", str(e))
        print(json.dumps({"agent": AGENT, "status": "failed", "error": str(e)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())