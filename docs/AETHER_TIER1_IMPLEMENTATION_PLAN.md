# AETHER — TIER 1 DATA ACQUISITION: IMPLEMENTATION PLAN

**Plan · v1.0 · 2026-06-11 · status: AWAITING REVIEW — no code written**
Scope: the four Tier 1 sources ([DATA_ACQUISITION](AETHER_DATA_ACQUISITION.md) §2) feeding a reliable 07:00 EEST morning brief. This is ROADMAP Phase 0 made executable. Deadline context: launch gate is **June 15**; today is June 11.

---

## 0. Constraint compliance, stated up front

| # | Constraint | How this plan complies |
|---|---|---|
| 1–4 | No Tier 2/3, no social, no macro calibration, no expensive APIs | Only Apify (~€25–60/mo), OWM free tier, BNR XML (free), Google Sheets API (free). Nothing else. |
| 5 | Don't break existing schema | **One additive-only migration** (§7): 5 nullable columns, zero renames/drops/type changes. Flagged for review as an interpretation of "don't break". |
| 6 | Don't bypass RLS | Collectors write via service role **server-side only** — the sanctioned write path (Doctrine IV). **Zero RLS policy changes.** No anon grants touched, no SECURITY DEFINER objects. |
| 7 | No secrets in frontend | All secrets live in the collector host's env. `nexus-web` is not touched by this plan at all. |
| 8 | source, observed_at, effective_at, freshness, confidence on every value | Compliance matrix in §6. Freshness is **computed at read** from `observed_at` + SLA (PROVENANCE §1 — never stored). Confidence needs the additive columns in §7. |
| 9 | Fail safely, report staleness | Per-source failure modes (§2–§5), tiered gating (§8), fail-loud alerts (§9), `agent_runs` status on every run. |
| 10 | Every brief claim cites its data | Citation contract in §10: `content_jsonb.citations[]`, post-generation enforcement — an uncited numeric claim fails the brief, not silently. |

## 1. Pipeline shape and timeline (all times EEST = UTC+3)

```
14:30 (prev. day)  bnr_fx.py        → macro_observations   (BNR publishes ~13:00)
04:30  booking_rates.py             → rate_observations
04:45  weather.py                   → macro_observations
05:00  otb_sync.py                  → otb_observations
05:30  validate.py     gates: BLOCK / DEGRADE / PASS  → agent_runs report
06:00  generator.py    reads tables → daily_briefs (content_jsonb + rendered_html + citations)
06:45  send.py         Resend → owner inbox; writes sent_at
06:55  sentinel        if today's sent_at IS NULL → alert email to operator
```

90 minutes of slack between last collector and send absorbs retries. Stage order is data-dependency order; every stage logs to `agent_runs` (start, status, error, cost_cents, latency).

## 2. Source: Competitor pricing (Booking.com via Apify)

| Aspect | Specification |
|---|---|
| **Collector method** | `nexus-scrape/collectors/booking_rates.py`. Input: the 12 `scraped_properties` (booking_url). Apify actor run for a **45-day stay-date horizon**, 1-night stays, 2 adults. Parse per item → upsert one row per (scraped_property_id, stay_date, room_type) per day; same-day re-runs overwrite (idempotent). `raw_jsonb` = full actor item, always. `source_id = SOURCE_APIFY`. |
| **Legal posture** | 🟡 amber (public pages, no login, no PII). Migration path: licensed rate-shopper when revenue justifies. Accepted, documented (DATA_ACQUISITION §2.1). |
| **Cost** | ~€25–60/mo. Per-run cost estimated from Apify usage → `agent_runs.cost_cents`. |
| **Schedule** | Daily **04:30 EEST** (01:30 UTC). Retry ×2, backoff 10 min. |
| **Failure mode** | Parse-validate per item (rate > 0; currency ∈ {RON, EUR}; stay_date within horizon) — invalid items skipped + counted. Coverage < 10/12 properties → run status `degraded`. Zero valid rows or actor failure after retries → status `failed`. **Failed/degraded never writes garbage; partial good data is written and marked.** |
| **Output table** | `rate_observations` (existing, unchanged shape + new nullable `confidence`). |
| **Freshness SLA** | cooling 24h · stale 48h (registry). **Stale rates BLOCK the brief** (§8). |
| **Confidence** | `0.85 (source prior) × parse_quality(row)` where parse_quality = fraction of expected fields present, floor 0.6. Typical clean row ≈ 0.81. |
| **Validation query** | §11-A (coverage, freshness, anomaly, duplicates). |
| **Feeds the brief** | Rate ladder (own EUR/RON-converted position vs comp set), day-over-day movers ≥ ±5%, sellout/availability notes (`availability_state`, `rooms_remaining`). Every figure cites observation ids. |
| **Feeds later** | EFE: CP (full), DP proxy + market velocity from `rooms_remaining` day-deltas, sellout cascade. Simulation: competitor policy training data (every scrape is tuition). Provenance: envelope fields all present. |

