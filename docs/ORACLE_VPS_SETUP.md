# AETHER — Oracle Cloud Always Free VM setup

The independent, $0-forever runner. A real VM with precise `systemd` timers
(no scheduler jitter), self-healing missed runs (`Persistent=true`), a dead-man's
switch, and an Apify cost circuit-breaker. Everything in `infra/oracle/`.

You provision the VM (your Oracle account); I built every file it runs. I can't
SSH in — paste terminal output back and I'll debug.

---

## 1. Create the VM (Oracle Cloud Console — free, no card charge on Always Free)

1. Sign up / log in at cloud.oracle.com. Always Free needs a card for identity but
   the resources below are **free forever**, not a trial clock.
2. **Compute → Instances → Create instance.**
   - **Image:** Canonical **Ubuntu 22.04** (or 24.04).
   - **Shape:** **VM.Standard.E2.1.Micro** (x86, 1 OCPU / 1 GB) — *Always Free*,
     x86 (no ARM surprises), plenty for this pipeline. (Alt: `VM.Standard.A1.Flex`
     ARM for more headroom, but ARM capacity is often "out of host" — E2.1.Micro
     is the reliable pick.)
   - **Networking:** default VCN, **assign a public IPv4**.
   - **SSH keys:** paste your public key (`type $env:USERPROFILE\.ssh\id_ed25519.pub`
     on Windows; create one first with `ssh-keygen -t ed25519 -C aether-vps` if
     needed). Password login stays off — good.
3. Create. Note the **public IP**.
4. **Ingress:** the default security list already allows SSH (22). The pipeline is
   **outbound-only** — do not open any other port.

## 2. First connection + user

```bash
ssh ubuntu@<PUBLIC_IP>           # Oracle Ubuntu default user is "ubuntu"
sudo adduser aether && sudo usermod -aG sudo aether
sudo install -d -o aether -g aether /home/aether/.ssh
sudo cp ~/.ssh/authorized_keys /home/aether/.ssh/ && sudo chown aether:aether /home/aether/.ssh/authorized_keys && sudo chmod 600 /home/aether/.ssh/authorized_keys
# reconnect as aether:
exit
ssh aether@<PUBLIC_IP>
```

## 3. Clone + configure + install (one script does the rest)

```bash
git clone https://github.com/leogamerxxl/AEther.git /home/aether/aether
cd /home/aether/aether/nexus-scrape
cp .env.example .env && chmod 600 .env && nano .env     # fill secrets (section 4)
cd /home/aether/aether
bash infra/oracle/setup.sh
```

`setup.sh` is idempotent and does everything: OS packages, timezone
(Europe/Bucharest), firewall (SSH-only), automatic security updates, Python venv +
deps, and installs + enables the two `systemd` timers. It prints the active timers
and the rehearsal command when done.

## 4. The `.env` (rotated secrets — server-side only, `chmod 600`, never committed)

```
PIPELINE_ENABLED=true
SUPABASE_URL=https://irmyramqaovmgcktbazy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=     # rotated
APIFY_API_TOKEN=               # rotated
APIFY_ACTOR=oeiQgfg5fsmIJB7Cn
APIFY_BUDGET_FLOOR=0.9         # skip rates at 90% of the free $5 -> never pay
VISUALCROSSING_API_KEY=        # rotated
RESEND_API_KEY=                # rotated
BRIEF_FROM=AETHER <onboarding@resend.dev>
BRIEF_RECIPIENTS=leonardocozaciuc@gmail.com
ALERT_EMAIL=leonardocozaciuc@gmail.com
ALERT_FROM=onboarding@resend.dev
OTB_CSV_PATH=/home/aether/aether/data/otb.csv   # or OTB_SHEET_ID for the sheet channel
OTB_CAPACITY=52
RATES_DAYS=7                   # 7 nights is what the brief uses; halves Apify cost
MIN_RATE_COVERAGE=10
BRIEF_TZ_OFFSET_H=3
```

## 5. Rehearse + verify

```bash
cd /home/aether/aether/nexus-scrape
./run.sh fx && ./run.sh morning        # full chain on demand; check your inbox
python3 -c "import sys"; systemctl list-timers 'aether-*' --no-pager   # next-fire times
journalctl -u aether-brief.service -n 120 --no-pager                   # run history
```

Expected: collectors write rows, brief generates, send returns a Resend id, email
arrives. (BLOCK until coverage ≥ 10/12 + OTB — that's correct.)

## 6. How it runs (the enterprise bits)

- **Precise timing:** `aether-brief.timer` fires **05:30 Europe/Bucharest** daily —
  no jitter (the reason to leave GitHub Actions). `Persistent=true` means a run
  missed while the VM was down fires on next boot.
- **Dead-man's switch:** `aether-sentinel.timer` at **07:15** runs `send.py
  --sentinel`; if today's brief has no `sent_at`, it emails `ALERT_EMAIL`.
- **Cost circuit-breaker:** `booking_rates.py` checks Apify monthly usage before
  scraping and skips (degrades to BLOCK) at `APIFY_BUDGET_FLOOR` of the $5 free
  credit — you can never be billed by surprise.
- **Self-protecting chain:** collectors are best-effort; a failure degrades the
  brief honestly (BLOCK) instead of aborting. `run_daily.py` retries each stage
  twice; failures email `ALERT_EMAIL` via Resend.
- **Kill switch:** `PIPELINE_ENABLED=false` in `.env` → every stage no-ops.

## 7. Ops cheat-sheet

```bash
systemctl list-timers 'aether-*'                 # when does it next run
journalctl -u aether-brief.service -f            # live logs
journalctl -u aether-sentinel.service -n 40      # sentinel history
sudo systemctl start aether-brief.service        # run now (manual)
sudo systemctl disable --now aether-brief.timer  # pause the schedule
git -C /home/aether/aether pull && bash /home/aether/aether/infra/oracle/setup.sh  # deploy an update
```

## 8. Go-live checklist (when coverage + OTB are ready)

- [ ] ≥ 10/12 Booking URLs set (`nexus-scrape/data/booking_urls.md`)
- [ ] OTB feeding (`data/otb.csv` or the Google Sheet)
- [ ] A morning run produces **PASS** with a cited recommendation, no SIMULARE
- [ ] Verify a sending domain in Resend (so you can mail the owner, not just yourself)
- [ ] Change `BRIEF_RECIPIENTS` to the hotel owner — only now
- [ ] Watch one unattended 05:30 cycle end-to-end

## Notes
- Only recurring cost in the whole system is Apify, capped free by the
  circuit-breaker. Supabase / Resend / Visual Crossing / BNR are free at this scale.
- Supabase free projects pause after ~7 days idle; the daily run keeps it warm.
- Oracle Always Free E2.1.Micro is not reclaimed for idleness (ARM shapes can be —
  another reason to prefer E2.1.Micro).
