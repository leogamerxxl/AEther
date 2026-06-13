#!/usr/bin/env bash
# AETHER Oracle VM installer. Run as the 'aether' user (sudo available), from the
# repo, AFTER filling nexus-scrape/.env. Idempotent - safe to re-run.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRAPE="$REPO/nexus-scrape"
USER_NAME="$(whoami)"
echo "repo=$REPO  user=$USER_NAME"

echo "== 1. OS packages =="
sudo apt-get update -y
sudo apt-get install -y python3 python3-venv python3-pip git ufw unattended-upgrades

echo "== 2. Timezone (systemd timers use system TZ) =="
sudo timedatectl set-timezone Europe/Bucharest
timedatectl show -p Timezone --value

echo "== 3. Hardening: firewall (SSH only; pipeline is outbound-only) + auto security updates =="
sudo ufw allow OpenSSH
sudo ufw --force enable
sudo systemctl enable --now unattended-upgrades || true

echo "== 4. Python venv + deps (stdlib pipeline + certifi + google-auth) =="
cd "$SCRAPE"
[ -d .venv ] || python3 -m venv .venv
./.venv/bin/pip install --quiet --upgrade pip
./.venv/bin/pip install --quiet certifi google-auth

echo "== 5. .env check =="
if [ ! -f "$SCRAPE/.env" ]; then
  echo "!! $SCRAPE/.env missing."
  echo "   cp $SCRAPE/.env.example $SCRAPE/.env && chmod 600 $SCRAPE/.env && nano $SCRAPE/.env"
  echo "   then re-run this script."
  exit 1
fi
chmod 600 "$SCRAPE/.env"
chmod +x "$SCRAPE/run.sh"

echo "== 6. Install systemd units (path/user templated to this box) =="
for unit in aether-brief aether-sentinel; do
  sed -e "s#__SCRAPE__#$SCRAPE#g" -e "s#__USER__#$USER_NAME#g" \
      "$REPO/infra/oracle/$unit.service" | sudo tee "/etc/systemd/system/$unit.service" >/dev/null
  sudo cp "$REPO/infra/oracle/$unit.timer" "/etc/systemd/system/$unit.timer"
done
sudo systemctl daemon-reload
sudo systemctl enable --now aether-brief.timer aether-sentinel.timer

echo
echo "== DONE. Active timers: =="
systemctl list-timers 'aether-*' --no-pager || true
echo
echo "Rehearse now:   $SCRAPE/run.sh fx && $SCRAPE/run.sh morning"
echo "Watch logs:     journalctl -u aether-brief.service -n 120 --no-pager"
echo "Next trigger:   05:30 Europe/Bucharest (Persistent=true => self-heals a missed run)"