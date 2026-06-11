#!/usr/bin/env bash
# AETHER cron wrapper. Cron runs with an empty environment, so each scheduled
# stage must source .env first. Usage: run.sh <stage>
#   stages: fx rates weather otb validate brief send sentinel morning
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
set -a
[ -f .env ] && . ./.env
set +a
exec .venv/bin/python run_daily.py "$1"