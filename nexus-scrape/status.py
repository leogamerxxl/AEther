"""Collector status: last_success_at, last_error, row_count, freshness per
collector (the rule-required surface). Reads the collector_status view.
Usage: python status.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.sb import SB, SBError


def main():
    try:
        sb = SB()
    except SBError as e:
        print(f"offline ({e}) - set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
        return 1
    rows = sb.select("collector_status", select="*") or []
    print(f"{'collector':<28}{'freshness':<10}{'rows_today':<11}{'last_observed_at':<28}{'last_success_at':<28}last_error")
    for r in rows:
        print(f"{r['agent_code']:<28}{r['freshness_state']:<10}{str(r['row_count_today']):<11}"
              f"{str(r['last_observed_at'] or '-'):<28}{str(r.get('last_success_at') or '-'):<28}"
              f"{(r.get('last_error') or '-')[:60]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())