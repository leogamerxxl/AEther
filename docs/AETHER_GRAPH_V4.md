# AETHER — GRAPH V4

**Architecture · v1.0 · 2026-06-10 · status: DESIGN (no migrations generated)**
Extends [ONTOLOGY_V3](AETHER_ONTOLOGY_V3.md) (doctrine layer, unchanged) into a buildable object model, grounded in the **live schema** of Supabase project `irmyramqaovmgcktbazy` as inspected 2026-06-10.
New in V4: **Narrative, Attention, Intent, Movement, Demand, Spend, Revenue, Influence Network, Segment, Scenario, ModelVersion, Confidence, Lineage** as first-class graph citizens.

---

## 1. Schema autopsy — what actually exists

36 tables + 2 views in `public`. The decisive finding: **V4 is mostly a completion, not an invention.** The schema already contains embryos of the decision layer; they are empty, single-parent, or jsonb-blobbed, but their shapes prove the original intent.

### 1.1 Embryo map (existing table → V4 entity)

| Existing (rows) | Is embryonically | Missing for V4 |
|---|---|---|
| `demand_forecasts` (0) | **Forecast** — has `confidence`, `segment_mix_jsonb`, `source_signals_jsonb` | model version, scenario, supersession, subject generalization (market-level), interval |
| `source_market_signals` (0) | **Signal** — typed! has `intensity`, `expected_magnitude`, `effective_start/end`, FK to one `macro_observations` row | multi-parent lineage, stage typing, half-life, confidence breakdown, narrative ref |
| `property_actions` (0) | **Action + Outcome** fused — has `recommendation_id`, `executed_at`, `outcome_measured_at`, `outcome_jsonb` | outcome as separate node, counterfactual ref, attribution confidence |
| `contextual_insights` (0) | **Recommendation** (prose era) — has `signals_used` jsonb, `confidence`, `recommended_actions` | lifecycle states, action spec, expected impact, deadline/decay |
| `experience_/staffing_/procurement_recommendations` (0) | vertical **Recommendations** — all FK → `demand_forecasts` (lineage as FK!) | unification under one `recommendations` table |
| `geo_events` (0) | **Event** — `intensity`, `affected_countries`, category+source FKs | place ref (only country), validity window |
| `competitive_sets` + `members` (1+12) | **Market** + membership (with `weight`!) | market as first-class subject of measurements/forecasts |
| `property_source_markets` (9) | **Corridor/Segment** hybrid — `share_of_bookings`, `average_ltv`, `trend_direction` per origin country | split into Corridor (flow path) + Segment (cohort) |
| `regions` (5, has `seasonality_profile`) / `countries` (10) | **Place** upper levels | resort level (Neptun, Mamaia, Eforie, Costinești, Olimp) does not exist anywhere |
| `local_amenities` (219, PostGIS `geometry`) | Place POI layer | parent place links (PostGIS is available — important) |
| `signal_sources` (12) / `signal_categories` (7) | **Source** registry | reliability prior, freshness SLA; category stage + half-life |
| `agent_runs` (0) | **Lineage** runtime | model_version ref; it is also currently unused by code |
| `vertical_profiles` (5) | Article-8 substrate | already correct |

### 1.2 Temporal bones already present

Bitemporality exists where it matters most: `rate_observations(observed_at, stay_date)` ✓, `macro_observations(observed_at, effective_date)` ✓, `otb_observations(observed_at, stay_date)` ✓, `demand_forecasts(generated_at, forecast_date)` ✓. **No supersession chains anywhere; no validity windows on relationships.** V4 adds both.

### 1.3 Lineage today

Three FK-shaped edges (`*_recommendations.forecast_id`), one single-parent FK (`source_market_signals.observation_id`), two jsonb blobs (`source_signals_jsonb`, `signals_used`). Not recursively queryable; "Why?" cannot be answered by SQL today.

### 1.4 Liabilities carried into V4 planning

