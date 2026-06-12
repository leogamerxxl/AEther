# AETHER — LIVE REHEARSAL RUNBOOK

**Ops · v1.0 · 2026-06-12 · objective: committed MVP → real 07:00 email on live data**
Scope discipline: no new features, no UI, no Graph V4, no new sources. Calendar: rehearse Jun 12–14, streak day 1 = Jun 15.

## 0. Already done in-session (verified, not aspirational)

| Step | Status | Evidence |
|---|---|---|
| 1. GitHub remote | ⚠ **NO REMOTE** — repo is local-only (2 commits, clean tree); `gh` CLI not installed | §1 commands |
| 2. Tracked secrets | ✅ PASS — only `.env.example` tracked; `.env.local` ignored; zero logs; the two "service_role" hits are SQL comments | `git ls-files` audit |
| 3. Supabase security | ✅ **CLOSED + WIRE-PROVEN** — migration `security_lockdown_phase0`: `integrations_safe` → `security_invoker=true` + anon revoked (view + base table); `property_live_telemetry` anon revoked; `rls_auto_enable()` exec revoked from public/anon/authenticated. Anon probe: **HTTP 401** on integrations_safe, integrations, property_live_telemetry, brief_inputs | advisors re-run clean of the three defects |

Residual advisor items (documented, deliberate): `get_user_*_ids()` SECURITY DEFINER helpers stay executable (null-safe for anon; **required by RLS policies** — revoking breaks logged-in reads; Phase 1: pin `search_path`); `agent_runs` has RLS without policies (service-role-only by design; side effect: authenticated reads of `collector_status` show null last_success — server pipeline unaffected); leaked-password protection = dashboard toggle, Phase 1 with real auth. Frontend impact of lockdown: the demo telemetry overlay in `CoastalCommandCenter` now receives 401/empty — correct per Truth Doctrine (it was the fabricated feed); UI untouched.

---

## 1. Exact command sequence

### Step 1 — GitHub remote + push (your machine)
```powershell
# create a PRIVATE repo named aether under your account (web UI or gh):
#   https://github.com/new  → private, no README
cd C:\Users\user\aether
git remote add origin git@github.com:<YOUR_USER>/aether.git   # or https URL
git push -u origin main
git log --oneline   # expect: 9d16910, e8abfe8 (+ runbook commit)
```

### Step 4 — VPS prep (DigitalOcean droplet, Ubuntu 24.04, FRA1, ~€6/mo)
```bash
ssh root@<VPS_IP>
adduser aether && usermod -aG sudo aether && su - aether
sudo timedatectl set-timezone UTC                  # cron runs in UTC by design
sudo apt update && sudo apt install -y python3 python3-pip python3-venv git
git clone git@github.com:<YOUR_USER>/aether.git /home/aether/aether   # deploy key or https+token
cd /home/aether/aether/nexus-scrape
python3 -m venv .venv && source .venv/bin/activate
pip install certifi google-auth                    # only deps; collectors are stdlib
cp .env.example .env && chmod 600 .env && nano .env   # fill §2
```

### Step 6 — manual live runs, in this order (VPS, venv active, `set -a; source .env; set +a`)
```bash
cd /home/aether/aether/nexus-scrape
# 6a. FX — no key needed; proves DB write path end-to-end
python collectors/bnr_fx.py                # expect: status succeeded, inserted: 2
# 6b. Weather — needs OWM_API_KEY (One Call 3.0 subscription enabled — see gotcha §5)
python collectors/weather.py --dry-run     # live API, no write: expect rows: 28
python collectors/weather.py               # expect inserted: 28 (first run)
# 6c. OTB — owner fills the sheet first (or CSV): stay_date,rooms_sold,rooms_remaining,adr_ron
python collectors/otb_sync.py --dry-run    # sheet mode; or --csv /path/otb.csv
python collectors/otb_sync.py
# 6d. Rates — ACTOR VERIFICATION FIRST (the one declared deploy-day seam):
#   1) Apify console → run APIFY_ACTOR once with one booking_url + checkIn/checkOut
#   2) compare item fields vs normalize_item() in collectors/booking_rates.py; adjust mapping if needed
#   3) small horizon first:
RATES_DAYS=2 python collectors/booking_rates.py    # expect coverage >= 10, unmatched ~0
#   4) then full:
python collectors/booking_rates.py                 # RATES_DAYS=14 from .env
```