## 3. Source: Own OTB / booking pace

| Aspect | Specification |
|---|---|
| **Collector method** | `nexus-scrape/collectors/otb_sync.py`. **Primary channel: a fixed-template private Google Sheet** the owner edits (columns: stay_date, rooms_sold, rooms_remaining, adr_ron — *no guest fields exist in the template by design*). Read via Google service account (free API). Validate → upsert into `otb_observations` (observed_at = now, property_id = PROPERTY_TERRA, revpar computed, raw_jsonb = raw row). Fallback channel: operator runs the same script against a local CSV. |
| **Legal posture** | 🟢 first-party, contractual. GDPR: aggregates only, enforced by template shape. |
| **Cost** | €0. |
| **Schedule** | Daily **05:00 EEST** (02:00 UTC). "No new rows since yesterday" is *not* a failure (SLA tolerates 48h). |
| **Failure mode** | Sheet unreachable → retry ×2 → status `degraded`; brief uses last OTB **with staleness label**. Malformed rows skipped + reported per-row in `agent_runs.output_jsonb`. Pickup regression (rooms_sold drops > 2 for a stay_date) is **flagged as a cancellation signal, not an error**. |
| **Output table** | `otb_observations` (existing + new nullable `confidence`). |
| **Freshness SLA** | cooling 48h · stale 96h. **Stale OTB DEGRADES the brief** (pace section labeled), never blocks. |
| **Confidence** | `0.95 (first-party prior) × completeness` (1.0 all four fields; 0.85 if adr missing). |
| **Validation query** | §11-B (capacity sanity, ADR band, date sanity, pickup monotonicity flag). |
| **Feeds the brief** | Occupancy/pace section ("OTB sâmbătă: 41/52 camere, ADR 412 RON"), own-vs-market position. Citations per figure. |
| **Feeds later** | EFE: demand/spend/revenue stocks (the money flow's accounting anchor). Simulation: daily reconciliation + elasticity calibration. Provenance: first-party = highest prior in the registry. |

## 4. Source: Weather (OpenWeatherMap)

| Aspect | Specification |
|---|---|
| **Collector method** | `nexus-scrape/collectors/weather.py`. Coordinates from `properties.lat/lng` (Terra, Neptun). Daily 7-day forecast call → one row per (target day × metric): `metric_code ∈ {temp_max_c, precip_mm, wind_kmh, humidity_pct}`. `effective_date` = target day; `observed_at` = now; `category_id = CAT_CLIMATE`; `source_id = SOURCE_OWM`; `raw_jsonb` = full response (one copy per run, referenced per row). |
| **Legal posture** | 🟢 licensed API. |
| **Cost** | €0 (≤ 2 calls/day vs 1,000/day free tier). |
| **Schedule** | Daily **04:45 EEST** (01:45 UTC). Retry ×2. |
| **Failure mode** | API down after retries → status `degraded`; brief weather section renders yesterday's forecast **labeled with its observed_at** ("prognoză de ieri") or "indisponibil". Never blocks. |
| **Output table** | `macro_observations` (existing; already has `confidence` and `effective_date` — zero changes). |
| **Freshness SLA** | cooling 24h · stale 48h (of the *fetch*; target-day distance handled by confidence, not freshness — PROVENANCE §3.2 horizon rule). |
| **Confidence** | `0.90 (source prior) × horizon_decay(d)` where d = days ahead: 1.00, 0.95, 0.90, 0.84, 0.77, 0.69, 0.60 for d=0…6. |
| **Validation query** | §11-C (7 target days present, temp ∈ [−20, 45], no null values). |
| **Feeds the brief** | Demand context ("sâmbătă 29°C, senin — weekend cu cerere probabilă"), beach-day framing for the next 7 stay-dates. |
| **Feeds later** | EFE: climate signals, weekend compression inputs. Simulation: SimForcing exogenous term. NIS (later): weather windows interacting with `event_hype`. |

## 5. Source: BNR FX

| Aspect | Specification |
|---|---|
| **Collector method** | `nexus-scrape/collectors/bnr_fx.py`. Fetch official BNR XML (`nbrfxrates.xml`), extract EUR (and USD optionally) → row: `metric_code = 'fx_eur_ron'`, `value_numeric`, `effective_date` = publication date, `source_id = SOURCE_BNR`, `category_id = CAT_ECONOMIC`, `country_id = COUNTRY_RO`, `raw_jsonb` = XML payload. Idempotent on (metric, effective_date). |
| **Legal posture** | 🟢 official public data. |
| **Cost** | €0. |
| **Schedule** | Daily **14:30 EET/EEST** (11:30 UTC) — after BNR's ~13:00 publication. The morning pipeline only *reads* the latest row. |
| **Failure mode** | Unreachable → retry ×2 → `degraded`; brief converts with the **last business-day rate, labeled** ("curs BNR din 13.06"). Never blocks. |
| **Output table** | `macro_observations` (zero changes). |
| **Freshness SLA** | **Calendar-aware**: stale only if older than last business day + 6h (BNR skips weekends/holidays — Friday's rate is fresh on Sunday). |
| **Confidence** | 0.99 flat (official reference rate). |
| **Validation query** | §11-D (plausibility band 4.5–5.5 RON/EUR, business-day freshness). |
| **Feeds the brief** | Display conversion of EUR-quoted competitor rates (native-currency doctrine: stored as scraped, converted at render, rate cited). |
| **Feeds later** | EFE: corridor purchasing-power signal (DE/PL). Simulation: cost-side forcing. |

## 6. Constraint-8 compliance matrix

| Field | rate_observations | otb_observations | macro (weather) | macro (FX) |
|---|---|---|---|---|
| source | `source_id` (FK) | property/manual source | `source_id` | `source_id` |
| observed_at | ✅ existing | ✅ existing | ✅ existing | ✅ existing |
| effective_at | `observed_at` (a quoted price is true when quoted) + `stay_date` as target | `observed_at` + `stay_date` target | `effective_date` (target day) | `effective_date` (publication day) |
| freshness | **computed at read**: `now − observed_at` vs SLA registry (PROVENANCE §1 — never stored) | same | same | same (calendar-aware) |
| confidence | **new nullable column** (§7) | **new nullable column** (§7) | ✅ existing column | ✅ existing column |

## 7. Files to create / change

**New — `nexus-scrape/`** (Python 3.11, stdlib + `requests` + `google-auth` only):
```
collectors/booking_rates.py · weather.py · bnr_fx.py · otb_sync.py
lib/supabase_client.py      (service-role REST helper; upserts; never imported by frontend)
lib/agent_log.py            (log_agent_run: status, error, cost_cents, latency — Doctrine II.12)
lib/confidence.py           (per-source calculators §2–5 + SLA registry mirror)
validate.py                 (the §8 gates; emits report into agent_runs.output_jsonb)
run_daily.py                (stage runner: timeouts, retries, alert hook, PIPELINE_ENABLED check)
requirements.txt · .env.example
```
**New — `nexus-brief/`**: `generator.py` + `prompt_templates/morning_brief_ro.txt` (citation contract §10 baked into the prompt; reads only via queries that return observation ids).
**New — `nexus-mail/`**: `send.py` (reads today's `daily_briefs.rendered_html`, sends via Resend, writes `sent_at`, refuses null-html and double-send — both already constitutional).
**New — migration `tier1_provenance` (additive only, the §0/#5 review item):**
```
signal_sources    + reliability_prior numeric, + freshness_sla_minutes int
rate_observations + confidence numeric (nullable)
otb_observations  + confidence numeric (nullable)
agent_runs        + status text, + error text
```
**Changed:** nothing else. `nexus-web` untouched. No RLS, no policies, no existing columns.
**Precondition (before any of the above):** `git init` + remote + first commit (Doctrine II.9; also the rollback substrate, §13).

## 8. Validator gates (05:30) — tiered, per source criticality

| Condition | Gate |
|---|---|
| Comp-rate coverage < 10/12 properties today, or rates older than 48h | **BLOCK** — no brief is generated; operator + owner notified (§9). A brief without market data is a rumor. |
| Rate anomaly: today's rate vs property's 7-day median beyond ±60% | **FLAG** — brief ships, anomaly named in text ("verificați manual — posibil eroare de listare"). |
| OTB stale > 96h | **DEGRADE** — pace section labeled with data age. |
| Weather/FX degraded or stale | **DEGRADE** — sections labeled, FX uses last business day. |
| All pass | **PASS** — clean brief. |

Gate results are written to `agent_runs` (`agent_code='validator'`) with the full report in `output_jsonb` — the brief generator reads the gate verdict, never re-derives it.

## 9. Scheduler plan

- **Host:** one small VPS (DigitalOcean droplet, ~€6/mo, region FRA) running system cron + the repo. Chosen over GitHub Actions (cron jitter up to ~15 min is hostile to a 07:00 SLA) and over Supabase edge functions (Deno; the pipeline is Python per constitution).
- **Crontab (UTC):** `30 1` rates · `45 1` weather · `0 2` otb · `30 2` validator · `0 3` brief · `45 3` send · `55 3` sentinel · `30 11` bnr_fx. All entries invoke `run_daily.py <stage>` so retries/logging/kill-switch live in code, not in cron.
- **Kill switch:** `PIPELINE_ENABLED=false` env → every stage exits 0 with status `skipped` (one variable stops the world without touching cron).
- **Alerting (fail loud, Doctrine):** any `failed` stage or BLOCK verdict → immediate email via Resend to `ALERT_EMAIL` with stage, error, and the last `agent_runs` rows. The 06:55 sentinel catches silent deaths: `sent_at IS NULL` at 06:55 → alert. On a BLOCK day, the owner receives a short transparent note in Romanian ("datele de piață nu au putut fi verificate azi — brieful revine mâine") — silence is the only unacceptable output.

## 10. Brief citation contract (constraint 10)

`daily_briefs.content_jsonb` gains (additive JSON keys, no DDL):
```
citations: [ { claim: "Vega a scăzut tariful cu 9% pentru 14.06",
               observation_ids: ["<uuid>", "<uuid>"],
               computed: "pct_change(rate, d-1)" } ],
data_window: { rates_observed_at, otb_observed_at, weather_observed_at, fx_effective_date },
degraded: ["weather"]    // when applicable
```
Enforcement: the generator prompt requires a citation per numeric claim; a post-generation structural check walks every number in the rendered sections — **any uncited numeric claim fails the run** (status `failed`, alert, no send). The brief's footer renders the `data_window` (PROVENANCE Phase-0 deliverable: plain-text source + observed_at per section).

## 11. Validation queries (read-only; run by validator and available for manual ops)

**A — rates (coverage, freshness, anomaly, dupes):**
```sql
-- coverage today
select count(distinct scraped_property_id) as props_today
from rate_observations where observed_at::date = current_date;
-- freshness
select max(observed_at) as last_obs from rate_observations;
-- anomaly: today vs 7-day median per property (flag, not block)
with med as (
  select scraped_property_id, percentile_cont(0.5) within group (order by rate_amount) m
  from rate_observations
  where observed_at >= now() - interval '7 days' and stay_date <= current_date + 14
  group by 1)
select r.scraped_property_id, r.stay_date, r.rate_amount, med.m
from rate_observations r join med using (scraped_property_id)
where r.observed_at::date = current_date
  and (r.rate_amount > med.m * 1.6 or r.rate_amount < med.m * 0.4);
-- duplicate guard
select scraped_property_id, stay_date, room_type, count(*)
from rate_observations where observed_at::date = current_date
group by 1,2,3 having count(*) > 1;
```
**B — OTB:** rooms sanity (`rooms_sold + rooms_remaining` vs configured capacity), `adr between 50 and 2000`, `stay_date >= current_date - 1`, pickup regression flag (today's rooms_sold per stay_date < yesterday's − 2 → cancellation signal).
**C — weather:** exactly 7 distinct `effective_date` ≥ today fetched today; `value_numeric` non-null; temp metric within [−20, 45].
**D — FX:** latest `fx_eur_ron` `value_numeric between 4.5 and 5.5`; `effective_date` ≥ last business day.
**E — pipeline:** today's `agent_runs` contains one `succeeded|degraded` row per stage in order; `daily_briefs.sent_at` non-null by 06:55.

## 12. Test plan

1. **Parser tests (offline, pytest, no network):** fixture payloads per source (Apify item, OWM JSON, BNR XML, Sheet rows incl. malformed) → assert row shape, confidence values, skip behavior. Runs in CI on every commit.
2. **Dry-run mode:** every collector supports `--dry-run` (prints would-be rows, writes nothing) — first execution against live APIs is always dry.
3. **Supervised live runs:** one per collector with row-count + spot-check against the §11 queries (data written is real data — that is the point; no fake rows are ever inserted).
4. **Validator scenario tests:** pure-function tests feeding synthetic snapshots (stale rates / 9-property coverage / FX gap over a weekend) → assert BLOCK/DEGRADE/PASS verdicts, including the calendar-aware FX case.
5. **Brief structural test:** golden-day DB snapshot → generated brief must contain all required sections and pass the citation walker (every numeric claim cited). LLM prose is not asserted — structure and citations are.
6. **Failure drills (before launch):** revoke the Apify token → expect BLOCK + operator alert + owner notice, no send. Empty the OTB sheet → expect DEGRADE with labeled staleness.
7. **The real test: the rehearsal calendar.** Jun 12 — collectors live, supervised manual run. Jun 13 — full pipeline manually triggered end-to-end, brief reviewed by a human before send. Jun 14 — cron runs it, humans only watch. Jun 15 — streak day 1. Three rehearsal days is the margin the plan defends.

## 13. Rollback plan

- **Code:** git is the substrate (precondition). Any stage reverts independently; stages are also individually disableable (cron line or `PIPELINE_ENABLED`).
- **Schema:** the migration is additive/nullable — rollback = drop the five columns (script provided alongside the migration), zero data loss either way. Normal posture: leave them, they are inert.
- **Data:** collectors are idempotent upserts — re-running a fixed collector heals the day. Purging a bad run = `delete ... where source_id = X and created_at in <run window>` — requires explicit human confirmation per Doctrine (DELETE), with the run's `agent_runs` row as the audit anchor.
- **Brief:** a broken 06:00 generation falls back to manual: operator runs `generator.py` locally before 06:45; if that fails, the transparent owner notice ships instead of silence.
- **Total rollback:** `PIPELINE_ENABLED=false` + git revert returns the system to today's state in minutes; nothing in this plan modifies anything that exists.

## 14. Environment variables (server/VPS only — never frontend, never committed)

```
SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY      (writes; Doctrine IV)
APIFY_API_TOKEN · OWM_API_KEY                 (collectors)
ANTHROPIC_API_KEY                             (brief generation)
RESEND_API_KEY                                (send + alerts)
OTB_SHEET_ID · GOOGLE_SERVICE_ACCOUNT_JSON    (OTB channel)
BRIEF_RECIPIENTS · ALERT_EMAIL                (delivery + fail-loud)
PIPELINE_TZ=Europe/Bucharest · PIPELINE_ENABLED=true
```
`.env.example` ships with placeholders; the real `.env` lives only on the VPS; `nexus-web`'s Vercel env continues to hold nothing beyond the two public Supabase values.

---

**Review items before code:** (1) the additive-columns interpretation of constraint 5 (§7); (2) Google Sheet as the OTB channel (§3); (3) the BLOCK-day transparent owner notice (§9); (4) VPS-cron over GitHub Actions (§9). Approve or amend, and implementation starts with `git init`.
