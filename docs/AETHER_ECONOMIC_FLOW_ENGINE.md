# AETHER — ECONOMIC FLOW ENGINE (EFE)

**Architecture · v1.0 · 2026-06-10 · status: DESIGN (no code, no migrations)**
The hydraulics of [GRAPH_V4](AETHER_GRAPH_V4.md): tracks five flow types across the Place/Market/Corridor/Asset topology, applies conservation laws to infer what is not directly observed, and computes the five operating metrics: **Demand Pressure, Demand Leakage, Market Health, Competitive Pressure, Revenue Opportunity.**
Sibling of [NARRATIVE_INTELLIGENCE](AETHER_NARRATIVE_INTELLIGENCE.md): NIS explains *why* flows change (stories); EFE computes *where* flows go (structure). Both emit into L3/L4.

---

## 1. Purpose and position

A regional economy is a flow network. Demand is not a number on a dashboard — it is a quantity that forms somewhere (attention in Berlin apartments), moves through constraints (A2 motorway, CND runway, OTA channels), pools where capacity binds (compression), and leaks where substitutes win (a Greek island). EFE is the L2 engine: it populates the funnel (`stage_measurements`) with **stocks on nodes**, a new `flows` ledger with **quantities on edges**, and derives the five metrics that every panel, alert, and recommendation upstream consumes.

```
                      ┌───────────── EFE ─────────────┐
L1 evidence ──────────► flows (edges) + stocks (nodes) ├──► flow_metrics (the five)
   rates, OTB, traffic │ conservation + inference      │      │
   trends, schedules   └───────────────────────────────┘      ▼
                                                       L3 signals ("compression
NIS narrative signals ──── overlay ──────────────────►  forming Aug 7–9")
                                                       L4 forecasts · recommendations
```

## 2. Graph model

### 2.1 Formal definition

`G = (N, E, F, S, M)`

**N — nodes** (all are Graph V4 citizens):
- `Place` (country → region → resort → locality) — incl. **`kind='external'`** places (Greece, Bulgaria, Austrian Alps): the sinks and sources that make leakage accounting possible. Without external nodes, leakage is invisible by construction.
- `Market` (demand arena at a place)
- `Asset` (capture point inside a market; own + observed)
- Origin places of Segments (where demand is born)

**E — edges:**
| Edge | From → To | Carries |
|---|---|---|
| `Corridor` | origin Place → dest Market | modes, capacity ceiling, travel time, seasonality |
| `Capture` | Market → Asset | fair share weight, performance index |
| `Substitution` | Market ↔ Market (incl. external) | cross-elasticity, evidence refs — **new edge type for V4 catalog** |
| `Channel` | attribute on booking/money flows (OTA, direct, walk-in) | commission, lead time |

**F — flows:** typed quantities on edges per time bucket × segment:
`flow(type ∈ {attention, people, vehicles, bookings, money}, origin, dest, corridor?, channel?, segment?, bucket, value, unit, observed|derived, confidence)`

**S — stocks:** node states per time: capacity, OTB rooms, occupancy, inventory open/closed — these live in `stage_measurements` (node-scoped). **Stocks on nodes, flows on edges** is the load-bearing separation.

**M — metrics:** the five composites (§3), computed on nodes (DP, MH, RO), edges (leakage paths), or node-within-market (CP).

### 2.2 Conservation laws per flow type (the engine's physics)

| Flow | Conservation | Consequence for inference |
|---|---|---|
| Attention | **none** — created and destroyed freely | never infer attention from balances; only measure it (NIS) |
| People | conserved over short windows (a tourist at the coast is somewhere) | arrivals − departures = Δpresent; presence inferable from partial counts |
| Vehicles | conserved on road segments; vehicles are *carriers* | people ≈ vehicles × occupancy factor (seasonally calibrated); one toll sensor constrains a whole corridor |
| Bookings | semi-conserved with **substitution**: a booking lost here may appear in a substitute market | unexplained funnel drop-off + substitute-market gain = leakage evidence |
| Money | strictly conserved per transaction | the only flow with accounting identity: rooms × ADR + ancillary = spend; reconciles all upstream estimates |

### 2.3 The inference cascade

Observe what is cheap, infer what is dear:

