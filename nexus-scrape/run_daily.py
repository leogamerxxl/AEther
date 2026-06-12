"""Pipeline stage runner (plan s1/s9): retries, kill switch, fail-loud alerts.

Stages (EEST schedule -> UTC cron): fx 14:30 (11:30Z prev-day) | rates 04:30
(01:30Z) | weather 04:45 (01:45Z) | otb 05:00 (02:00Z) | validate 05:30 (02:30Z)
| brief 06:00 (03:00Z) | send 06:45 (03:45Z) | sentinel 06:55 (03:55Z).
Usage: python run_daily.py <fx|rates|weather|otb|validate|brief|send|sentinel|morning>
  morning = rates -> weather -> otb -> validate -> brief -> send
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent))
from lib.sb import ssl_context  # noqa: E402
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PY = sys.executable

STAGES = {
    "fx":       [PY, str(HERE / "collectors" / "bnr_fx.py")],
    "rates":    [PY, str(HERE / "collectors" / "booking_rates.py")],
    "weather":  [PY, str(HERE / "collectors" / "weather.py")],
    "otb":      [PY, str(HERE / "collectors" / "otb_sync.py")],
    "validate": [PY, str(HERE / "validate.py")],
    "brief":    [PY, str(ROOT / "nexus-brief" / "generator.py")],
    "send":     [PY, str(ROOT / "nexus-mail" / "send.py")],
    "sentinel": [PY, str(ROOT / "nexus-mail" / "send.py"), "--sentinel"],
}
MORNING = ["rates", "weather", "otb", "validate", "brief", "send"]
RETRIES = int(os.environ.get("STAGE_RETRIES", "2"))
BACKOFF_S = int(os.environ.get("RETRY_BACKOFF_S", "60"))


def alert(stage, detail):
    """Fail loud (Doctrine): email ops via Resend if configured, else stderr."""
    key, to = os.environ.get("RESEND_API_KEY"), os.environ.get("ALERT_EMAIL")
    msg = f"AETHER PIPELINE: stage '{stage}' failed.\n\n{detail[-3000:]}"
    print(f"[ALERT] {msg}", file=sys.stderr)
    if not (key and to):
        return
    body = json.dumps({"from": os.environ.get("ALERT_FROM", "onboarding@resend.dev"),
                       "to": [to], "subject": f"AETHER pipeline FAILED: {stage}",
                       "text": msg}).encode()
    req = urllib.request.Request("https://api.resend.com/emails", data=body, method="POST",
                                 headers={"Authorization": f"Bearer {key}",
                                          "Content-Type": "application/json",
                                          "User-Agent": "AetherCollector/1.0"})
    try:
        urllib.request.urlopen(req, timeout=30, context=ssl_context())
    except Exception as e:  # noqa: BLE001
        print(f"[ALERT] resend failed too: {e}", file=sys.stderr)


def run_stage(name):
    cmd = STAGES[name]
    last = ""
    for attempt in range(RETRIES + 1):
        p = subprocess.run(cmd, capture_output=True, text=True)
        out = (p.stdout or "") + (p.stderr or "")
        print(out)
        if p.returncode == 0:
            return True
        last = out
        if attempt < RETRIES:
            print(f"[{name}] attempt {attempt + 1} failed; retrying in {BACKOFF_S}s")
            time.sleep(BACKOFF_S)
    alert(name, last)
    return False


def main(argv):
    if os.environ.get("PIPELINE_ENABLED", "true").lower() == "false":
        print(json.dumps({"scheduler": "skipped", "reason": "PIPELINE_ENABLED=false"}))
        return 0
    if len(argv) != 1 or argv[0] not in (*STAGES, "morning"):
        print(__doc__)
        return 1
    if argv[0] == "morning":
        for s in MORNING:
            if not run_stage(s) and s in ("rates", "validate", "brief"):
                # core chain broken: stop before sending nonsense; alert already fired
                return 2
        return 0
    return 0 if run_stage(argv[0]) else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))