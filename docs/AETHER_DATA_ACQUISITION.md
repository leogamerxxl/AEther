# AETHER — DATA ACQUISITION STRATEGY

**Strategy · v1.0 · 2026-06-11 · status: APPROVED PLAN (costs are estimates, not quotes)**
Extends [DATA_SOURCES](AETHER_DATA_SOURCES.md) (registry doctrine, SLAs, GDPR boundary) with the procurement strategy: what to acquire, in what order, at what cost and risk. Feeds: [NARRATIVE_INTELLIGENCE](AETHER_NARRATIVE_INTELLIGENCE.md) detection, [ECONOMIC_FLOW_ENGINE](AETHER_ECONOMIC_FLOW_ENGINE.md) inputs, [SIMULATION](AETHER_SIMULATION.md) calibration.

---

## 1. Principles

1. **Tier ≠ value.** Tiers sequence acquisition by `value ÷ (cost × legal risk × readiness)`. A high-value source can sit in Tier 3 because it is legally gray or needs infrastructure that doesn't exist yet. The business-value ranking (§6) is kept separate, deliberately.
2. **Admission rule** (DATA_SOURCES §6): no source ships without a `signal_sources` row + SLA, the collector contract, and at least one registered signal type. A source that can't name its signal is a content feed, and content feeds are banned.
3. **Legal posture, three colors.** 🟢 licensed/official API or open data — use freely. 🟡 public-facts scraping (no login, no PII, modest volume) — acceptable with mitigations, migration path named. 🔴 authenticated scraping, personal data, ToS-core violations — **never**. AETHER operates green and amber only.
4. **GDPR red lines** (constitutional): aggregate metrics only; no person rows, no creator profiles, no review text storage, no individual movement. If a source can't prove aggregation, it doesn't enter L1.
5. **Cost accountability:** every call logged with `agent_runs.cost_cents`; monthly source P&L (cost vs signals produced vs recommendations influenced); a source that never influences a decision gets cut (DATA_SOURCES §7).
6. **Budget envelope:** steady-state pilot data bill **≤ €100/month** — the data stack must cost less than the customer pays (€150/month), or the unit economics are a lie. Scale-up unlocks per-property amortization.

## 2. Tier 1 — the launch spine (running daily before June 15)

The brief cannot exist without these four. They are not optional, not deferrable, and all green/amber-safe.

### 2.1 Competitor pricing (Booking.com via Apify) — `SOURCE_APIFY`
- **Cost:** ~€25–60/mo (12 properties × ~45 stay-dates, daily actor runs).
- **Legal:** 🟡 — public rate pages, no login, no PII; prices are facts (not copyrightable); EU database-rights exposure mitigated by modest volume + transformation into observations. Booking.com ToS disallows scraping — accepted, documented risk. **Migration path:** licensed rate-shopper (Lighthouse/OTA Insight, ~€100–300/mo/property) when revenue justifies; the schema doesn't care which feeds it.
- **API availability:** no official rates API for non-partners; Apify actors are the de-facto standard.
- **Update frequency:** daily, pre-dawn (before the 07:00 brief).
- **ROI:** **the product.** Feeds: CP (in full), DP proxy via `rooms_remaining` deltas, market velocity, sellout cascade, simulation competitor policies (every scrape is training data). Without it there is no brief, no sim, no company.

### 2.2 Booking pace / own OTB — `SOURCE_MANUAL` → PMS
- **Cost:** €0 pilot (owner entry / spreadsheet import); PMS integration later (Phase 3, via `integrations`).
- **Legal:** 🟢 first-party, contractual. GDPR: aggregates only — rooms/ADR/pace, never guest rows.
- **API availability:** pilot manual; Romanian PMS landscape (e.g., local systems) integration post-pilot.
- **Update frequency:** daily target (SLA 48h).
- **ROI:** demand truth. Calibrates everything: pace models, elasticities, forecast reconciliation. The sim is blind without it.

### 2.3 Weather (OpenWeatherMap) — `SOURCE_OWM`
- **Cost:** €0 (free tier covers pilot volume comfortably).
- **Legal:** 🟢 licensed API.
- **API availability:** official, stable, 7-day horizon.
- **Update frequency:** daily; horizon-decayed confidence per PROVENANCE.
- **ROI:** the #1 short-window demand driver for coastal leisure — beach-day quality moves Romanian drive-to bookings inside 7 days. Feeds climate signals, weekend compression forecasts.

### 2.4 FX (BNR) — `SOURCE_BNR`
- **Cost:** €0 (official XML feed).
- **Legal:** 🟢 official public data.
- **API availability:** official daily feed (business days ~13:00 EET — calendar-aware SLA per PROVENANCE §3.2).
- **Update frequency:** business-daily.
- **ROI:** modest but free: display conversion (native-currency doctrine) + DE/PL purchasing-power signal. Best ratio in the stack.

## 3. Tier 2 — structural enrichment (Phase 1–2, post-streak)

Deterministic, cheap, mostly green — these power the NIS structural archetypes and EFE movement inputs. Order within tier = deployment order.