### Steps 9–11 — validate, brief, test send
```bash
python validate.py            # step 9 — expect verdict PASS or DEGRADE (see §4)
python status.py              # freshness table: rates/weather/fx fresh
cd .. && python nexus-brief/generator.py --preview          # step 10 — live brief, writes daily_briefs
# read the text output END TO END before sending (CHECKLIST.md human section)
python nexus-mail/send.py --to leonardocozaciuc@gmail.com   # step 11 — test send, your address ONLY
```

### Steps 12–13 — cron + supervised cycle
```bash
sudo timedatectl set-timezone Europe/Bucharest   # TZ DECISION: server runs Bucharest local
crontab nexus-scrape/crontab.txt                  # local times + flock; see file header
# 30 11 * * * cd /home/aether/aether/nexus-scrape && .venv/bin/python run_daily.py fx       >> /home/aether/cron.log 2>&1
# 30  1 * * * cd /home/aether/aether/nexus-scrape && .venv/bin/python run_daily.py rates    >> /home/aether/cron.log 2>&1
# 45  1 * * * ... weather | 0 2 ... otb | 30 2 ... validate | 0 3 ... brief | 45 3 ... send | 55 3 ... sentinel
# NOTE: cron does not read .env — wrap stages in a script that sources it, or use `env $(cat .env) ...`
#       simplest: create /home/aether/run.sh that cds, sources .env, execs run_daily.py "$1"
# Supervised cycle (Jun 13→14 night): watch it run, you only observe:
tail -f /home/aether/cron.log     # from 01:25 UTC (04:25 EEST)
python status.py                  # after 02:35 UTC: all fresh
# inbox check 06:45–07:00 EEST; sentinel fires 06:55 if not sent
```

## 2. Environment variables checklist (VPS `.env` ONLY — never frontend, never committed)

| Var | Source | Used by | Gotcha |
|---|---|---|---|
| `SUPABASE_URL` | known | all | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API | all writes | the one key that must never leave the VPS |
| `APIFY_API_TOKEN` / `APIFY_ACTOR` | Apify console | rates | actor schema verified per §1.6d before first live run |
| `OWM_API_KEY` | OpenWeatherMap | weather | **One Call 3.0 requires subscribing** (free 1k/day tier, card on file) — 401 means subscription, not key |
| `RESEND_API_KEY` / `BRIEF_FROM` | Resend | send, alerts | unverified domain ⇒ `onboarding@resend.dev` sender, deliverable only to your own Resend account email — fine for step 11, verify domain before owner delivery |
| `BRIEF_RECIPIENTS` | = leonardocozaciuc@gmail.com (rehearsal) | send | owner address added only after Go |
| `ALERT_EMAIL` / `ALERT_FROM` | yours | fail-loud | — |
| `OTB_SHEET_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON` | GCP service account; **share the sheet with the SA email** | otb | or skip: `--csv` channel |
| `OTB_CAPACITY` / `RATES_DAYS` / `MIN_RATE_COVERAGE` | 52 / 14 / 10 | otb, rates, gates | — |
| `PIPELINE_ENABLED` | true | all | the kill switch |
| Frontend (Vercel) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, mapbox token | nexus-web | **nothing from this table** |

## 3. Live validation queries (after step 6; via dashboard SQL or `validate.py`)

```sql
-- rows landed today, with provenance fields populated
select count(*), count(confidence) as with_conf, min(observed_at), max(observed_at)
from rate_observations where observed_at::date = current_date;
select metric_code, count(*) from macro_observations
 where observed_at::date = current_date group by 1;          -- expect 4 weather metrics + fx_eur_ron/fx_usd_ron
select stay_date, rooms_sold, rooms_remaining, adr, confidence from otb_observations
 where observed_at::date = current_date order by stay_date;
-- step 8: agent_runs created per collector
select agent_code, status, latency_ms, ts from agent_runs
 where ts::date = current_date order by ts;
-- the gate's own view
select * from collector_status;                               -- expect fresh × 4
select kind, count(*) from brief_inputs group by kind;        -- comp_rate ≥ 120, weather 28, fx 1, otb ≥ 2×N
-- brief written + citations present
select brief_date, sent_at, recipient_count,
       jsonb_array_length(content_jsonb->'citations') as citations,
       content_jsonb->'verdict'->>'verdict' as verdict
from daily_briefs order by brief_date desc limit 3;
```

## 4. Expected outputs (anchored to actual dry-run shapes)

