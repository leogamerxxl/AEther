"""Supabase REST client - server-side only (service role). Stdlib urllib.

Never import from frontend code; secrets come from server env only:
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""
import json
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

UA = "AetherCollector/1.0"


def ssl_context():
    """Verified TLS always. Uses certifi when installed (Windows dev boxes
    often lack a CA bundle); system store otherwise (Linux VPS).
    Verification is NEVER disabled."""
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


class SBError(RuntimeError):
    pass


class SB:
    def __init__(self) -> None:
        try:
            self.url = os.environ["SUPABASE_URL"].rstrip("/")
            self.key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        except KeyError as e:
            raise SBError(f"missing env: {e.args[0]}") from None

    def _req(self, method, path, params=None, body=None, prefer=None):
        qs = "?" + urllib.parse.urlencode(params, doseq=True) if params else ""
        req = urllib.request.Request(f"{self.url}/rest/v1/{path}{qs}", method=method)
        req.add_header("apikey", self.key)
        req.add_header("Authorization", f"Bearer {self.key}")
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", UA)
        if prefer:
            req.add_header("Prefer", prefer)
        data = json.dumps(body, default=str).encode() if body is not None else None
        try:
            with urllib.request.urlopen(req, data=data, timeout=90, context=ssl_context()) as r:
                txt = r.read().decode()
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:300]
            raise SBError(f"{method} {path}: HTTP {e.code} {detail}") from None
        except urllib.error.URLError as e:
            raise SBError(f"{method} {path}: {e.reason}") from None
        return json.loads(txt) if txt else None

    def select(self, table, **params):
        return self._req("GET", table, params=params)

    def insert(self, table, rows):
        if not rows:
            return None
        return self._req("POST", table, body=rows, prefer="return=minimal")

    def patch(self, table, params, body):
        return self._req("PATCH", table, params=params, body=body, prefer="return=minimal")

    def upsert(self, table, rows, on_conflict):
        """Idempotent write: ON CONFLICT (<on_conflict>) DO UPDATE. The signal
        engine uses this so a re-run rewrites a signal instead of accumulating."""
        if not rows:
            return None
        return self._req("POST", table, params={"on_conflict": on_conflict},
                         body=rows, prefer="resolution=merge-duplicates,return=minimal")


def utcnow():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.isoformat()


def today_start_iso():
    now = utcnow()
    return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def log_run(sb, agent_code, status, input_data, output_data, started, error=None, cost_cents=0):
    """Every run lands in agent_runs (Doctrine II.12). A logging failure must
    not mask the run result - print loudly and continue."""
    row = {
        "agent_code": agent_code,
        "input_jsonb": input_data,
        "output_jsonb": output_data,
        "model": "system",
        "cost_cents": cost_cents,
        "latency_ms": int((utcnow() - started).total_seconds() * 1000),
        "ts": iso(utcnow()),
        "status": status,
        "error": (str(error)[:2000] if error else None),
    }
    try:
        sb.insert("agent_runs", [row])
    except Exception as e:  # noqa: BLE001
        print(f"[agent_runs] LOGGING FAILED for {agent_code}: {e}")