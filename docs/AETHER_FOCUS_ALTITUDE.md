# AETHER — FOCUS + ALTITUDE ARCHITECTURE

**Architecture · v1.0 · 2026-06-11 · status: NAVIGATION LAYER IMPLEMENTED (no visuals)**
Implements [OPERATING_DOCTRINE](AETHER_OPERATING_DOCTRINE.md) Article 1. Code: `lib/focus-altitude.ts` (pure TypeScript — types, matrix, URL codec, transitions; zero UI).
**Amendment notice:** this document supersedes [COMMAND_CENTER](AETHER_COMMAND_CENTER.md) §1's altitude definition. Operational / Strategic / Executive — previously "lenses" — ARE the altitude axis. The camera tiers (Coast / Sector / Asset) remain as *derived framing*, computed from `(focus.kind, altitude)`. Logged in [DECISIONS](DECISIONS.md).

---

## 1. The two axes

### Focus — *what* is under attention (an ontology node, Graph V4)

| Kind | Example | Identity source |
|---|---|---|
| `place` | Neptun, Coasta de Sud | `places` (V4) / regions today |
| `market` | Neptun 4★ comp arena | `markets` / `competitive_sets` today |
| `corridor` | DE → Coast | `corridors` / `property_source_markets` today |
| `asset` | Hotel Terra (own) · a scraped competitor (observed) | `properties` / `scraped_properties` |
| `segment` | German families | `segments` (V4) |

### Altitude — *how far back* you stand (time horizon × aggregation × decision cadence)

| Altitude | Horizon | Cadence | Verbs | Density default | Alert budget | Rec mode | Forecast grain |
|---|---|---|---|---|---|---|---|
| **Operational** | today → 14d | daily | act, respond | focus → dense | 3 visible, full rail | **Act** (Article 5 surface) | per stay-date + intervals |
| **Strategic** | 30 → 90d | weekly | position, plan | focus | 2, daily digest | **Plan** (batched, no instant world-change) | curves + scenario compare |
| **Executive** | season / portfolio | monthly | allocate, judge | ambient | 1 + counts, thresholds only | **Counts** (allocation-grade only) | aggregates + calibration vs LY |

Invariant: `view = f(focus, altitude)` — plus two orthogonal modifiers: the stay-date **window** (timeline scrubber) and **scenario** (NULL = baseline). Nothing else is navigation state.

---

## 2. The 15-cell matrix