### 3.1 Festival & event data
- **Cost:** €0–30/mo (municipal calendars + iabilet.ro/venue listings light scrape; PredictHQ at ~€400+/mo is the scale-up path, not the pilot's).
- **Legal:** 🟢/🟡 — event facts (name/date/venue) are facts; listing DBs carry mild database-rights exposure; municipal sources pristine.
- **API availability:** no single good free API for RO events — composite collector (calendars + listings + airport/venue announcements).
- **Update frequency:** weekly + announcement-driven.
- **ROI:** highest in Tier 2 — `event_hype` is deterministic, and compression windows convert directly into min-stay/ADR recommendations (the Mamaia-festival → Neptun-spillover play runs on this plus data we already scrape).

### 3.2 Google Trends (attention/intent)
- **Cost:** €0 (pytrends-class access, fragile) → ~€50/mo (Glimpse/DataForSEO-class wrappers for reliability).
- **Legal:** 🟡 — unofficial access violates Google ToS (low enforcement, real reliability risk); official Trends API remains limited-access as of design date. Mitigation: wrapper service carries the relationship; data is aggregate by construction (no GDPR surface).
- **API availability:** no GA official API; wrappers stable enough with retry discipline.
- **Update frequency:** daily baskets ("litoral", "oferte grecia", resort names, RO/DE/PL geo splits).
- **ROI:** the earliest intent lead (30–90d) and the cheapest narrative detector — feeds attention/intent stages, `Greece Better Value` and `Coast Revival` tracking, leakage corroboration.

### 3.3 Flight routes & capacity (CND + OTP)
- **Cost:** €0 (manual — CND is small: seasonal charters + a handful of routes; airline PR is free) → ~€30–50/mo (AeroDataBox-class schedule API when automation pays).
- **Legal:** 🟢 — schedule facts via licensed API or public announcements.
- **API availability:** AeroDataBox/Aviationstack tiers fit pilot budgets; OAG/Cirium are enterprise-priced overkill.
- **Update frequency:** weekly + announcement-driven (structural detection ≈ deterministic).
- **ROI:** `access_change` archetype — near-certain detection, season-long impact, capacity ceilings for SimCorridors.

### 3.4 Fuel & transport cost
- **Cost:** €0 — EU Commission Weekly Oil Bulletin (all corridor countries, weekly, official) + Brent via free feeds.
- **Legal:** 🟢 official open data.
- **API availability:** official downloads, trivially collectable.
- **Update frequency:** weekly (Bulletin), daily (Brent).
- **ROI:** the `cost_shock` archetype with its corridor sign-flip (DE pain = București staycation tailwind) — small effort, real strategic signal.

### 3.5 News (geopolitical & structural detection)
- **Cost:** €0 (GDELT + RO/DE/PL RSS) + LLM clustering pennies/day (logged via `agent_runs`).
- **Legal:** 🟢/🟡 — metadata + headlines + URLs only; **never article bodies** (copyright + Article 4 firewall, same rule as NIS).
- **API availability:** GDELT free (15-min cadence, overkill for us at daily), NewsAPI optional later.
- **Update frequency:** daily clustering into `geo_events`.
- **ROI:** `geopolitical_risk` onset detection (Black Sea security narrative) + route/infrastructure announcements. Detection is cheap; the value is the analog library it builds.

### 3.6 Traffic (vehicle movement)
- **Cost:** €0–20/mo — CNAIR/CESTRIN public counts + A2 toll statistics (laggy but official); TomTom free tier or Google Distance Matrix sampling (~€5/1k calls) as congestion nowcast on the București→coast run.
- **Legal:** 🟢 official stats / licensed APIs. **Never** individual movement — aggregate counts and travel times only (GDPR red line).
- **API availability:** official stats are batch/laggy; commercial traffic APIs fill the nowcast gap.
- **Update frequency:** daily in season (Jun–Sep), weekly off-season.
- **ROI:** the people/vehicle flow proxy for EFE — seasonal; valuable Fri/Sat nowcasts ("A2 flow +18% vs last Saturday").

### 3.7 Review sentiment (aggregates only)
- **Cost:** ~€0 marginal — `review_score`/`review_count` already ride the existing Apify scrape; Google Places ratings ~€15/mo if added.
- **Legal:** 🟡/🟢 — aggregate scores and counts only; **no review text storage, no author data** (constitutional). Places API is licensed for display-adjacent use.
- **API availability:** Places official; Booking aggregates via existing scrape.
- **Update frequency:** weekly (slow-moving).
- **ROI:** quality-adjusted price position in CP (already designed to use it) + review-velocity as trailing arrival proxy. Cheap because it's piggybacked.

## 4. Tier 3 — deferred deliberately (Phase 3+)

### 4.1 Social sentiment (TikTok / Instagram)
- **Cost:** €50–200/mo via Apify actors; licensed listening suites (Brandwatch-class, €500+/mo) out of pilot range.
- **Legal:** 🟡 leaning 🔴 at the edges — platform ToS hostile; official APIs restricted (TikTok Research API ≈ academic; Meta locked down). **Hard mitigations if/when deployed:** hashtag/sound aggregate metrics only, no creator profiles, no content bodies, influencers tracked as anonymous tiers (NIS §12).
- **API availability:** no viable official path at pilot scale; actor-based collection only.
- **Update frequency:** daily when active.
- **ROI ceiling is high** (`viral_social` detection) **but it is the noisiest, grayest, costliest source** — and NIS §13 already ruled: structural archetypes first, social after the bot-discount has something to calibrate against. Deferral is strategy, not neglect.

### 4.2 Macroeconomics (INS, Eurostat, DE/PL confidence)
- **Cost:** €0 — pristine open data.
- **Legal:** 🟢 perfect.
- **API availability:** official (INS Tempo, Eurostat API).
- **Update frequency:** monthly/quarterly, weeks of lag.
- **ROI:** low as a *signal*, high as a **calibrator** — the laggy-but-true grader of fast proxies (EFE §4 doctrine). Tier 3 because its consumer (the calibration loop) arrives in Phase 3, not because it's weak. Same tier as social for opposite reasons.

## 5. Master matrix

| Source | Tier | Cost/mo | Legal | API | Frequency | Feeds |
|---|---|---|---|---|---|---|
| Competitor pricing | 1 | €25–60 | 🟡 (→ licensed shopper later) | Apify de facto | daily | CP, DP, velocity, sim policies |
| Booking pace (OTB) | 1 | €0 | 🟢 | manual → PMS | daily | pace, calibration, demand truth |
| Weather | 1 | €0 | 🟢 | official | daily, 7d | climate signals, weekend compression |
| FX | 1 | €0 | 🟢 | official | business-daily | conversion, purchasing power |
| Festival data | 2 | €0–30 | 🟢/🟡 | composite | weekly+events | event_hype, compression recs |
| Google Trends | 2 | €0–50 | 🟡 | wrappers | daily | attention/intent, narratives, leakage |
| Flight routes | 2 | €0–50 | 🟢 | licensed | weekly | access_change, corridor capacity |
| Fuel | 2 | €0 | 🟢 | official | weekly | cost_shock, corridor sign-flip |
| News | 2 | ~€0 + LLM | 🟢/🟡 | GDELT/RSS | daily | geopolitical_risk, structural events |
| Traffic | 2 | €0–20 | 🟢 | official+licensed | daily in season | movement flows, weekend nowcast |
| Review sentiment | 2 | ~€0–15 | 🟡/🟢 | piggyback+Places | weekly | CP quality position |
| Social sentiment | 3 | €50–200 | 🟡⚠ | actors only | daily | viral_social (deferred) |
| Macroeconomics | 3 | €0 | 🟢 | official | monthly | calibration layer |

**Budget check:** Tier 1 ≈ €25–60/mo. Tier 1+2 fully deployed ≈ **€45–215/mo, realistically ~€90** with free options exercised first — inside the €100 envelope, under the customer's €150 price. Tier 3 social is the only line that threatens the envelope, which is one more reason it waits.

## 6. Ranked by business value (separate from tiering, as warned)

Value = marginal improvement to tomorrow morning's pricing decision, per RON spent, for *this* pilot.

| # | Source | Why this rank |
|---|---|---|
| 1 | **Competitor pricing** | The brief's spine; also the sim's tuition — every missed day is unrecoverable training data |
| 2 | **Booking pace (OTB)** | Demand truth; the difference between forecasting and guessing |
| 3 | **Weather** | The strongest 0–7d demand driver on a leisure coast; free |
| 4 | **Festival data** | Deterministic compression windows → direct RON recommendations |
| 5 | **Google Trends** | The earliest intent lead and cheapest narrative detector |
| 6 | **FX** | Small signal, zero cost, corridor purchasing power |
| 7 | **Flight routes** | Near-certain detection, season-long structural impact (CND is small but decisive when it moves) |
| 8 | **Fuel** | Free strategic signal with the corridor sign-flip insight |
| 9 | **News** | Cheap onset detection for the risk archetype; builds the analog library |
| 10 | **Traffic** | Good seasonal nowcast; redundant with booking signals much of the year |
| 11 | **Review sentiment** | Real but slow-moving CP refinement; already half-collected |
| 12 | **Macroeconomics** | Calibrator, not signal — value arrives with Phase 3's calibration loop |
| 13 | **Social sentiment** | Highest ceiling, worst floor: noise, cost, and legal gray until NIS has structural calibration to discipline it |

## 7. Operational notes

- **Sequencing:** Tier 1 is the June 15 gate (ROADMAP Phase 0) — collectors deployed, daily, validated. Tier 2 deploys one source per week starting Phase 1, each behind the admission rule, each with a DECISIONS-light entry in the registry. Tier 3 waits for its named preconditions (calibration loop live; NIS structural archetypes proven).
- **Every source ships with:** `signal_sources` row (+ `reliability_prior`, `freshness_sla`), a collector honoring the seven-point contract (raw_jsonb, idempotent, fail-loud, allow-listed domains), at least one signal type, and a `metric_provenance` registry entry. No exceptions — this is what keeps acquisition from becoming hoarding.
- **Quarterly review:** the source P&L (cost vs signals vs influenced decisions) prunes the stack. Data that never changes a price is decoration with an invoice.