`integrations_safe` view (SEC-1, critical), `property_live_telemetry` (SEC-2, 13 demo rows), JARVIS-era ops tables (departments/staff/shifts/inventory/suppliers — keep, they are the future `ops` rec types, currently inert). Data reality: `rate_observations` 462 rows (stale since 2026-05-22), `macro_observations` 11, everything derived: 0.

---

## 2. The updated graph

### 2.1 Layer model

```
L5 EPISTEMICS     ModelVersion · ConfidencePolicy · LineageEdge · agent_runs
                  └─ stamps every derived row in L2–L4
L4 DECISION       Scenario ⊃ { Forecast → Recommendation → Action → Outcome }
L3 INTERPRETATION Narrative (←ticks per InfluenceNetwork) · Signal (typed)
L2 FUNNEL         Attention → Intent → Demand ⇄ Movement → Spend → Revenue
                  (stage_measurements: one table, six registered object types)
L1 EVIDENCE       rate_observations · macro_observations · otb_observations ·
                  geo_events · attention/intent observations (new sources)
L0 WORLD          Place ⊃ Market · Asset · Corridor · Segment ·
                  InfluenceNetwork · Source · Tenant(org/property)
```

### 2.2 The causal spine, V4

```
            ┌─────────── InfluenceNetworks: TikTok · Instagram · Travel Blogs ───────────┐
 NARRATIVE ─┤            Influencers · News  (reach × velocity × credibility per Segment) │
            └────────────────────────────────┬─────────────────────────────────────────--┘
                                             ▼ generates (attributed, confidence-weighted)
 ATTENTION ──► INTENT ──► DEMAND ────────────────► booked path (booking precedes arrival)
                  │           ▲                          │
                  │           └─ pickup / pace           ▼
                  └─────────► MOVEMENT ─────────► SPEND ──► REVENUE
                              walk-in path (RO drive-to, last-minute: demand
                              materializes at the door; Movement leads)
```

The spine is a **DAG with two canonical paths**, not a strict chain. Per-Segment lead/lag distributions (German families book 60–90d out; Romanian urban weekenders 7–21d; walk-ins 0d) are themselves measured quantities (funnel-conversion edges, §2.5).

### 2.3 New entity specifications (the 13)

Tenancy classes: **G** = global intelligence (read: authenticated; write: service only), **T** = tenant-scoped (org/property RLS), **M** = mixed (policy on subject).

**Narrative (G)** — a thesis circulating in the world that redirects attention. *Not content* (Article 4): a typed claim with measured strength, never a feed of articles.
Properties: `code, name, thesis, subject(kind,id) [Place/Market], polarity ∈ {tailwind, headwind, mixed}, origin_place, lifecycle ∈ {emerging, building, peak, fading, dormant}, first_detected_at, last_tick_at`.
Seed set: *Romanian Coast Revival* (tailwind, RO coast), *Wellness Tourism Boom* (tailwind, segment-selective), *Greece Better Value* (headwind, price-referenced), *Black Sea Security Concerns* (headwind, episodic/resurgent), *Digital Nomad Migration* (tailwind, narrow segment, long season).
Strength lives in `narrative_ticks`: `(narrative, network?, observed_at, strength 0..1, velocity, confidence, model_version)` — strength is **measured per channel**, never asserted.

**Influence Network (G)** — propagation channel for narratives. `code, name, kind ∈ {social, blog, influencer, news, search}, reach_index, velocity_days (lag from post to attention), credibility_prior`. Seed: TikTok, Instagram, Travel Blogs, Influencer pods (RO/DE), News (RO, DE, PL). Audience composition via `network_audiences (network, segment, share, valid window)`.

**Segment (G, org-overridable)** — a demand cohort. `code, name, origin_place, profile_jsonb {booking_window_dist, price_elasticity, channel_mix, party_profile, season_affinity}`. Seed from `property_source_markets` (DE, PL, RO-urban…) + behavioral splits (families / wellness / nomads). `org_id NULL` = global; tenant-specific segments allowed later.

