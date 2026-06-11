# AETHER — DATA SOURCES

**Constitution · Document 6 of 7 · v1.0 · 2026-06-10**
Governs: what feeds the ontology — source registry, per-source contracts, freshness SLAs, and the GDPR boundary.
Law of the land (Doctrine, Article 3 + 6): every datum carries `source_id`, `observed_at`, and survives in `raw_jsonb`; every derived row can name the observations it came from.

---

## 1. Registry doctrine

- Every producer is a row in `signal_sources` with a stable UUID. No anonymous data enters the system.
- Every source declares: cadence, freshness SLA, tables written, tenant scope, cost model, and failure behavior.
- Freshness is enforced visibly: beyond SLA, dependent surfaces cool (Design Language §5); beyond hard limits, recommendations are suppressed (Command Center §7).
- Collector agents log every run to `agent_runs` (agent_code, input, output, model="system", cost_cents, latency_ms, ts) and communicate **only via tables** (Doctrine, Part II.6).

## 2. Active sources (launch set)

| Source | UUID (`signal_sources`) | Feeds | Cadence | SLA | Writes to |
|---|---|---|---|---|---|
| **Apify — Booking.com rates** | `18c5c97c-fcd9-4a2d-b98e-81e37bdc83ed` | competitor nightly rates for the 12-property comp set, stay-date forward | daily (pre-dawn, before brief) | < 24h | `rate_observations` |
| **OpenWeatherMap** | `47cf612c-525c-4482-8ffa-c8794b977e55` | coastal weather (climate signals: beach-day quality, storm risk) | daily, 7-day horizon | < 24h | `macro_observations` |
| **BNR FX** | `e95ad04c-541a-4a27-9384-0719563d7eb8` | RON/EUR reference rate (display conversion + economic signal) | daily (BNR publishes ~13:00 EET) | < 36h | `macro_observations` |
| **Manual / OTB** | `971746c5-80e7-4ab4-aa28-ffaf748713c3` | Hotel Terra's own on-the-books occupancy & rates | per owner entry (target: daily) | < 48h | `otb_observations` |

Categories in play (`signal_categories`): climate `e4b6728a…`, economic `4d4be30a…`, transport `2f1708c9…`, demographic `36c82890…`.

**Status note (2026-06-10, honest baseline):** collector code for all three automated sources exists in repo history but **is not deployed**; `rate_observations` is stale since **2026-05-22**. Restoring this set to daily cadence is ROADMAP Phase 0 — the launch gate itself.

## 3. Per-source contracts

Common law for all collectors:

1. **Raw first.** Full API response into `raw_jsonb` before any normalization. Nothing discarded.
2. **Native currency.** Rates stored as scraped (RON/EUR); conversion only at display via BNR rate.
3. **Stay-date forward.** Rate/forecast rows index the night being sold, never the scrape date.
4. **Tenant scope.** `rate_observations` and `otb_observations` carry property/comp-set scope; `macro_observations`, `signal_sources`, `signal_categories` are the only global tables.
5. **Idempotent + dated.** Every run targets an explicit date; re-runs upsert, never duplicate.
6. **Fail loud.** A collector that cannot write must record a failed `agent_runs` row and surface in the validation gate — the brief must never silently ship on stale data.
7. **Domain allow-list.** Collectors speak only to their declared domains.

## 4. The GDPR boundary (Doctrine, Part II.8)

- **Hotel data, never person data.** Properties, rates, availability, weather, FX, events: yes. Guest names, emails, individual behavior: never.
- Review *text* is display-only if ever shown; never stored. Aggregate review scores may be observed as signals.
- `raw_jsonb` exemption covers operational data only (rates, weather, FX) — any payload that could contain personal data must be stripped before storage.
- Scraping respects robots/ToS posture per source; Apify actors are the compliance boundary for Booking.com data.

## 5. Validation gate (between collection and reasoning)

The validator runs after collectors, before the brief generator. It blocks the pipeline on: stale data (per-source SLA), missing competitors (comp-set coverage < threshold), price anomalies (e.g., > 3σ day-over-day jumps without an event signal), and schema drift. A blocked pipeline pages a human; it never auto-ships a degraded brief.

## 6. Planned sources (post-launch; each maps to an ontology stage)

| Phase | Source | Spine stage | Becomes (signal examples) |
|---|---|---|---|
| P1 | RO/DE/PL school-holiday & public-holiday calendars | attention → movement | "DE summer break starts Jul 4 → corridor DE→Coast pressure, wks 27–29" |
| P1 | Local events (concerts, festivals — Neptun/Mamaia venues) | attention → movement | demand-window signals on Place |
| P2 | Flight capacity/searches into CND (Constanța) + bus/rail | movement | corridor capacity & booking-curve signals |
| P2 | Search/attention trends (destination queries, source-market) | attention | early-demand signals, 30–90d lead |
| P2 | OTA review aggregates (scores only) | spending/quality | competitiveness drift signals |
| P3 | Romanian macro (INS tourism stats, wages, inflation) | spending | seasonal capacity & price-elasticity context |
| P3 | Channel/PMS integration (two-way, per property) | revenue + **Action execution** | OTB automation; price-push as governed Actions |

Admission rule: a new source ships only with (a) a `signal_sources` row + SLA, (b) the §3 contract implemented, (c) at least one registered signal type per Ontology §6 — otherwise it is a content feed, and content feeds are banned (Article 4).

## 7. Cost & audit

Every external call is attributable: `agent_runs.cost_cents` per run, per source. A monthly source P&L (cost vs. signals produced vs. recommendations influenced) is part of pilot review — sources that never influence a decision get cut.