```
observed:  comp-set rates + rooms_remaining (daily) · own OTB · search trends ·
           toll/traffic counts · flight schedules · (later) card aggregates
inferred:  market booking velocity   ← Δ(rooms_remaining) across comp set, day over day
           corridor people flow      ← vehicle counts × occupancy factor + flight loads
           demand formed             ← intent index × historical conversion (funnel ratios)
           leakage                   ← demand formed − captured − died, signed by
                                       substitute-market corroboration
```

The single highest-value derived flow available **today**: day-over-day decreases in `rate_observations.rooms_remaining` across the 12-property comp set = market booking velocity; `availability_state` transitions = the sellout cascade = compression early warning. The pilot's pressure sensor already ships in the scraper.

## 3. The five metrics

All five are written to `flow_metrics` with `components_jsonb` (every index decomposable — Article 6 applies to metrics, not just claims) and a confidence breakdown. All are computed per segment where data allows, and **per stay-date** (stay-date forward, Doctrine II.4).

### 3.1 Demand Pressure (DP) — node × stay_date

```
DP(market, d) = projected_room_nights_demanded(market, d) / available_capacity(market, d)
```
- Demand projection = OTB pace (own) + comp-set booking-velocity inference + intent flows × conversion, blended by recency.
- Bands: `DP > 1.0` compression (pricing power), `0.8–1.0` firm, `0.6–0.8` balanced, `< 0.6` soft.
- Derivatives matter as much as level: `dDP/dt` (pressure building or bleeding) and `P(DP > 1)` (compression probability) are first-class outputs.
- Scopes: Market (primary), Place (rollup), Asset (own-capacity version = classic RM occupancy pressure).

### 3.2 Demand Leakage (DL) — destination level, edge-decomposed

Demand that formed *for this destination* but was captured elsewhere. Strictly separated from within-market competitive loss (that is CP):

```
DL(market, window) = demand_formed(intent indexed to market)
                   − demand_captured(bookings into market)
                   decomposed into: → substitutes (signed by substitute-market evidence)
                                    → died (no trip taken)
                                    → deferred (window shift)
```
- Substitution attribution uses `Substitution` edges + NIS counterpart narratives ("Greece Better Value" headwind here *is* the tailwind there — the paired FRAMES edges give leakage its direction).
- Expressed as a rate (% of formed demand) and RON (priced at segment ADR norms).
- Honesty rule: DL has the widest confidence bands of the five; it ships with intervals or it does not ship.

### 3.3 Market Health (MH) — composite 0–100 per market × horizon

Weighted blend, each component normalized against the seasonal baseline:

| Component | Signal of |
|---|---|
| DP level + trend | demand adequacy |
| ADR trajectory vs inflation | pricing integrity |
| Booking-window stability | distress (shrinking windows = panic selling) |
| Cancellation rate drift | commitment quality |
| **Corridor concentration (Herfindahl over source markets)** | fragility — a market fed 70% by one corridor is one fuel shock from a bad season |
| Comp-set discounting prevalence | supply discipline |
| Net narrative pressure (NIS, signed) | story weather |

Health ≠ pressure: a market can be high-DP and unhealthy (over-concentrated, discount-addicted). MH is the executive-altitude number; its component breakdown is the strategic-altitude view.

### 3.4 Competitive Pressure (CP) — asset level, directional

How hard rivals squeeze a specific asset, decomposed by *who* and *how*:

| Component | From (available today) |
|---|---|
| Rate aggression | comp median moves vs own; discount depth × frequency (`rate_observations`) |
| Availability stance | rivals' open/closed + `rooms_remaining` velocity |
| Quality-adjusted price position | rate vs `review_score` (already in `scraped_properties`) — price above quality-fair line = vulnerability |
| Pickup share shift | availability-velocity share vs fair share |
| Product moves | (later, via NIS `lifestyle_wave` detection of new packages) |

Output: CP index + the **top-3 pressuring properties** + the stay-dates where pressure concentrates + the mode (price vs availability). Fully computable from the 462 rows already collected — CP is the pilot's first live metric.

### 3.5 Revenue Opportunity (RO) — the synthesis, in RON

RO is not a forecast of what will happen; it is the **priced gap between the baseline and the optimal-action scenario** (Graph V4 scenario differencing):

