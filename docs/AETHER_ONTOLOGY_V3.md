# AETHER — ONTOLOGY V3

**Constitution · Document 3 of 7 · v1.0 · 2026-06-10**
Governs: what the world is made of — entities, edges, time, and lineage. The economic graph that every surface queries (Doctrine, Article 7).
Status: **target architecture.** The current Supabase schema is the *observation layer* of this ontology (§8). No structural migration before launch (ROADMAP).

---

## 1. Purpose

The ontology is AETHER's model of a regional economy as a **typed, bitemporal, lineage-bearing graph**. It exists so that:

- every screen is a query, not a bespoke dataset (Article 7);
- every claim is explainable (Article 6);
- every vertical is a configuration of the same economic primitives (Article 8).

Ontology ≠ database schema. The schema stores it; the ontology *means* it.

## 2. The causal spine (recap)

```
ATTENTION → DEMAND → MOVEMENT → SPENDING → REVENUE
```

Every Signal annotates one or more stages. Every Forecast predicts a downstream stage from upstream evidence. Every Recommendation intervenes at the stage of maximum leverage. Every Outcome measures whether revenue moved.

## 3. Core entities (9)

### 3.1 Place
A geographic anchor at any granularity: country → region (Coasta de Sud) → sector/resort (Neptun, Olimp, Mamaia, Costinești, Eforie) → locality.
- Identity: stable UUID; hierarchy via `parent_place`.
- Properties: geometry (point + polygon), population/seasonality profile, holiday calendar references.
- Note: existing geography UUIDs (COUNTRY_RO, REGION_COAST) are Places.

### 3.2 Market
A demand arena: the intersection of a Place, a vertical, and a time horizon ("Neptun beachfront 4★, summer 2026").
- Identity: configured, not hardcoded (Article 8).
- Properties: competitive set membership, demand segments, source-market mix.
- The pilot's `COMP_SET_TERRA` is a Market materialization.

### 3.3 Corridor
A directed flow path between an origin Place and a destination Market: DE→Coast, PL→Coast, București→Neptun.
- Properties: transport modes, capacity, travel time, seasonal weights.
- Corridors are where *movement* lives; flight/road/rail signals attach here.

### 3.4 Asset
An economic unit that earns revenue in a Market. First vertical: a hotel (Hotel Terra Neptun; the 12 scraped competitors).
- Identity: `properties` / `scraped_properties` rows are Assets (own vs. observed).
- Properties: location (Place), class/stars, capacity, vertical profile, strategy config (`property_strategy`).
- Tenant-scoped when owned; market-public when observed.

### 3.5 Signal
**An interpreted observation** (Article 4). The atomic unit of reasoning.
- Required fields: `subject` (entity ref), `stage` (spine stage), `direction` (+/−), `magnitude` (typed estimate), `confidence` (0–1, from producer), `half_life`, `observed_at`, `valid_from/to`, `lineage` (observation IDs + producer version).
- Taxonomy via `signal_categories` (climate, economic, transport, demographic — extensible by config).
- A Signal is *never* a document. The document (raw_jsonb) is its parent observation.

### 3.6 Forecast
A probabilistic statement about a future metric of an entity: occupancy, ADR, RevPAR, arrival pressure — always **stay-date forward**.
- Required: subject, metric, target date(s), distribution or point + interval, confidence, model version, input signal set (lineage), `generated_at`.
- Forecasts supersede; superseded forecasts are retained (calibration depends on them).

### 3.7 Recommendation
The only actionable node (Article 5).
- Required: subject Asset, action spec (typed: price_change, min_stay, inventory_hold, campaign…), expected impact (metric, delta, confidence), reasoning chain (signal + forecast refs), deadline/decay, cost-of-inaction.
- Lifecycle: `proposed → seen → accepted | adapted | declined | expired → outcome_measured`. Transitions are events with actor + timestamp.

### 3.8 Action
What actually happened when an operator (or later, an automation) executed a recommendation — possibly adapted ("recommended +8%, applied +5%").
- Required: recommendation ref (nullable for unprompted operator actions — these are gold for calibration), actor, executed_at, parameters as applied, execution channel.

### 3.9 Outcome
Measured consequence over the action's evaluation window: realized pickup, ADR delta vs. counterfactual forecast, cancellation drift.
- Required: action ref, metric deltas, attribution confidence, evaluation window.
- Outcomes close the loop and feed model calibration (COMMAND_CENTER §5).

## 4. Supporting entities

