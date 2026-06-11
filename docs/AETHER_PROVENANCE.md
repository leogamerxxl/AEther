# AETHER — PROVENANCE ARCHITECTURE

**Architecture · v1.0 · 2026-06-10 · status: DESIGN (component specs, no implementation)**
Mechanizes [OPERATING_DOCTRINE](AETHER_OPERATING_DOCTRINE.md) Articles 3 (truth has a timestamp) and 6 (lineage), [DESIGN_LANGUAGE](AETHER_DESIGN_LANGUAGE.md) §5 (the provenance row), [COMMAND_CENTER](AETHER_COMMAND_CENTER.md) §6–7 (Why drawer, degraded-truth states), and [GRAPH_V4](AETHER_GRAPH_V4.md) §4–5 (confidence, lineage_edges).

**The law this document enforces: no naked numbers cross the query layer.** A value without provenance is a rumor, and rumors do not render.

---

## 1. The Provenance Envelope

Every value that travels from the data layer to any surface (web, email, future API) travels wrapped. The envelope is the system's unit of honesty:

```ts
// design contract — lands in nexus-shared/types when implemented
interface Provenance {
  source: { id: string; code: string; name: string; kind: "observation" | "model" | "composite" };
  observedAt: string;            // knowledge time — when AETHER learned it
  effectiveAt?: string;          // validity time — when true in the world
  targetDate?: string;           // target time — the stay-date being claimed
  freshness: {
    state: "fresh" | "cooling" | "stale" | "dead";
    ageSeconds: number;          // re-derived live client-side; never cached
    slaSeconds: number;          // from the registry (§7)
    ratio: number;               // age / sla
  };
  confidence?: {
    value: number;               // 0..1 — from the producer, never invented at UI
    breakdownRef?: true;         // confidence_jsonb exists; drawer fetches it
    policy: string;              // confidence_policies code
  };
  lineage: { rootKind: string; rootId: string };  // POINTER, never the payload
  designation: "real" | "derived" | "simulation";
}

interface Sourced<T> { value: T; provenance: Provenance }
```

Three disciplines baked into the shape:

1. **Pointer, not payload.** The envelope carries a lineage *reference*; the Why drawer resolves the recursive chain lazily (Graph V4 §5.1 query). Envelopes stay bytes-cheap; honesty stays one gesture away.
2. **Age is computed, never stored.** `observedAt` + `slaSeconds` travel; `ageSeconds`/`state` re-derive on a live clock. A cached freshness state is a lie waiting to render.
3. **Designation is explicit.** `simulation` is a first-class value, not a missing flag — the Truth Doctrine's SIMULATION badge is driven by data, not by developer memory.

## 2. The five facets

| Facet | Answers | Computed from | Display rule (Night Harbor) |
|---|---|---|---|
| **Source** | who produced this | `signal_sources` (observations) or `model_versions` (derivations); composites name the dominant source + count ("Apify +2") | `SourceChip`: name in ink-4; click filters the Why drawer to that source |
| **Timestamp** | when learned / true / claimed | the tri-temporal columns (V4 §3.1) | knowledge time by default; stay-date-indexed values also show target; hover reveals all three axes absolute |
| **Freshness** | can I trust it *now* | `age / SLA` state machine (§3) | `FreshnessDot`: `signal` <SLA · `harbor` cooling · `down` stale · `crit` dead; stale surfaces desaturate 40% (`StaleVeil`) |
| **Confidence** | how sure was the producer | producer-stamped, propagated per `confidence_policies` (V4 §4) | monochrome segmented meter; red only <30%; breakdown waterfall in drawer |
| **Lineage** | why — show the chain | `lineage_edges` recursive walk | `WhyDrawer`, one gesture from any value; every node row inside it carries its own ProvenanceRow (recursively consistent) |

## 3. Freshness algebra

### 3.1 The state machine

```
fresh    ratio < 1.0      normal rendering
cooling  1.0 ≤ ratio < 2  harbor dot; age rendered in `down` color
stale    ratio ≥ 2 (or hard threshold)   StaleVeil: desaturate 40%, banner on alert rail
dead     source has no successful agent_run within 2× cadence AND data beyond SLA
                          → recommendations suppressed (Command Center §7); pipeline pages
```

### 3.2 Special freshness semantics (the cases that break naive `age > sla`)