```
RO(asset, window) = E[revenue | optimal actions] − E[revenue | baseline]
  = Σ_staydates  compression_opportunity   (DP>1 while own price below clearing)
               + capture_opportunity       (rival sellout spillover; CP gaps)
               + leakage_recovery          (addressable DL via channel/product action)
               + mix_opportunity           (segment yield upgrade)
               − execution_risk            (action cost, cancellation drift, brand)
```

Each component maps 1:1 to a `rec_type` — RO is the womb of recommendations: a recommendation is an RO component that crossed an actionability threshold with sufficient confidence. The expected-impact number on every IntelCard is its RO component, lineage included.

## 4. Inputs

Per flow, with latency class and pilot availability (**P0** = available now, **P1/P2/P3** = per [DATA_SOURCES](AETHER_DATA_SOURCES.md) phases):

| Flow | Input | Latency | Trust prior | Avail. |
|---|---|---|---|---|
| Attention | NIS exposure (trends, social, news) | hours–days | varies (NIS §6) | P1–P2 |
| Intent (bridge) | dated searches, price queries | days | medium | P1–P2 |
| People | INS arrivals/overnights statistics | **months (laggy)** | high | P0 (calibration only) |
| People | event attendance, (later) telecom aggregates — *aggregate-only, GDPR §8* | days | medium | P2–P3 |
| Vehicles | A2 toll (Fetești) + DN39 traffic counts — **the chokepoint sensor for the entire coast** | daily | high | P1 |
| Vehicles | CND flight schedules × load factors; ferry/rail | weekly | high | P1–P2 |
| Bookings | own OTB (`otb_observations`) | daily | highest | **P0** |
| Bookings | comp-set `rooms_remaining` / `availability_state` deltas → market booking velocity | daily | medium-high | **P0 — already scraped** |
| Bookings | OTA review-count deltas (trailing arrival proxy) | weekly | low-medium | P1 |
| Money | own ADR/RevPAR (`otb_observations`), market ADR (`rate_observations`) | daily | highest / high | **P0** |
| Money | card-spend aggregates (bank partnerships), VAT stats | monthly–quarterly | high, laggy | P3 |

Doctrine: laggy-but-true sources (INS, VAT) are **calibrators** for fast-but-noisy proxies, not competitors to them. The proxy gives the day's answer; the statistic grades it months later; the calibration factor closes the gap.

## 5. Forecasting strategy

Seven layers, each falling back gracefully to the one above it:

1. **Seasonal baseline** per metric × node: day-of-week × week-of-year × holiday calendars (RO/DE/PL). The floor every other layer adjusts.
2. **Hierarchical pooling** — *mandatory at pilot scale*: 1 own asset + 12 observed + 462 observations cannot support per-asset models. Bayesian shrinkage toward market priors; assets borrow strength from the comp set, markets from the region. Thin history widens intervals, never silently fails.
3. **Flow propagation**: upstream forecasts downstream via the shared NIS transfer machinery (κ, lag convolution, saturation): intent leads bookings by segment booking windows; corridor capacity ceilings cap movement; conservation laws sanity-check every projection.
4. **Pickup dynamics** per stay-date: pace curves vs historical pace percentiles (classic revenue management, applied at market level too — comp-set booking velocity gives the market a pickup curve of its own).
5. **Narrative overlays** from NIS enter as signal adjustments with their own confidence and decay — never baked into baselines.
6. **Ensemble + intervals**: every forecast row is a distribution (`interval_low/high`, optionally `distribution_jsonb`); point estimates are a UI courtesy, not the product.
7. **Hierarchy reconciliation**: asset / market / place forecasts are reconciled (proportional top-down blend at pilot; MinT-class later) so the command center shows **the same number at every altitude** — forecast coherence is what makes `f(focus, altitude)` navigation trustworthy.

Calibration loop: forecasts vs realized → `model_calibrations` → confidence factors and pooling weights update. Cold-start honesty: season one runs wide intervals and structural priors; the engine's first-year job is to *instrument and calibrate*, and the UI says so (Truth Doctrine).

## 6. Visualization strategy

Night Harbor grammar ([DESIGN_LANGUAGE](AETHER_DESIGN_LANGUAGE.md)) + altitude routing ([COMMAND_CENTER](AETHER_COMMAND_CENTER.md)). The flow grammar, fixed across all altitudes:

