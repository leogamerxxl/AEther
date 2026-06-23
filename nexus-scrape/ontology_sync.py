"""Ontology sync stage: rebuild the relational property-graph from the operational
tables by calling the idempotent public.ontology_sync() RPC. Keeps ontology_entities
/ ontology_relationships current as new intelligence_objects land. No derivation here
- the graph mirrors systems-of-record (one read layer, one world model).
Usage: python ontology_sync.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.sb import SB, log_run, utcnow  # noqa: E402


def main():
    started = utcnow()
    try:
        sb = SB()
    except Exception as e:  # noqa: BLE001
        print(f"[ontology_sync] config error: {e}", file=sys.stderr)
        return 2
    try:
        res = sb._req("POST", "rpc/ontology_sync")
        log_run(sb, "ontology_sync", "ok", {}, res or {}, started)
        print(json.dumps({"status": "ok", "result": res}, default=str))
        return 0
    except Exception as e:  # noqa: BLE001
        log_run(sb, "ontology_sync", "failed", {}, {}, started, error=e)
        print(f"[ontology_sync] FAILED: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())