| Case | Rule |
|---|---|
| **Calendar-aware SLAs** | BNR publishes ~13:00 EET business days only — Friday's rate is *fresh* on Sunday. SLA evaluation runs on a per-source calendar, not wall-clock. |
| **Horizon decay** | A weather forecast for day+7 is intrinsically less certain than day+1: confidence (not freshness) decays with horizon; freshness tracks the *fetch*. |
| **Supersession staleness** | A forecast is stale the moment a successor exists — even if 60 seconds old. `superseded_by IS NOT NULL` ⇒ stale, unconditionally. |
| **Deadline staleness** | A recommendation's stale threshold *is* its `deadline_at`. Age is irrelevant; expiry is event-driven. |
| **Two-input freshness** | Market booking velocity needs two consecutive fresh scrapes (it is a delta). One fresh scrape after a gap ⇒ velocity is stale even though rates are fresh. |
| **Tick-cadence staleness** | Narrative strength has no SLA; it goes stale at 2× its archetype's expected tick cadence, and *decays* (NIS §7) in between. |

### 3.3 Propagation (derived and composite values)

Freshness propagates exactly like confidence, using the same policy combinators (V4 §4.2):

- **Conjunctive** (`MIN_CHAIN` derivations): state = worst parent state; displayed age = oldest required parent.
- **Corroborative** (`NOISY_OR`): state = best contributing parent above weight threshold; drawer shows the full parent set.
- **Composites** (Market Health, 7 components): overall state = worst among components with weight above threshold; the per-component breakdown lives in `components_jsonb` and renders as a waterfall in the drawer.

Confidence decays on the freshness clock (the V4/NIS decay models) — a number cools in *both* senses at once, and the UI shows both.

## 4. The Metric Provenance Registry

The "every metric declares" contract. One registry, two homes: a typed module (`lib/provenance-registry.ts`) at Phase 2, promoted to a `metric_provenance` table in Wave 2 (config-over-enums, Doctrine II.2). Shape per entry: `metric_code, source(s), update_frequency, confidence_model, stale_threshold, freshness_combinator, special_semantics`.

### 4.1 The registry (launch + designed metrics)

| Metric | Source | Update freq | Confidence model | Stale threshold |
|---|---|---|---|---|
| `comp_rate` (competitor nightly rate) | Apify/Booking | daily, pre-dawn | source prior × parse quality | cooling 24h · stale 48h |
| `market_booking_velocity` | derived: Δ`rooms_remaining` | daily (needs 2 consecutive scrapes) | MIN_CHAIN(scrape t, scrape t−1) | 48h, two-input rule |
| `sellout_cascade` | derived: `availability_state` transitions | daily | MIN_CHAIN, corroborated across comp set | 48h |
| `own_occupancy` / `own_adr` / `revpar` | OTB (owner/PMS) | daily target | first-party prior (highest) | cooling 48h · stale 96h |
| `weather_beach_index` | OWM | daily, 7-day horizon | source prior × **horizon decay** | 24h (fetch) |
| `fx_ron_eur` | BNR | business days ~13:00 EET | ≈1.0 | next business day + 6h (**calendar-aware**) |
| `brief_claim` (each sentence) | model `brief-ro` | daily 07:00 | MIN_CHAIN(cited parents) × prompt calibration | next brief (24h) |
| `demand_pressure` | derived: velocity + capacity + intent | daily | MIN_CHAIN | 48h |
| `competitive_pressure` | derived: rates + availability + review position | daily | WEIGHTED components | 48h |
| `market_health` | composite (7 components) | daily | WEIGHTED, component-gated | 72h |
| `demand_leakage` | derived + substitution evidence | weekly | NOISY_OR on substitution evidence; widest intervals | 7d |
| `revenue_opportunity` | scenario differencing | on forecast update | MIN_CHAIN(forecast, action model) | tied to underlying forecast |
| `narrative_strength` | NIS ticks per network | daily per network | NOISY_OR across networks | 2× tick cadence (**decay-based**) |
| `forecast_occupancy` | model `demand-vX` | daily regen / supersession | model calibration factor | superseded ⇒ stale; else 36h |
| `recommendation_confidence` | propagated at creation | decays to deadline | MIN_CHAIN × policy ceiling | `deadline_at` (**event-driven**) |
| `corridor_flow` (vehicles) | toll/traffic feeds | daily | source prior × occupancy-factor calibration | 72h |

Admission rule: **a metric without a registry entry cannot render.** The registry is the gate, not documentation after the fact.

## 5. The reusable component system

Extends the existing command kit (`components/command/`). All components consume `Sourced<T>` — that is the reuse mechanism: one envelope, nine consumers.

