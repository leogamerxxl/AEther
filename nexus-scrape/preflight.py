"""Preflight: verify required env var NAMES are present before a live run.

Prints SET/MISSING per variable (never values) and exits nonzero if any
REQUIRED variable is missing, so a run fails fast instead of writing nothing
or sending an empty brief. Use in CI and before run_daily.py.
Usage: python preflight.py
"""
import os
import sys

REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
OPTIONAL = ["APIFY_API_TOKEN", "APIFY_ACTOR", "VISUALCROSSING_API_KEY",
            "RESEND_API_KEY", "BRIEF_RECIPIENTS"]


def _present(name):
    return bool(os.environ.get(name, "").strip())


def main():
    missing = [n for n in REQUIRED if not _present(n)]
    print("required:")
    for n in REQUIRED:
        print(f"  {n:<30}{'SET' if _present(n) else 'MISSING'}")
    print("optional (degrade honestly if absent):")
    for n in OPTIONAL:
        print(f"  {n:<30}{'SET' if _present(n) else 'missing'}")
    if missing:
        print(f"\nPREFLIGHT FAIL: missing required env: {', '.join(missing)}", file=sys.stderr)
        return 1
    print("\nPREFLIGHT OK: required env present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())