Conventions: *Visible* panels are defaults at rest (Command Center §4 budgets apply); *Hidden* = reachable by one gesture, never rendered by default; all alerts are scoped to the focus subgraph; recommendations always *target own assets* regardless of focus (Article 5 — an observed asset or a market never receives an Act button for someone else's property); every forecast renders with intervals + provenance (PROVENANCE registry governs freshness).

### 2.1 PLACE

| | Operational | Strategic | Executive |
|---|---|---|---|
| **Map** | Tight place framing; asset extrusions with occupancy emissive; today's weather overlay; event pulses | Place + feeding corridors; DP tint 30–90d; event windows on timeline | Region framing; place as one tinted sector among siblings with MH chips; leakage arcs outward |
| **Visible** | `today_pulse` (beach index, events ≤7d) · `sellout_cascade` (place-wide) · `weather_horizon` | `dp_curve` · `event_window` · `corridor_inflow` · `narrative_weather` (place-scoped) | `mh_composite` + waterfall · `season_pace` vs LY · `sibling_benchmark` · `leakage_waterfall` (summary) |
| **Hidden** | benchmarks, narrative library, calibration, leakage | today's pulse, per-asset detail, dense pickup | per-day data, raw signals, asset detail |
| **Alerts** | weather/maritime, event-day, place-wide sellout cascade | narrative lifecycle changes, event announcements, corridor capacity changes | MH threshold crossings only |
| **Recommendations** | none place-native; count chip of own-asset recs within place | season-prep positioning (batched) | allocation-grade placeholder (post-pilot) |
| **Forecasts** | 7d DP tint per day + weather horizon | 30–90d arrival pressure + DP bands | season occupancy/ADR aggregate vs LY band |

### 2.2 MARKET

| | Operational | Strategic | Executive |
|---|---|---|---|
| **Map** | Comp-set extrusions (height = ADR, emissive = availability stance); own asset harbor-lit | Market vs neighboring markets; substitution edges visible | Market as node in the coastal flow network; leakage arcs to external sinks |
| **Visible** | `rate_ladder` · `market_velocity` · `sellout_cascade` · `cp_web` (vs own asset) | `dp_curve` (30–90d) · `mix_composition` · `leakage_waterfall` (with intervals) · `supply_pipeline` | `mh_composite` + waterfall · `ro_aggregate` (own assets here) · `share_trajectory` |
| **Hidden** | leakage/substitution, narrative library, mix structure | per-day rate ladder, today's velocity | comp-set detail, signals, raw rates |
| **Alerts** | rival price moves > threshold, sellout events, velocity spikes | leakage trend breaks, narrative FRAMES changes, comp-set composition changes | MH crossings, structural shifts (e.g. new route) |
| **Recommendations** | market-triggered pricing recs targeting own asset (**Act**) | channel/positioning, seasonal min-stay policy (batched) | enter/exit/reweight (post-pilot) |
| **Forecasts** | market DP per stay-date, 14d slider | DP + ADR-index 90d curves with intervals | season RevPAR-index trajectory vs LY/region |

### 2.3 CORRIDOR

| | Operational | Strategic | Executive |
|---|---|---|---|
| **Map** | The arc, animated particle flow; origin pulse; chokepoint sensors (Fetești toll) highlighted | Corridor + competing corridors into the same market; capacity ceilings rendered | All corridors ranked by volume/value; concentration (Herfindahl) visual |
| **Visible** | `corridor_flow_live` (flights/traffic this week) · `segment_pace` (corridor-origin segments) · `disruption_feed` (typed signals, never news) | `corridor_capacity` (vs utilization) · `booking_window_dist` · `price_sensitivity` (cost-shock response) · `narrative_weather` (origin-scoped) | `corridor_concentration` · `corridor_ltv` (avg LTV per corridor) · `corridor_growth` |
| **Hidden** | elasticity/structure, resonance detail | today's flow detail | operational flow, segment micro-detail |
| **Alerts** | disruption events (cancellations, fuel spike onset, border), pace break vs expected | scheduled capacity changes, origin narrative shifts, sustained pace divergence | concentration threshold breach, structural origin shifts (FX/macro) |
| **Recommendations** | origin-targeted offer timing (**Act**: campaign) | channel/market development, corridor-segment rate fences (batched) | diversification priorities |
| **Forecasts** | 14d arrival pressure from this corridor | 30–90d corridor volume + share-of-market | season corridor-mix evolution |

### 2.4 ASSET (own — observed variant: intel panels only, recommendations always `none`)

| | Operational | Strategic | Executive |
|---|---|---|---|
| **Map** | Asset luminescent, close framing; comp set dimmed-visible context | Asset within market; capture / fair-share visual | Asset as node in portfolio (pilot: single asset + market context) |
| **Visible** | `today_digest` (the brief) · `pickup_pace` (vs pace band, 14d slider) · `dp_readout` `cp_readout` `ro_readout` · `rec_queue` (**Act**) · `otb_vs_forecast` | `forecast_curves` (30–90d) · `ro_decomposition` · `segment_mix` vs market opportunity · `positioning_panel` · `event_window` | `season_pnl` (RevPAR vs LY) · `calibration_scorecard` · `ro_aggregate` (season) · `mh_composite` (home market) |
| **Hidden** | season aggregates, market structure, narrative library | today's queue, per-day pickup detail | signals, daily ops, rec queue (count only) |
| **Alerts** | full tactical rail: rate moves, sellouts, pace breaks, weather windows, rec deadlines | positioning narratives, event announcements in window, calibration drift | calibration breaches, season-pace thresholds |
| **Recommendations** | full lifecycle, **Act**, deadline-sorted — the Article 5 home surface | product/packaging/channel + season posture (batched weekly) | investment-grade hints (post-pilot); counts |
| **Forecasts** | per-stay-date occ/ADR 14d, intervals + supersession freshness | 90d curves + season shape vs LY | season totals with confidence + LY actuals overlay |

**Default landing cell: `(asset: own, operational)`** — the pilot owner's morning seat.

### 2.5 SEGMENT

| | Operational | Strategic | Executive |
|---|---|---|---|
| **Map** | Origin-geography heat + corridors carrying the segment (no asset zoom — a segment has no single location) | Origin regions + narrative resonance overlay | All segments as weighted flows into the portfolio |
| **Visible** | `segment_pace_window` (are we inside their booking window *now*?) · `conversion_proxies` · `channel_activity` | `segment_profile` (window dist, elasticity, channel mix) · `segment_yield_compare` · `resonance_row` (NIS matrix row) · `segment_growth` | `mix_value` (share × LTV × growth) · `diversification` index · `bets_tracking` |
| **Hidden** | profile editor, structural panels | live pace | everything tactical |
| **Alerts** | in-window pace breaks (urgent: window open, pickup lags), resonant narrative spikes | origin structural changes (FX/macro), narrative lifecycle affecting segment | mix concentration, LTV trend breaks |
| **Recommendations** | segment-targeted campaign/offer (**Act**), rate fences | packaging / product-market fit, channel investment (batched) | segment portfolio allocation |
| **Forecasts** | expected bookings 14–30d, aligned to the segment's booking window | 90d segment volume + ADR potential | season mix evolution |

---

## 3. Navigation architecture

### 3.1 State and URL

```
CommandView = { focus: {kind, id}, altitude, window?: {from,to}, scenario?: id }
URL:  /c/{altitude}/{kind}/{id}?w=2026-08-07..2026-08-09&scn={scenarioId}
```

- The URL is the *entire* navigation state — shareable, restorable, no hidden client state (Article 1: deep links restore exactly).
- Brief deep links resolve to `(cited focus, operational, window = cited stay-dates)`.
- Existing routes (`/`, `/mapcn`, `/showcase`) remain; `/c/*` arrives with Phase 2 visuals and `/` redirects to the landing cell.

### 3.2 Preservation laws (the feel of the product)

1. **Focus change preserves altitude and window.** Jumping Terra → DE-corridor at strategic stays strategic, same dates.
2. **Altitude change preserves focus and window.** 1/2/3 moves the camera, never the subject.
3. Window and scenario are orthogonal: they survive every focus/altitude move until explicitly cleared.
4. Transitions are continuous (camera flight + panel morph) — never page swaps. (Visuals later; the state machine guarantees the inputs.)

### 3.3 Moves (the verb set)

| Move | Semantics | Resolution |
|---|---|---|
| **jump** | focus := any entity (⌘K search, any entity chip anywhere — the graph is the nav) | direct |
| **drill** | focus := canonical child | place→primary market · market→own asset (else top member) · corridor→dest market · segment→top corridor · asset→∅ (no spatial child; dossier is a panel, not navigation) |
| **ascend** | focus := containment parent; **at the top of containment, ascend raises altitude instead** | asset→market→place→parent place→(altitude+1) · corridor→dest market · segment→primary dest market |
| **lateral** | previous/next sibling within the parent scope ([ / ]) | market members, sibling places, corridor set, segment set |
| **pivot** | cross-edge jump along a non-containment edge (market→top corridor, narrative→framed market) | via Graph V4 edges |

Keyboard intent (spec only, wired with visuals): `1/2/3` altitude · `⌘K` jump · `U` ascend · `D` drill · `[` `]` lateral · `T` timeline focus.

### 3.4 Policy enforcement in the layer (not in components)

- `isActAllowed(view, target)` — true only when: altitude = operational ∧ target resolves to an own asset ∧ scenario = baseline (Article 5 + Graph V4 scenario law). Components never re-derive this.
- Cell specs are *data* consumed by the future panel orchestrator and by the Article-7 query layer (each Visible panel id maps to an ontology query + provenance envelope).
- Degraded-truth states (PROVENANCE §3) override cells: `dead` core data suppresses Act everywhere, regardless of cell policy.

### 3.5 History and breadcrumb

- Browser history records every `CommandView` change (URL-driven by construction).
- Breadcrumb = the containment chain of the focus (`Coasta de Sud / Neptun 4★ / Hotel Terra`), each crumb a jump.
- Back = previous view, exactly (focus + altitude + window + scenario).

## 4. Code map (`lib/focus-altitude.ts`)

| Export | Purpose |
|---|---|
| `FocusKind, Altitude, Focus, CommandView` | the state types |
| `ALTITUDE_META` | the §1 altitude table as data |
| `PanelId`, `PANEL_LABELS` | the panel registry (shared vocabulary with this doc) |
| `MATRIX: Record<FocusKind, Record<Altitude, CellSpec>>` | the §2 matrix as typed data |
| `cellFor(view)` | cell lookup |
| `encodeView / decodeView` | the §3.1 URL codec (validating, default-filling) |
| `withFocus / withAltitude / withWindow / withScenario` | the §3.2 preservation laws |
| `drill / ascend / lateral` | the §3.3 moves, via an injected `GraphResolver` (the module stays pure — no data fetching, no React) |
| `isActAllowed` | the §3.4 Article-5 gate |
| `DEFAULT_VIEW` | `(asset: own, operational)` landing |

Phase 2 wires this module to the router and the panel orchestrator; nothing in it imports React, Mapbox, or Supabase by design.