| Component | Spec |
|---|---|
| **`<ProvenanceRow />`** | The universal 14px strip: `FreshnessDot · SourceChip · AgeStamp · [confidence chip] · Why?`. Variants: `inline` (inside MetricReadout), `footer` (cards/dossier), `cell` (dense tier: dot + age only). This is DESIGN_LANGUAGE §5 made real. |
| **`<FreshnessDot />`** | State-mapped dot reusing `StatusDot`: fresh = `signal` subtle pulse · cooling = `harbor` static · stale = `down` static · dead = `crit` (the only blinking state — budgeted drama). Tooltip: age vs SLA. |
| **`<AgeStamp />`** | Humanized age in Data voice (`2h`, `3d`, tabular mono), ticking from one shared clock; hover = absolute tri-temporal stamps. |
| **`<ConfidenceMeter />`** | Exists — rebinds to `envelope.confidence`; popover renders the `confidence_jsonb` waterfall (the confidence of the confidence, Article 6 reflexively). |
| **`<SourceChip />`** | Source name + kind glyph; composites render "+N"; click scopes the Why drawer to that source's contributions. |
| **`<WhyDrawer />`** | The lineage surface (Command Center §6): lazy recursive fetch over `lineage_edges`, rendered in the IntelCard row grammar (Signal → Context → Forecast → Action); depth-limited with expand; every node row carries its own ProvenanceRow. One component everywhere — web, dossier, brief web-view. |
| **`<StaleVeil />`** | Wrapper applying degraded-truth treatments: 40% desaturation + cooling note at `stale`; SIMULATION badge when `designation='simulation'`; suppresses Act buttons at `dead` (Article 5 — no acting on dead data). |
| **`<ProvenanceProvider />`** | Context: registry lookups + the single shared ticking clock (one interval for the whole app — never per-component timers). |
| **`useProvenance(envelope)`** | Hook: live freshness state, re-derived client-side from `observedAt + slaSeconds`; returns `{state, age, label}` memoized to the shared tick. |

### 5.1 Enforcement (honesty as types and tests)

- **Type-level:** `MetricReadout`, `IntelCard`, `AssetCard`, dense-table cells migrate their data props from `number` to `Sourced<number>`. Transitional escape hatch: `unsourced(value)` — deprecated from birth, greppable, counted in CI. The debt is visible by design.
- **DOM-level:** every rendered metric node carries `data-provenance="<source>:<observedAt>"`. A Playwright sweep crawls every route and **fails the build on naked numbers**. Honesty becomes a regression test.
- **Showcase contract:** ProvenanceRow variants and all four freshness states (plus SIMULATION) render permanently in `/showcase`.

## 6. System surfaces built from provenance

- **Pipeline health (topbar dot, Command Center §4):** the worst freshness state across core sources, computed from `agent_runs` + the registry. Click → the **source ledger**: per source — last successful run, age vs SLA, rows written, cost (from `agent_runs.cost_cents`). The ops one-pager from ROADMAP Phase 0 is this surface, embryonic.
- **The brief:** every section footer renders source + observed_at (Phase 0: plain text); each claim deep-links to the Why drawer at `(focus, altitude)` (Phase 2+). The email and the command center expose the *same* envelopes — one brain, two viewports.
- **Degraded-truth banner:** stale core rates ⇒ alert-rail banner + recommendation suppression, driven entirely by envelope states — no bespoke logic.

## 7. Plumbing

1. **Assembly at the query layer** (Article 7): envelopes are joined server-side (source/model refs, SLA from registry, designation from table provenance); the client only ticks the clock. No component fetches its own provenance.
2. **Caching rule:** envelopes cache *with* their values; freshness state never caches (re-derived each tick from `observedAt`).
3. **Derived rows** already carry `confidence_jsonb` + `components_jsonb` (V4/EFE); the envelope points at them — zero duplication.
4. **Dead-source detection:** `state(source) = f(last successful agent_run, last data age, SLA, calendar)` — both conditions required for `dead` (a quiet pipeline with in-SLA data is merely idle).

## 8. Phasing (aligned to ROADMAP)

| Phase | Ships |
|---|---|
| **0 (launch)** | Brief footer provenance: plain-text sources + observed_at per section, from `content_jsonb.citations[]`. No components, no DDL. Cheap, constitutional. |
| **2 (command center on real data)** | Envelope contract in `nexus-shared`; ProvenanceRow/FreshnessDot/AgeStamp/StaleVeil on MetricReadout + IntelCard + dossier with real timestamps; registry as typed module; SIMULATION purge; the Playwright naked-number sweep. |
| **3 (Graph V4 Waves 1–3)** | WhyDrawer over `lineage_edges`; confidence waterfalls; registry promoted to `metric_provenance` table; source ledger reads live `agent_runs`. |

The dependency is honest: full lineage drawers need Wave 1's `lineage_edges`; but **timestamps, freshness, and source attribution need nothing but discipline** — the columns already exist on every observation table. Provenance is the rare luxury feature whose foundation is already paid for.