- **Event** — a scheduled world occurrence (concert, holiday, school break, conference) attached to a Place; a *source* of attention/movement signals, never content (Article 4).
- **Observation** — the raw, timestamped, source-attributed datum (`rate_observations`, `macro_observations`, `otb_observations` rows). Always preserves `raw_jsonb`. Every lineage chain terminates in Observations.
- **Source** — registry of producers (`signal_sources`: Apify, OWM, BNR, Manual) with freshness SLAs ([DATA_SOURCES](AETHER_DATA_SOURCES.md)).
- **Tenant scope** — `organizations` / `properties`: not graph entities but a mandatory access dimension on every owned node (Doctrine, Part II.1).

## 5. Edges — typed, bitemporal, confident

Every edge carries: `type`, `valid_from / valid_to` (when true in the world), `observed_at` (when we learned it), `confidence`, `lineage`.

| Edge | From → To | Meaning |
|---|---|---|
| `LOCATED_IN` | Asset/Event → Place | containment |
| `PART_OF` | Place → Place, Asset → Market | hierarchy / membership |
| `COMPETES_WITH` | Asset ↔ Asset (within Market) | competitive set |
| `FEEDS` | Corridor → Market | demand supply line |
| `INDICATES` | Signal → entity@stage | the reasoning edge |
| `DERIVED_FROM` | Signal/Forecast/Recommendation → parents | **the lineage edge** (Article 6) |
| `PREDICTS` | Forecast → entity metric @ date | forward claim |
| `PRESCRIBES` | Recommendation → Asset action | actionability |
| `EXECUTES` | Action → Recommendation | loop step |
| `RESULTED_IN` | Outcome → Action | loop close |
| `SUPERSEDES` | Forecast/Recommendation → prior version | revision chain |

Bitemporality rule: queries default to "as known now about then"; calibration queries use "as known *then* about then" (no hindsight leakage).

## 6. Signals are reasoning — the typing contract

To register a signal type, a producer must declare:

1. trigger (which observations), 2. subject resolution (which entities), 3. stage(s) on the spine, 4. magnitude function and units, 5. confidence function, 6. half-life, 7. human-readable template ("X → effect on Y, window Z").

Anything that cannot fill this contract remains an Observation. This is the firewall that keeps AETHER from becoming a news app.

## 7. Lineage law (mechanics)

- Derived rows store parent refs as first-class columns/arrays — not prose.
- Producers stamp `agent_run_id` (→ `agent_runs`), model/prompt version, and code version.
- The brief generator consumes Signals/Forecasts/Recommendations by ID and renders citations; the rendered brief stores the ID set it used (`daily_briefs.content_jsonb`).
- Deleting a parent with living children is forbidden; supersede instead.

## 8. Mapping to the current Supabase schema

| Ontology | Today (observation layer) | Gap to V3 |
|---|---|---|
| Observation | `rate_observations`, `macro_observations`, `otb_observations` | ✅ exists; keep raw_jsonb discipline |
| Source | `signal_sources` | ✅ exists |
| Signal taxonomy | `signal_categories` | exists; needs typing contract (§6) fields |
| Place | geography UUIDs (country/region) | needs explicit `places` hierarchy + geometry |
| Market | `COMP_SET_TERRA` (implicit) | needs `markets` + membership edges |
| Corridor | — | new (post-pilot) |
| Asset | `properties`, `scraped_properties` | ✅ exists; unify under Asset view |
| Signal (typed) | — (today: raw macro rows double as signals) | new `signals` table per §3.5 |
| Forecast | — (today: computed in brief prompt) | new `forecasts` table; required for calibration |
| Recommendation | — (today: prose inside brief) | new `recommendations` + lifecycle events |
| Action / Outcome | — | new; Phase 3 |
| Lineage | `agent_runs` (partial) | add parent-ref columns on all derived tables |

## 9. Migration posture

1. **Pre-launch (now):** no schema changes beyond what the brief pipeline needs. The brief may compute signal/forecast/recommendation *content* inline, but must already log lineage (observation IDs used) into `content_jsonb` — cheap now, priceless later.
2. **Phase 3 (post-pilot):** materialize `signals`, `forecasts`, `recommendations` tables; brief generator switches from "compute + prose" to "read graph + cite."
3. **Phase 4:** corridors, events, outcome attribution, graph query layer serving all viewports.

The constitution's test for any schema PR: *does this row know where it came from, when it was true, when we learned it, and who may see it?*