**Attention / Intent / Demand / Movement / Spend / Revenue (M)** — six registered object types backed by **one table**, `stage_measurements`, because the funnel *is* the product and cross-stage math must be one query:
`(stage, subject(kind,id), place?, market?, corridor?, segment?, metric_code, value, unit, observed_at, effective_date?, target_date? [stay date], source?, derived?, confidence + breakdown, model_version?, agent_run?)`.
Examples per stage: attention = search-volume index, hashtag views, mention counts · intent = dated searches, price queries, OTA sessions · demand = OTB pickup, pace, comp-set pressure · movement = arrivals, CND flight load, road traffic · spend = ADR paid, ancillary basket · revenue = RevPAR, total. **Lower-funnel measurements derive from existing observations** (`otb_observations`, `rate_observations`) — no new collectors required for demand/spend/revenue.

**Scenario (T)** — a forward fork of the graph, Foundry-style. `code, name, status, scope(org/property), assumptions[]` where assumptions override signals/measurements/prices (`scenario_assumptions`). `scenario_id` is nullable on forecasts/recommendations; **NULL = baseline reality**. Law: observations are never forked; **Actions may execute only from baseline** — a scenario recommendation must be *promoted* first.

**ModelVersion (G)** — registry of everything that derives: `code ('narrative-classifier', 'demand-v2', 'brief-ro'), version, kind ∈ {classifier, forecaster, recommender, validator, llm_prompt}, prompt_hash, params, activated_at, retired_at` + `model_calibrations (model_version, metric, window, n, hit_rate, brier, bias, factor)` recomputed from Outcomes. Every derived row stamps `model_version_id`.

**Confidence (policy + stored breakdown)** — confidence stops being a naked numeric. Every derived row stores `confidence` **and** `confidence_jsonb` (the audit trail of the number itself: components + formula + policy id). Propagation rules live in `confidence_policies` (§4). Confidence is *recomputable from lineage* — hand-entered confidence is a constitution violation (Truth Doctrine).

**Lineage (physical)** — one universal table, `lineage_edges (child_kind, child_id, parent_kind, parent_id, role ∈ {evidence, input, model, supersedes, counterfactual, migrated_from}, weight, agent_run_id, created_at)` + `graph_kinds` registry (kind → table, pk) so the "Why?" query is generic and recursive. Existing FK- and jsonb-lineage is backfilled into edges (§7).

### 2.4 Revised existing entities

- **Asset** = `properties` (own, T) ∪ `scraped_properties` (observed, G) unified by a `place_id` and market membership — no table merge.
- **Market** = formalized `competitive_sets` (`markets` + `market_members` generalizing members with validity windows and both member kinds).
- **Corridor** = origin Place → destination Market with modes/capacity/seasonality; backfilled from `property_source_markets` (which keeps its per-property share/LTV economics as corridor *measurements*).
- **Place** = new `places` hierarchy (country → region → **resort** → locality) mirroring `countries`/`regions` and finally giving Neptun/Olimp/Mamaia/Costinești/Eforie real identities; `local_amenities` (PostGIS) attach beneath.
- **Event** = `geo_events` + `place_id` + validity window; events emit signals, never render as content.

### 2.5 Edge catalog (all edges carry: valid_from/to, observed_at, confidence, lineage ref)

| Edge | From → To | Payload |
|---|---|---|
| `PROPAGATES_VIA` | Narrative → InfluenceNetwork | velocity, reach share (from ticks) |
| `FRAMES` | Narrative → Place/Market | polarity, strength |
| `RESONATES_WITH` | Narrative → Segment | affinity |
| `REACHES` | InfluenceNetwork → Segment | audience share |
| `GENERATES` | Narrative → Attention measurement | attribution weight |
| `CONVERTS_TO` | stage → next stage (per Market × Segment) | conversion rate, lag distribution — **the funnel edges, measured** |
| `FLOWS_VIA` | Movement → Corridor | volume share |
| `ORIGINATES_FROM` | Segment → Place | — |
| `MEMBER_OF` | Asset → Market | weight, window |
| `CAPTURES` | Asset → Demand (market) | capture rate vs fair share |
| `INDICATES` | Signal → entity@stage | direction, magnitude |
| `EXPRESSES` | Signal → Narrative | when a signal is narrative-borne |
| `PREDICTS` | Forecast → subject metric @ target_date | interval |
| `PRESCRIBES` | Recommendation → Asset action | spec |
| `UNDER_SCENARIO` | Forecast/Recommendation → Scenario | — |
| `EXECUTES` / `RESULTED_IN` | Action → Recommendation / Outcome → Action | adapted params / attribution |
| `SUPERSEDES` | any derived → prior version | reason |
| `PRODUCED_BY` | any derived → ModelVersion | — |
| `DERIVED_FROM` | any derived → any parent | role, weight (**the** lineage edge) |