- **Flows** = animated particles/dashes along edges; velocity ∝ rate, density ∝ volume. Reduced-motion: static gradient arrows.
- **Stocks** = fills and extrusion heights.
- **Pressure** = glow intensity on the semantic ramp (`signal` cyan → `warn` → `crit`).
- **Money** = always `harbor` amber (the one warm light — doctrine).
- **Confidence** = opacity/dash style; low-confidence flows visibly tentative.
- Every metric surface carries the provenance row; every number opens its `components_jsonb` waterfall on "Why?".

**Coast altitude (executive):** the flow map. Corridor arcs from origin countries with particle flow; sector regions (the existing CoastalSectorMap blobs) tinted by DP; **leakage rendered as outbound arcs exiting toward the map edge** (the Greece arc leaving the frame is the single most persuasive image the product can show an owner); MH chips per sector; NIS narrative-weather panel.

**Sector altitude (strategic):** market pressure gauge (existing RingGauge, semantically wired to DP + compression probability); comp-set extrusions with height = ADR and emissive = availability stance (the luminescent buildings gain meaning: a building going dark is selling out); per-corridor inflow bars with capacity ceilings; CP web — directional threads from the top-3 pressuring assets onto the focused one.

**Asset altitude (operational):** pickup curve vs pace-percentile band per stay-date (the classic RM chart, Night Harbor-styled, with the forecast interval as a glass band); DP/CP/RO MetricReadouts with provenance; the **demand waterfall** (formed → captured → leaked-to-rivals → leaked-to-substitutes → died) as a cascading bar; RO decomposition card whose components *are* the recommendation queue.

**Dense tier:** the flow ledger — Bloomberg-style table (corridors × {flow, Δ, DP, capacity, confidence}), 28px mono rows, designed for the forty-facts test.

**Timeline:** the stay-date scrubber (generalizing the AssetCard slider): scrub forward and watch DP tint, arcs, and extrusion emissives evolve — pressure as weather you can fast-forward.

**The loop made visible:** accepting a pricing recommendation re-runs RO; arcs, gauges and the waterfall shift within the session — the world responds when operated (COMMAND_CENTER §5).

## 7. Schema deltas and build order

**New tables (3):**
- `flows` `(id, flow_type, origin_kind, origin_id, dest_kind, dest_id, corridor_id?, channel?, segment_id?, bucket date, granularity, value, unit, is_derived, confidence, confidence_jsonb, source_id?, model_version_id?, agent_run_id?, created_at)` — indexes `(flow_type, dest_kind, dest_id, bucket)`, `(corridor_id, bucket)`
- `flow_metrics` `(id, metric_code ∈ {demand_pressure, demand_leakage, market_health, competitive_pressure, revenue_opportunity}, subject_kind, subject_id, segment_id?, stay_date?, bucket, value, components_jsonb, confidence, confidence_jsonb, model_version_id, agent_run_id, created_at)`
- `market_substitutions` `(id, market_id, substitute_kind ∈ {market, external_place}, substitute_id, cross_elasticity, evidence_jsonb, valid_from, valid_to)`

**Extensions:** `places.kind` gains `'external'`; V4 edge catalog gains `SUBSTITUTES_WITH`. Everything else (stocks, signals, forecasts, calibration, lineage) rides Graph V4 unchanged.

**Wave placement:** EFE computation joins **Wave 2** (it is the other half of the measurement layer, beside NIS); `market_substitutions` and external places join Wave 1 reference backfill. Nothing before launch.

**Pilot-today subset (no new collectors, current 462 rows + daily scrape):** CP full computation; DP proxy from availability deltas + sellout cascade; RO compression + capture components. This subset alone upgrades the morning brief from "competitor X moved −5%" to "market velocity doubled, two rivals near sellout Aug 7–9, compression probability 0.7 — hold price, you are positioned to capture." That sentence is the engine's reason to exist.

## 8. Guardrails

- **GDPR (hard line):** people/vehicle flows are *aggregate counts only* — toll totals, traffic counts, anonymized telecom aggregates with k-anonymity at source. AETHER never stores, requests, or infers individual movement. No device IDs, no trajectories, no re-identification risk surface. If a source cannot prove aggregation, it does not enter L1.
- **Truth:** derived flows are marked `is_derived` with method in lineage; inferred numbers render with their confidence, and the UI cools when calibrators (INS, VAT) later disagree with proxies.
- **No metric without components:** a composite that cannot show its waterfall is decoration, and decoration is banned from command surfaces.