- `bnr_fx`: `{"status":"succeeded","parsed":2,"inserted":2}` (re-run same day ⇒ `skipped:2` — idempotency proof).
- `weather`: `{"rows":28,"inserted":28}` first run; re-run ⇒ `patched:28`. Confidence ladder 0.90→0.60 visible in rows.
- `otb_sync`: `valid:N, rejected:[]` on a clean sheet; rejected rows come back with named reasons, never silently dropped.
- `booking_rates`: `coverage ≥ 10`, `unmatched ≈ 0`, `parse_failures` small; status `degraded` below 10 coverage (brief then BLOCKs).
- `validate.py` day 1: `verdict: PASS` (or `DEGRADE` if OTB sheet empty — acceptable), `recommendations_allowed: true`, `anomalies: []`.
- `generator.py --preview` (live): **no SIMULARE banner**, subject without flags, `citations > 0`, movement section says "Prima zi de colectare" (honest — needs 2 days).
- `send.py --to you`: `{"status":"succeeded","resend_id":"..."}`; `sent_at` set; re-run ⇒ `skipped: already sent`.
- BLOCK day (rehearsed via failure drill): brief renders MORT/VECHI labels + "NICIO RECOMANDARE ASTĂZI", subject `[DATE INCOMPLETE]`, ops alert email.

## 5. Failure modes → action

| Symptom | Meaning | Action |
|---|---|---|
| rates: high `unmatched`/`parse_failures` | actor schema ≠ `normalize_item()` seam | fix mapping per §1.6d-2; re-run (idempotent) |
| rates: Apify HTTP 402/429 | credits / rate limit | top up; retry built-in (2×, 60s) |
| weather: HTTP 401 | One Call 3.0 not subscribed | enable subscription, not a key issue |
| otb: sheet 403 | sheet not shared with service account | share with SA email; or `--csv` |
| send: Resend 403 | unverified sender domain | use `onboarding@resend.dev` → own inbox only; verify domain for owner |
| `SSL: CERTIFICATE_VERIFY_FAILED` | missing CA bundle (Windows dev) | `pip install certifi` — never disable verification |
| coverage < 10 | some `booking_url`s broken/redirected | fix urls in `scraped_properties`; collector wrote the good ones already |
| brief: `uncited numeric claims` | citation walker caught a hole | bug — fix generator, never bypass the walker |
| 06:55 sentinel alert | brief not sent | `tail cron.log`, `python status.py`, `agent_runs` last errors; manual: `run_daily.py brief && run_daily.py send` before 07:00 |
| anything else mid-cycle | — | verdict degrades to **BLOCK brief, never hallucinated advice** — that is designed behavior, not an outage |

## 6. Rollback

1. **Stop the world:** `PIPELINE_ENABLED=false` in VPS `.env` (next stage exits `skipped`) — or comment the crontab.
2. **Code:** `git revert <sha>` / `git checkout` — repo is the substrate; nothing outside it changed except additive DB columns/views.
3. **Bad data:** re-run the fixed collector (idempotent upserts heal the day). Hard purge only with explicit human confirmation: `delete from rate_observations where source_id='18c5c97c-...' and created_at between <run window>` (audit anchor: the `agent_runs` row).
4. **Security re-open (emergency only, human-approved):** the inverse grants of `security_lockdown_phase0` — documented here deliberately so re-opening is a *decision*, never an accident.
5. **Email mishap:** there is no unsend; that is why step 11 targets only your address and `BRIEF_RECIPIENTS` gains the owner only after Go.

## 7. Go/No-Go checklist (run at 07:30 EEST after the supervised cycle, Jun 14)

- [ ] GitHub remote exists; main pushed; VPS runs from a clone
- [ ] All 4 collectors: `succeeded` in `agent_runs` today, rows live, `collector_status` = fresh ×4
- [ ] Apify actor seam verified (real item fields match `normalize_item`)
- [ ] `validate.py` = PASS; anomalies reviewed; coverage ≥ 10/12
- [ ] Live brief: citations > 0, every number carries provenance line, no SIMULARE, Romanian reads correctly
- [ ] Test email received at your address; renders in Gmail; under 2 minutes to read
- [ ] BLOCK drill executed once (revoke Apify token → BLOCK brief + alert, restore)
- [ ] Sentinel + ops alerts land in your inbox
- [ ] Owner's `BRIEF_RECIPIENTS` set; Resend domain verified (or consciously accepted sandbox)
- [ ] Anon probe still 401 on locked endpoints (re-run §0 probe)

**All boxes ⇒ GO for Jun 15, 07:00 EEST. Any unchecked ⇒ NO-GO; the brief waits a day — silence with an alert beats a wrong email.**