---

## 3. Temporal behavior

### 3.1 Three time axes (explicit on every relevant row)

| Axis | Column convention | Meaning |
|---|---|---|
| **Knowledge time** | `observed_at` / `generated_at` / `created_at` | when AETHER learned it |
| **Validity time** | `valid_from/valid_to` · `effective_date` | when it is true in the world |
| **Target time** | `stay_date` / `target_date` | the future being claimed (stay-date forward, Doctrine II.4) |

Default query semantics: *as known now, about then*. Calibration semantics: *as known then, about then* (`knowledge ≤ as_of` — the no-hindsight rule; supersession chains make this answerable).

### 3.2 Decay by layer

| Object | Half-life / lifecycle |
|---|---|
| Attention measurement | hours–days (t½ ≈ 3d default) |
| Intent | days–weeks (t½ ≈ 14d) |
| Narrative | weeks–months; **lifecycle FSM** `emerging → building → peak → fading → dormant`, transitions driven by tick velocity; `dormant` narratives can re-arm (Black Sea Security Concerns is episodic — resurgence is cheap because the node persists with history) |
| Signal | declares `half_life_days` (category default); expired signals leave active reasoning automatically |
| Demand/OTB | persists until stay_date, then freezes into history |
| Forecast | superseded, never edited; horizon decays as target approaches |
| Recommendation | `deadline_at` + decay; auto-`expired` is a lifecycle event |
| Scenario | frozen at creation (assumptions don't drift); compared against living baseline |
| ModelVersion | activated/retired; never deleted |

Confidence decays with the same clocks (§4), which is what drives the UI "cooling" states (DESIGN_LANGUAGE §5, COMMAND_CENTER §7).

---

## 4. Confidence propagation

### 4.1 Component model (stored in `confidence_jsonb` on every derived row)

```
observation:  c = source_prior × freshness(observed_at, sla) × parse_quality
derived:      c = combine(parents) × model_calibration_factor × decay(age, t½)
```

- `source_prior` — per `signal_sources.reliability_prior`, updated by validation hit-rate (a source that lies gets cheaper to distrust).
- `model_calibration_factor` — from `model_calibrations` (measured against Outcomes; a forecaster that is over-confident gets discounted automatically).

### 4.2 Combinators (declared per derivation type in `confidence_policies`)

| Combinator | Formula | Used when |
|---|---|---|
| `MIN_CHAIN` | `min(c₁…cₙ)` | conjunctive reasoning — a chain is as strong as its weakest necessary link (signal→forecast→recommendation) |
| `NOISY_OR` | `1 − ∏(1 − wᵢcᵢ)` | independent corroboration — three weak attention sources agreeing beat one strong (narrative ticks) |
| `WEIGHTED` | `Σwᵢcᵢ / Σwᵢ` | blended inputs of one kind (segment-mix aggregation) |

### 4.3 Worked example — "Greece Better Value" headwind

```
3 attention obs (TikTok .52, search-trends .41, blog .38)   [independent]
  narrative_tick = NOISY_OR(.52,.41,.38) × cal(.85) = .71
signal "intent headwind, Market Neptun-4★, −6%, t½ 21d"
  = MIN(.71, stage-mapping .90) × cal(.90)            = .64
forecast "occ Jul 11–13: −4pp vs prior"
  = MIN(.64, OTB-pace obs .92) × cal(demand-v2 .91)   = .58
recommendation "hold ADR, add value bundle; review Sat"
  = .58 × policy ceiling factor (.95)                 = .55  → UI shows 55%
```

Every number above is reconstructible from `confidence_jsonb` + `lineage_edges` — the confidence itself has lineage (Article 6 applied reflexively).

---

## 5. Recommendation lineage

### 5.1 Mechanics

- Every derived row writes `lineage_edges` at creation (same transaction), with `agent_run_id` → `agent_runs` (which finally gets used) and `PRODUCED_BY` → ModelVersion.
- The **"Why?" query** is one recursive walk (shape, not a migration):

```sql
-- illustrative shape only
with recursive why as (
  select * from lineage_edges where child_kind='recommendation' and child_id=$1
  union all
  select e.* from lineage_edges e join why w
    on e.child_kind=w.parent_kind and e.child_id=w.parent_id
) select * from why;          -- resolve display via graph_kinds registry
```

- The brief cites by ID: `daily_briefs.content_jsonb.citations[]` (Wave 0 convention) → later a real `lineage_edges` set with `child_kind='daily_brief'`.
- Integrity law: **supersede, never delete**; nightly orphan check (a child whose parent vanished = high-severity data bug); migration backfills use `role='migrated_from'` so *the migration itself is lineage*.

### 5.2 End-to-end chain (the full loop, V4 vocabulary)

```
observations → narrative_ticks → narrative(lifecycle) → signal(stage-typed)
→ stage_measurements(funnel corroboration) → forecast(scenario=baseline)
→ recommendation(proposed→seen→accepted|adapted|declined|expired)
→ action(executed, params-as-applied) → outcome(T+window, vs counterfactual forecast)
→ model_calibrations update → confidence priors shift → tomorrow reasons better
```

---

## 6. Required schema changes (design — **no DDL yet**)

### 6.1 New tables (compact specs)

**Reference (Wave 1):**
- `graph_kinds(kind pk, table_name, pk_column, label)`
- `places(id, parent_id→places, kind∈{country,region,resort,locality}, name, slug, country_id→countries, region_id→regions, lat, lng, geom?, meta_jsonb)`
- `markets(id, code, name, place_id→places, vertical_profile_id→vertical_profiles, definition_jsonb)`
- `market_members(id, market_id, member_kind∈{asset_own,asset_observed}, property_id?→properties, scraped_property_id?→scraped_properties, weight, valid_from, valid_to)`
- `corridors(id, code, origin_place_id→places, dest_market_id→markets, modes_jsonb, capacity_index, travel_minutes, seasonality_jsonb)`
- `segments(id, code, name, origin_place_id→places, org_id?→organizations [null=global], profile_jsonb)`
- `influence_networks(id, code, name, kind, reach_index, velocity_days, credibility_prior, meta_jsonb)`
- `network_audiences(id, network_id, segment_id, share, valid_from, valid_to)`
- `model_versions(id, code, version, kind, prompt_hash?, params_jsonb, activated_at, retired_at)`
- `lineage_edges(id, child_kind, child_id, parent_kind, parent_id, role, weight, agent_run_id?, created_at, unique(child_kind,child_id,parent_kind,parent_id,role))`
- `confidence_policies(id, derivation_kind, combinator∈{min_chain,noisy_or,weighted}, decay_half_life_days, floor, ceiling, params_jsonb)`

**Measurement & interpretation (Wave 2):**
- `stage_measurements(id, stage∈{attention,intent,demand,movement,spend,revenue}, subject_kind, subject_id, place_id?, market_id?, corridor_id?, segment_id?, metric_code, value_numeric, unit, observed_at, effective_date?, target_date?, source_id?→signal_sources, derived bool, confidence, confidence_jsonb, model_version_id?, agent_run_id?, created_at)` — indexes `(stage, subject_kind, subject_id, target_date)`, `(market_id, stage, effective_date)`
- `narratives(id, code, name, thesis, subject_kind, subject_id, polarity, origin_place_id?, lifecycle, first_detected_at, last_tick_at, meta_jsonb)`
- `narrative_ticks(id, narrative_id, network_id?→influence_networks, observed_at, strength, velocity, confidence, confidence_jsonb, model_version_id, agent_run_id)`
- `signals(id, category_id→signal_categories, narrative_id?→narratives, subject_kind, subject_id, stage, direction, magnitude, magnitude_unit, half_life_days, confidence, confidence_jsonb, valid_from, valid_to, observed_at, headline_text, model_version_id, agent_run_id, superseded_by?→signals)` — generalizes `source_market_signals`

**Decision (Wave 3):**
- `forecasts(id, subject_kind, subject_id, metric_code, target_date, horizon_days, value, interval_low, interval_high, distribution_jsonb?, confidence, confidence_jsonb, scenario_id?→scenarios, model_version_id, generated_at, superseded_by?→forecasts, agent_run_id)` — generalizes `demand_forecasts`
- `recommendations(id, property_id→properties, scenario_id?→scenarios, rec_type∈{pricing,inventory,min_stay,campaign,experience,ops_staffing,ops_procurement}, title, reasoning_text, action_spec_jsonb, expected_impact_jsonb, confidence, confidence_jsonb, deadline_at, decay_half_life_days, cost_of_inaction_jsonb, status, model_version_id, agent_run_id)` — unifies `contextual_insights` + the three `*_recommendations`
- `recommendation_events(id, recommendation_id, event∈{proposed,seen,accepted,adapted,declined,expired,measured}, actor_user_id?, at, note, params_jsonb)`
- `outcomes(id, action_id→property_actions, evaluation_window_days, measured_at, metrics_jsonb, attribution_confidence, counterfactual_forecast_id?→forecasts, model_version_id)` — splits Outcome out of `property_actions`

**Scenario & calibration (Wave 4):**
- `scenarios(id, org_id, property_id?, code, name, description, status∈{draft,active,archived}, created_by, created_at)` (baseline = absence of scenario_id, not a row)
- `scenario_assumptions(id, scenario_id, assumption_kind∈{signal_override,measurement_override,price_move,external_event}, payload_jsonb)`
- `model_calibrations(id, model_version_id, metric_code, window_start, window_end, n, hit_rate, brier, bias, factor, computed_at)`

### 6.2 Additive columns on existing tables (no renames, no drops)

| Table | Add |
|---|---|
| `signal_sources` | `reliability_prior numeric`, `freshness_sla_minutes int` |
| `signal_categories` | `default_stage text`, `default_half_life_days int`, `magnitude_unit text` |
| `demand_forecasts` | `model_version_id`, `scenario_id`, `superseded_by`, `confidence_jsonb` (transition aids) |
| `daily_briefs` | `model_version_id` (citations stay inside `content_jsonb` until Wave 3) |
| `agent_runs` | `model_version_id`, `status text`, `error text` |
| `properties`, `scraped_properties` | `place_id → places` |
| `competitive_sets` | `market_id → markets` (bridge) |
| `property_source_markets` | `corridor_id`, `segment_id` (bridges) |
| `geo_events` | `place_id`, `ends_at` |
| `property_actions` | `applied_params_jsonb` (adapted-execution record) |

### 6.3 RLS classes (every new table ships with RLS enabled + policies BEFORE first row — SEC-1 lesson)

- **G (global intel):** places, markets, corridors, segments(global), influence_networks, network_audiences, narratives, narrative_ticks, model_versions, model_calibrations, confidence_policies, graph_kinds, signals/measurements with global subjects → `select` to `authenticated` only; all writes service-role. **anon: nothing.**
- **T (tenant):** forecasts/recommendations/recommendation_events/outcomes/scenarios + measurements/signals whose subject is a property → org/property-scoped policies.
- **M (mixed-subject tables):** policy = `subject is global OR subject property ∈ caller's org`.
- No new `SECURITY DEFINER` objects (Doctrine IV). PostgREST exposure reviewed per wave via advisors.

### 6.4 Deprecations (kept, never dropped in V4)

`contextual_insights` (frozen at Wave 3), `source_market_signals` (dual-written then frozen), `demand_forecasts` (dual-run then view-swapped in Wave 4), `property_actions.outcome_*` columns (superseded by `outcomes`), `property_live_telemetry` + `integrations_safe` (security remediation owns these, not V4).

---

## 7. Migration strategy

**Wave 0 — now → launch (Jun 15): nothing structural.** The streak is sacred. Only the existing convention: brief writes `content_jsonb.citations[]` (observation IDs). All waves below live in ROADMAP Phase 3.

| Wave | Ships | Backfill | Risk posture |
|---|---|---|---|
| **1 · Reference & epistemic spine** | graph_kinds, places, markets(+members), corridors, segments, influence_networks(+audiences), model_versions, lineage_edges, confidence_policies; additive columns §6.2 | countries/regions → places; +5 resort rows; comp set Terra → markets; `property_source_markets` (9 rows) → corridors+segments; FK lineage (3 rec tables, `source_market_signals.observation_id`) and jsonb lineage (`signals_used`, `source_signals_jsonb`) → lineage_edges with `role='migrated_from'` | Zero behavior change; app untouched; gate = integrity checks + advisors clean |
| **2 · Measurement & narrative** | stage_measurements + derivation jobs (otb→demand/spend/revenue; rate_obs→market price-position; macro→climate indices), narratives + ticks (seed 5 narratives), signals (generalized) | dual-write trigger `source_market_signals → signals`; old writers unmodified | 14-day reconciliation (daily counts/sums in validator); gate = funnel query demo on real data |
| **3 · Decision cutover** | forecasts (dual-run vs demand_forecasts with daily comparison report), recommendations + events, outcomes | brief generator flag: read-graph+cite, prose path as fallback 14 days; `contextual_insights` frozen | gate = 2 weeks brief parity + working "Why?" drawer on production rows |
| **4 · Scenario & calibration** | scenarios + assumptions, model_calibrations job (from outcomes), confidence-recompute job; compat view swaps (`demand_forecasts`, `*_recommendations` as views) | legacy write paths disabled | view-swap is destructive-adjacent → human confirmation + DECISIONS.md entry; gate = calibration scorecard live |

Each wave: **additive-only DDL**, RLS-first, `apply_migration` (named migrations, never raw DDL), advisors run after, rollback = disable triggers/jobs + flags off (side-car tables stay inert; no data loss path exists).

---

## 8. Backward compatibility plan

**Invariants through Wave 3:**
1. No table or column is dropped, renamed, or type-changed. All V4 tables are side-cars; all changes to existing tables are nullable additive columns.
2. Existing FKs untouched; existing writers (future nexus-scrape/brief/mail from Phase 0) keep working unmodified — bridging happens via DB triggers and backfill jobs, not by editing the launch pipeline.
3. `content_jsonb` / `*_jsonb` keys are additive only.

**Readers.** Command center reads through the query layer (Doctrine, Article 7) behind per-entity flags — repoint `demand_forecasts`→`forecasts` etc. one entity at a time. Brief generator: flag with prose fallback for 14 days.

**Writers.** Dual-write windows are implemented as DB triggers (legacy table → V4 table), so legacy Python needs zero edits during transition; daily reconciliation queries run inside the validation gate and page on drift.

**The view-swap pattern (Wave 4 only, per table, after two clean waves):** legacy table → renamed `*_legacy`; same-name **view** over the V4 table (with INSTEAD OF triggers only if a writer still exists). Requires explicit human confirmation (Doctrine: destructive ops) + DECISIONS.md.

**ID stability.** Backfilled V4 rows do not reuse legacy PKs; the mapping is recorded as `lineage_edges(role='migrated_from')` — provenance of the migration itself, queryable forever.

**Security compatibility.** New tables are invisible to `anon` by default; nothing in V4 widens any existing grant; SEC-1…SEC-5 remediation proceeds independently (Phase 0/1) and V4 waves do not start until SEC-1 is closed.

**Rollback.** Per wave: stop jobs, disable triggers, flags off. V4 tables remain as inert side-cars; the legacy path was never severed. The only irreversible step in the entire plan is the Wave-4 view swap, which is why it is last, gated, and human-confirmed.
