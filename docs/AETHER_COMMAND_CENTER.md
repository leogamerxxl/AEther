# AETHER — COMMAND CENTER

**Constitution · Document 5 of 7 · v1.0 · 2026-06-10**
Governs: how the ontology is operated — navigation, surface routing, the operating loop, and cognitive-load law.
Premise (Doctrine, Article 7): the command center owns **no data and no logic**. It is a viewport: `render( query( ontology, focus, altitude ) )`.

---

## 1. Navigation model: `view = f(focus, altitude)`

- **Focus** — the ontology node under attention (a Place, Market, Corridor, Asset, Signal, Forecast, Recommendation, or the Tenant portfolio as default).
- **Altitude** — abstraction level of the camera and of the data aggregation. Three altitudes; the same world.

| Altitude | Camera | Default focus type | Lens (audience) | Density default |
|---|---|---|---|---|
| **Coast** | tilted regional view, glowing sector regions (~50km) | Region / Markets | Executive | ambient |
| **Sector** | resort-level, luminescent asset extrusions | Market / Corridors | Strategic | focus |
| **Asset** | single building, dossier morph (~400m) | Asset | Operational | focus → dense |

Laws:
- Changing focus preserves altitude; changing altitude preserves focus (camera moves, subject persists).
- `(focus, altitude)` serializes into the URL; deep links restore exactly. The morning brief's links land on `(Asset: Terra, Asset altitude)` with the cited signal highlighted.
- Lenses (Executive / Strategic / Operational) are *presets* of altitude + density + panel set — not separate products.
- Altitude transitions are continuous (camera flight + shared-element morph), never page swaps. The Coast sector map and the Mapbox world are the same world at different altitudes — one cartography.

## 2. Surfaces

Six surface classes exist. Every entity × altitude pair routes to exactly one primary surface (or `hidden`) — silence is not allowed (Article 2).

1. **Map layer** — geometry on the world (regions, extrusions, glow, corridors as arcs).
2. **Overlay** — glass HUD anchored to the world (labels: diamond + stem; selection halos).
3. **Panel** — floating glass Tile/Pane docked to viewport edges (intelligence, readouts).
4. **Alert rail** — ranked, budgeted interrupt surface (WarningPanel lineage).
5. **Timeline** — the temporal scrubber (forecast slider lineage; stay-date forward).
6. **Dossier** — the focused deep-dive (altitude-morph from a card; full lineage view).

## 3. Routing matrix (entity × altitude)

| Entity | Coast | Sector | Asset |
|---|---|---|---|
| **Place** | map: glowing sector regions, demand-tinted | map: district context | overlay: locality label |
| **Market** | panel: market readouts (occ, ADR index, pace) | map+panel: comp-set extrusions + market panel | panel: market context strip |
| **Corridor** | map: arcs w/ flow weight | panel: arrival pressure per corridor | hidden (rolls into context) |
| **Asset (own)** | map: single `harbor` beacon | map: warm luminescent extrusion | dossier: full KPIs, twin, strategy |
| **Asset (observed)** | hidden (aggregated into market) | map: cool extrusions, ADR-height | panel: competitor movement rows |
| **Signal** | only if magnitude ≥ regional threshold → alert rail | panel: top-k by leverage, as reasoning sentences | dossier: full signal stack w/ lineage |
| **Forecast** | overlay: sector demand tint (7–30d) | timeline: market curve + interval | timeline+panel: occ/ADR slider w/ interval band |
| **Recommendation** | count badge on sectors | panel: ranked queue (impact × confidence) | **IntelCard with Act button** (the only actionable surface — Article 5) |
| **Action** | hidden | timeline: markers | timeline: markers + pending state |
| **Outcome** | exec panel: calibration scorecard | panel: per-market hit-rate | dossier: outcome vs. forecast overlay |
| **Event** | map: pulse at Place (major only) | map: pulse + window on timeline | timeline: window shading |

Matrix law: a new entity type may not ship until its row exists here.

## 4. Panel grammar (per altitude, at rest)

- **Left rail** — context & navigation: focus breadcrumb, layer selector, density toggle.
- **Right rail** — intelligence: IntelCards (Signal → Context → Forecast → Action rows), ranked.
- **Bottom** — timeline scrubber when focus has a temporal dimension.
- **Top** — alert rail (collapsed to a count chip when calm) + provenance/system health dot.

Budgets (cognitive-load law): ≤ 2 Panes, ≤ 5 Tiles, ≤ 3 visible alerts, ≤ 7 map label pills at rest; everything else behind one gesture. Panels at rest cover ≤ 40% of viewport. Every number carries the provenance row (Design Language §5).

## 5. The operating loop — "it moves when operated"

The command center is not a report; it is a control room. The loop, with its visible consequences:

```
SIGNAL (new) ──► alert-arrival pulse → IntelCard enters right rail (ranked)
   │
FORECAST (updated) ──► timeline band shifts; sector tint re-blends; numbers tick
   │
RECOMMENDATION (proposed) ──► IntelCard gains Act affordance + deadline decay
   │  operator: accept / adapt / decline (recorded with actor + ts)
ACTION (executed) ──► harbor edge-sweep on the asset; timeline marker drops
   │
RE-FORECAST ──► curves visibly re-fit within the session (the world responds)
   │
OUTCOME (measured, T+window) ──► calibration scorecard updates;
                                  the recommendation's card closes with a verdict
   │
CALIBRATION ──► confidence functions update; tomorrow's brief cites the hit-rate
```

Laws:
- Every loop stage writes to the ontology first; the UI animates *because the data changed*, never as theater (Design Language §1.4).
- A recommendation with no expected-impact and no evaluation window may not render an Act button.
- Declines are as valuable as accepts: both feed calibration; the UI must make declining one tap, never shameful.

## 6. Explainability surface (Article 6)

- Every number, signal sentence, and recommendation exposes **"Why?"** within one gesture → lineage drawer: observation rows (source, observed_at, raw excerpt) → signal typing → forecast model version → recommendation reasoning.
- The lineage drawer is the same component everywhere (brief web-view included). Trust is a primitive, not a feature.

## 7. Degraded-truth states

The command center must be honest about its own health (Article 3):

| State | Trigger | Behavior |
|---|---|---|
| **Fresh** | all sources within SLA | normal |
| **Cooling** | a source beyond SLA | affected surfaces desaturate 40%; provenance rows flag age in `down` |
| **Stale** | core rates > 24h old | banner on alert rail; recommendations suppressed (no acting on dead data) |
| **Simulation** | demo/seed data anywhere | persistent "SIMULATION" designation on every affected surface |

## 8. Relationship to the morning brief

The brief is the command center's Asset-altitude digest, generated from the same ontology queries (Article 7): top signals by leverage, the forecast delta, ≤ 3 recommendations, calibration note. Every brief claim links into `(focus, altitude)` deep links. One brain, two viewports — email for the 07:00 ritual, the command center for the follow-through.
