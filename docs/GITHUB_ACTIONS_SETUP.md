# AETHER Morning Brief — GitHub Actions setup

The pipeline runs as one scheduled workflow: `.github/workflows/morning-brief.yml`.
It fires daily at **02:37 UTC (05:37 EEST)** — padded so the email lands well
before 07:00 even with GitHub's scheduled-run jitter — and can be triggered on
demand from the Actions tab ("Run workflow") for rehearsal.

## 1. Rotate keys FIRST, then add them as repo secrets

The keys pasted in chat must be rotated. Put the NEW values here:
**Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value | Required? |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (rotate it) | yes |
| `APIFY_API_TOKEN` | Apify → Settings → Integrations (rotate it) | yes |
| `VISUALCROSSING_API_KEY` | Visual Crossing account (rotate it) | yes |
| `RESEND_API_KEY` | Resend → API Keys (rotate it) | yes |
| `BRIEF_RECIPIENTS` | your email for rehearsal (owner added only after Go) | yes |
| `ALERT_EMAIL` | your email (failure alerts) | yes |
| `OTB_SHEET_ID` | Google Sheet id (the OTB sheet) | optional |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | full SA JSON content; share the sheet with the SA email | optional |

Non-secret config (SUPABASE_URL, APIFY_ACTOR, RATES_DAYS, MIN_RATE_COVERAGE, the
sender, the TZ offset) is already in the workflow's `env:` block — nothing to do.

## 2. Rehearse on demand

Actions tab → **AETHER Morning Brief** → **Run workflow**. Watch the steps:
FX / Rates / Weather / OTB / Validate / Generate brief / Send. Collectors are
best-effort (a red collector still produces an honest BLOCK brief); the run is
green when the brief sends. Check your inbox.

## 3. Go-live

Once ≥10 Booking URLs are set (see `nexus-scrape/data/booking_urls.md`) and the
OTB sheet is wired, the brief flips from BLOCK to a real recommendation. Only
then change `BRIEF_RECIPIENTS` to the hotel owner.

## Notes
- GitHub emails the repo owner automatically if a scheduled run fails (the
  built-in sentinel). `send.py` also self-alerts via Resend on its own failures.
- Apify cost scales with `RATES_DAYS` (one actor run per stay-date). 14 is the
  default; lower it in the workflow `env:` if you want to economise during testing.
- The kill switch is `PIPELINE_ENABLED` in the workflow `env:` — set to `false`
  to make every stage no-op without deleting the schedule.