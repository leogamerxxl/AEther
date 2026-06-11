# AETHER — NARRATIVE INTELLIGENCE SYSTEM (NIS)

**Architecture · v1.0 · 2026-06-10 · status: DESIGN (no code, no migrations)**
A first-class ontology layer on [GRAPH_V4](AETHER_GRAPH_V4.md): the engine that populates `narratives`, `narrative_ticks`, and narrative-borne `signals`, and prices stories in RON.
Constitutional bindings: Article 4 (signals are reasoning, not content), Article 3 (truth has a timestamp), Article 6 (lineage), GDPR doctrine (no person data).

---

## 1. Thesis

**Stories are the earliest tradable signal.** Before a booking exists, before a car starts driving toward the coast, a story moved someone: "the Romanian coast is cool again," "Greece is better value," "there's a new flight from Berlin." NIS makes stories measurable assets in the graph: detected, tracked, typed, decayed, geographically scoped, segment-resolved, and converted into expected RON with confidence intervals.

The chain (canonical NIS presentation):

```
NARRATIVE → ATTENTION → INTENT → MOVEMENT → DEMAND → SPEND → REVENUE
     │           │          │         │          │        │        │
  strength    exposure   dated     corridor   room-     ADR ×   capture
  per network per        searches, flows,     nights    basket  per asset
  × geo ×     segment    price     transport  by stay-
  segment                queries   capacity   date
```

Note on ordering: for the booked path (foreign families, 60–90d windows) Demand is *observed* before Movement (OTB pickup precedes arrival). NIS treats the chain as the canonical reasoning order and records per-segment lead/lag on every transition — both observation orders resolve to the same graph.

### Transfer functions (the chain made quantitative)

Each stage transition `s → s+1` carries, per (archetype × market × segment):

- **κ** — conversion coefficient (what fraction of stage-s energy reaches s+1)
- **L** — lag distribution (gamma-shaped; parameterized by segment booking window)
- **σ** — saturation (logistic ceiling; attention is finite, capacity is finite)
- Priors from the archetype; posteriors per market from `model_calibrations` (learned from Outcomes).

```
ΔRevenue(asset, stay_date) =
  Σ_segments  Exposure(n, seg, place)            -- §9: strength × reach × resonance
            × κ₁(A→I) ⊛ L₁ × κ₂(I→Mv) ⊛ L₂ × κ₃(Mv→D) ⊛ L₃   -- ⊛ = lag convolution
            × PriceResponse(valence)              -- §10: headwinds hit ADR, not just rooms
            × Capture(asset | market)             -- fair share × performance index
  bounded by σ at every stage, vs. the no-narrative counterfactual forecast
```

---

## 2. Position in the graph

NIS is **L2.5** — it consumes Evidence (L1) and Funnel measurements (L2), and produces Interpretation (L3):

```
L1 observations (social metrics, news, trends, schedules, indices, events)
        │  SENSE
        ▼
L2.5 NIS: DETECT → TRACK (ticks, lifecycle) → INTERPRET (signals) → ESTIMATE (RON)
        │                                            │
        ▼                                            ▼
L3 narratives + narrative-borne signals      L4 forecast adjustments,
   (with full lineage to L1)                    recommendation inputs
```

First-class means: NIS has its own entities, its own calibration loop, its own confidence semantics — not a feature bolted onto signals.

---

## 3. Entities (deltas on Graph V4 — deliberately minimal)

**NEW — `narrative_archetypes` (G):** the class library. One row per story-physics type:
`(id, code, name, detection_recipe_jsonb, decay_model, decay_params_jsonb, confidence_policy_id, geo_model, geo_params_jsonb, resonance_priors_jsonb [signed, per segment class], impact_model, impact_params_jsonb [κ/L/σ priors], resurgence_behavior, created_at)`

**EXTENDED — `narratives`:** `+ archetype_id → narrative_archetypes`, `+ counterpart_subject_kind/id` (for competitor-referenced stories: "Greece Better Value" is headwind on RO-coast *and* tailwind on Greece — paired `FRAMES` edges with opposite polarity enable substitution analysis).

**EXTENDED — `narrative_ticks`:** `+ place_id?`, `+ segment_id?` (geographic and audience resolution of strength, when resolvable; NULL = narrative-global).

**NEW (deferrable) — `narrative_analogs` (G):** the episode library: `(archetype_id, narrative_id, reference_curve_jsonb, measured_outcome_jsonb)`. Every measured narrative episode becomes a reference curve for forecasting the next one of its archetype. Until built, analog curves live in `impact_params_jsonb`.

Everything else rides existing V4 structures: exposure = `stage_measurements(stage='attention')` rows with `DERIVED_FROM` lineage to ticks; impact estimates land in `forecasts` (scenario = baseline) and `recommendations.expected_impact_jsonb`; calibration in `model_calibrations`. **Net new tables: 1 (+1 deferrable).**

---

## 4. The five-stage pipeline

1. **SENSE** — per-network collectors write L1 observations: social metrics (hashtag/sound velocity via Apify actors), search trends, news wires (event clustering into `geo_events`), flight schedules, fuel/price indices, event calendars, OTA review velocity. Each is a `signal_sources` row with SLA + `reliability_prior`. *Metrics only — never content bodies* (§12).
2. **DETECT** — archetype-specific detectors:
   - *anomaly*: attention series z-score > 3 vs. 28d seasonal baseline (viral, wellness)
   - *claim clustering*: LLM classifier groups mentions into thesis candidates (≤140-char thesis text) (revival, value-comparison, security)
   - *structural*: deterministic facts — route filed, advisory issued, index crossed threshold, event announced (access, cost, geopolitical, festival)
   **Embryo rule:** a candidate becomes a `narratives` row only after N independent corroborations (default 3 sources or 1 structural); below N it stays a watchlist entry inside the detector run. Anti-noise by construction.
3. **TRACK** — daily `narrative_ticks` per network (× place × segment when resolvable): `strength` ∈ [0,1] composited from reach × velocity × share-of-voice; lifecycle FSM driven by tick velocity: `emerging → building (dS/dt > θ₁ for k days) → peak (dS/dt ≈ 0 at high S) → fading (dS/dt < −θ₂) → dormant (S < ε)`, with archetype-specific resurgence (§7).
4. **INTERPRET** — emit stage-typed `signals` per affected Market: direction, magnitude via transfer priors, `half_life_days` from the decay model, confidence per §6, `narrative_id` set, full lineage to ticks and observations.
5. **ESTIMATE** — run the §1 transfer chain to per-asset, per-stay-date RON ranges; write forecast adjustments (superseding, never editing) and feed `expected_impact_jsonb` of any resulting recommendation. Always vs. the no-narrative counterfactual (`counterfactual_forecast_id`).

Every stage is an agent: logged to `agent_runs`, stamped with `model_version_id`, lineage written in the same transaction.

---

## 5. The six archetypes

### 5.1 `viral_social` — Viral TikTok trend

| Dimension | Design |
|---|---|
| **Detection** | Hashtag/sound velocity (d²views/dt² spike), creator-tier breadth (not just one big account), cross-network echo (IG Reels within 3–7d), search echo lag 5–10d. Anomaly detector, z > 3 vs 28d baseline. |
| **Confidence** | `NOISY_OR` across networks. Single-network prior LOW (~0.5 — metrics are gameable); cross-network echo is the main booster; bot-likeness discount; heavy freshness weighting. |
| **Decay** | `EXP` with spike-decay: t½ 10–20 days, power-law tail. Resurgence: cheap re-arm on a new trigger (new sound, new creator wave). |
| **Geographic influence** | Distance-decay ≈ 0 (digital); influence = audience geography of the networks (RO urban + **diaspora** reach matters); resolves to corridors via segment origins. |
| **Audience segments** | Gen-Z / young couples (RO urban + diaspora) lead; families lag 2–3 weeks (parents see trends late) — the lag *is* the family-segment L₁. |
| **Economic impact** | High attention amplitude, modest κ₁ (0.5–2% attention→intent); short window; mostly weekend/short-stay demand; ADR-neutral to mildly positive. Order of magnitude: 8M views → +12% attention index (RO-urban) → +0.8pp occupancy across 2 weekends ≈ +18–30k RON for a 60-room 4★. |

### 5.2 `geopolitical_risk` — Political instability (e.g., Black Sea security)

| Dimension | Design |
|---|---|
| **Detection** | News event clustering (`geo_events`), official advisories (structural, deterministic), "is X safe" search spikes, **booking-curve breaks** — cancellation upticks in OTB are a detection input, not just an outcome. |
| **Confidence** | Event existence near-certain for wire/advisory sources (prior ~0.85–1.0); *impact* confidence from analog-library match quality (2022 onset curve is the founding analog). The 3-number model (§6) earns its keep here. |
| **Decay** | `ASYM(onset_t½ ≈ days, recovery_t½ ≈ 90–180d)` — fear arrives fast and leaves slowly; perception lags resolution by months. Lifecycle parks at `dormant-but-armed`; resurgence is nearly free. |
| **Geographic influence** | Scope = whole destination country/coast. **Inverse-distance sensitivity** (opposite of gravity): far segments (DE, PL) are most spooked; domestic demand is resilient and partially substitutes. |
| **Audience segments** | Foreign families and seniors/wellness most elastic; domestic weekenders least; risk sensitivity is a segment profile field. |
| **Economic impact** | Unique double strike: headwind on Intent *and* direct cancellation pressure on existing Demand (mid-funnel + bottom-funnel simultaneously), plus defensive-discounting ADR pressure. Impact estimator = analog curve × exposure of foreign segment mix (per `property_source_markets`). |

### 5.3 `access_change` — New airline route (e.g., new route into CND)

| Dimension | Design |
|---|---|
| **Detection** | Deterministic: schedule feeds / airline PR / airport announcements; secondary confirmation via fare-search availability. Detection confidence ≈ 1.0 — the interesting question is never *whether*, always *how much*. |
| **Confidence** | Two-tier by construction: existence ~1.0; impact = `WEIGHTED`(capacity × load-factor priors × origin-market match to resonant segments). |
| **Decay** | Not decay — `STEP_RAMP`: a persistent capacity component (validity window = the flight schedule season) plus a decaying *novelty* attention component (PR buzz t½ ~30d). Two components, two clocks. |
| **Geographic influence** | Corridor-precise: origin-city catchment → CND → resort markets; classic gravity applies; mild spillover to adjacent markets. |
| **Audience segments** | Defined by origin-city demographics (new Berlin route → DE city-breakers + diaspora VFR traffic). |
| **Economic impact** | Raises the **Movement-stage capacity ceiling** (σ₂ moves, not just flow): impact = seats/week × load factor × destination share × room-nights/visitor × ADR, season-long horizon, high certainty relative to social narratives. The rare narrative where supply math dominates story math. |

### 5.4 `cost_shock` — Fuel price increase

| Dimension | Design |
|---|---|
| **Detection** | Structural index tracking (Brent, pump prices RO/DE/PL, airfare indices — `macro_observations` economic category already exists); threshold + velocity triggers. |
| **Confidence** | Detection ≈ 1.0 (it is an index). Impact via drive-share × price-elasticity priors per segment; cross-checked against observed pace divergence between near and far corridors. |
| **Decay** | `INDEX_TRACKING(source_metric, habituation_t½ ≈ 60d)`: strength follows the index level vs. 12-month baseline, but **habituates** — a price that stays high stops being a story even though it stays a cost. Salience ≠ level. |
| **Geographic influence** | The sign flips with corridor length: headwind on long drive corridors (DE→coast ~1,800 km), **tailwind on short ones** (București→coast 230 km — staycation substitution). Geo model = corridor-distance-weighted with signed response. |
| **Audience segments** | Drive-to families highly sensitive; fly-in segments lagged (airfare pass-through); luxury insensitive. |
| **Economic impact** | For the Romanian coast this is usually a **mix shift, not a demand drop**: net effect per asset depends on its source-market mix (Terra's 9 `property_source_markets` rows decide the sign). ADR mildly soft on far-feeder-dependent assets; domestic-heavy assets can net positive. |

### 5.5 `lifestyle_wave` — Wellness trend

| Dimension | Design |
|---|---|
| **Detection** | Slow-moving baskets: search topics ("spa litoral", retreat queries), blog/IG content volume, competitor product launches visible in scraped data, OTA filter usage when available. Mandatory seasonal decomposition (wellness searches peak every January — that is not a wave). |
| **Confidence** | Long-window `NOISY_OR`: low day-confidence, high trend-confidence; requires months of corroboration before `building`. |
| **Decay** | `LOGISTIC_WAVE(adoption_rate, plateau, slow_fade)` — an S-curve, not a spike; t½ measured in 6–18 months. The lifecycle FSM moves slowly and that is correct behavior, not lag. |
| **Geographic influence** | Origin: urban affluent (București, Cluj, Western EU). Destination influence is **asset-capability-conditional**: the narrative lifts the market, but impact is gated by whether an asset has a wellness product. Resonance reaches the market; capture requires capability. |
| **Audience segments** | 30–55 affluent couples, shoulder-season-willing — the strategic prize: this archetype **extends the season** (May–June, Sep–Oct concentration). |
| **Economic impact** | ADR-positive (+10–25% premium willingness on matching product) and shoulder-occupancy lift. Estimation = addressable segment size × capability match × premium. Uniquely, it feeds non-pricing recommendations (`rec_type='experience'` already exists in the schema): packaging beats price moves here. |

### 5.6 `event_hype` — Festival hype (e.g., a Mamaia mega-festival)

| Dimension | Design |
|---|---|
| **Detection** | Deterministic core (announcement → `geo_events`) + amplification tracking (lineup-drop social spikes, ticket sellout velocity). |
| **Confidence** | Event certainty high; attendance forecast from ticket-velocity signals; impact confidence *rises* as the date approaches (compression effects are well-documented analogs). |
| **Decay** | **`DEADLINE_ANCHORED`** — the anti-decay archetype: strength *rises* along an anticipation curve toward the event window, spikes, then collapses with a small afterglow (t½ ≈ 7d post). Beta-shaped curve anchored to the event dates. Proof of why decay is per-archetype config, not a global law. |
| **Geographic influence** | Sharp venue radius: a Mamaia festival is not Neptun demand — and can be **negative** for quiet-seeking segments nearby (displacement). Corridor surges from ticket-buyer origin cities. |
| **Audience segments** | **Signed resonance is mandatory**: 18–30 event-goers strongly positive; families negative *during* the window (noise displacement). One narrative, opposite signs by segment. |
| **Economic impact** | Compression pricing for near assets (event-night ADR +30–80%); displacement loss for family-positioned assets; net = f(asset position, distance, segment mix). Typical recommendation: min-stay 2 + ADR move on the window, watch comp-set sellout via `rate_observations.availability_state` / `rooms_remaining` — **a spillover detector we can run on data we already collect.** |

---

## 6. Confidence scoring — the three-number model

A narrative never has one confidence; it has three, conflating them is the classic failure:

| # | Question | Computed by |
|---|---|---|
| **Existence** | Is the story real (not bots, not one source)? | `NOISY_OR` over independent networks × source priors × bot discount |
| **Relevance** | Does it touch *my* market and segments? | subject-resolution quality × resonance-matrix match |
| **Impact** | Will it move RON, and how much? | transfer-calibration quality × analog-library depth |

Displayed confidence on a narrative-borne signal = `MIN_CHAIN(existence, relevance) × impact_calibration_factor`, with the full breakdown in `confidence_jsonb` (the confidence itself has lineage — Article 6 reflexively). Structural archetypes (route, fuel, advisory) split cleanly: existence ≈ 1.0 while impact starts modest and *earns* confidence through analogs.

## 7. Decay model library (per-archetype config, `decay_model` + params)

| Model | Shape | Archetypes |
|---|---|---|
| `EXP(t½)` | exponential, power-law tail | viral_social |
| `ASYM(onset_t½, recovery_t½)` | fast in, slow out | geopolitical_risk |
| `STEP_RAMP(ramp, validity_window)` + novelty `EXP` | persistent capacity + decaying buzz | access_change |
| `INDEX_TRACKING(metric, habituation_t½)` | follows an index, habituates | cost_shock |
| `LOGISTIC_WAVE(rate, plateau, fade)` | S-curve adoption | lifestyle_wave |
| `DEADLINE_ANCHORED(window, anticipation, afterglow_t½)` | rises toward a date | event_hype |

Decay applies to narrative strength (autonomous evolution between ticks), to the confidence of narrative-borne signals, and to forecast-adjustment weight. **A fresh tick always beats a decayed projection** — observation outranks model (Article 3).

## 8. Geographic influence models

- Baseline gravity: `influence ∝ origin_segment_mass × resonance / distance^α`.
- Archetype overrides: digital narratives α ≈ 0; geopolitical risk uses *inverse* distance (farther = more frightened); cost shocks use signed corridor-length response (§5.4).
- Place-resolved strength via `narrative_ticks.place_id`; competitor-referenced narratives carry paired opposite-polarity `FRAMES` edges (substitution analysis: Greece's tailwind is the measurable mirror of our headwind).
- Asset-level gating where applicable (`lifestyle_wave` capability condition).

## 9. Audience segments — the signed resonance matrix

`R[archetype × segment] ∈ [−1, +1]` — **signed** (festival: +0.8 youth, −0.4 families). Priors in `resonance_priors_jsonb`, posteriors learned per market. Exposure per segment = Σ networks `tick.strength × network.reach × network_audiences.share(segment) × R`. Each segment then runs its own κ/L chain (its booking window *is* its lag distribution). Segment profiles carry risk sensitivity (5.2) and price sensitivity (5.4) as first-class fields.

## 10. Economic impact estimation

1. Exposure (per segment × place) from §9.
2. Chain through κ₁…κ₃ with lag convolutions and saturations (§1) → Δdemand in room-nights per stay_date.
3. **Price response by valence** — the subtle one: headwind narratives can hit Spend without hitting Demand (a "better value elsewhere" story compresses achievable ADR even at flat occupancy). Valence → ADR elasticity is an archetype parameter.
4. Capture per asset (fair share within market × performance index) → ΔRON range with confidence.
5. **Interaction & saturation:** concurrent narratives combine sub-additively (attention is finite); opposing narratives (Coast Revival vs. Security Concerns) net via signed sum with dampening — never naive addition.
6. **Counterfactual discipline:** impact is always vs. the baseline forecast without this narrative's signals (`counterfactual_forecast_id`); Outcomes measured against that counterfactual update κ posteriors (`model_calibrations`) and grow the analog library. Every narrative episode AETHER lives through makes the next one cheaper to price.

## 11. Worked example — festival hype meets Hotel Terra

Festival announced for Mamaia, Aug 7–9. Detection: structural (`geo_events`) day 0. Anticipation curve arms. Resonance: +0.8 youth / −0.4 families; Terra is family-positioned, Neptun, ~45 km south.
- Signals emitted: youth-segment demand tailwind on Market *Mamaia* (not Neptun); family displacement headwind on coast-wide *quiet* positioning, small magnitude at 45 km.
- Watchdog armed on data we already have: comp-set `availability_state` / `rooms_remaining` in Mamaia for Aug 6–10 — sellout there flips a **spillover tailwind** signal for Neptun.
- Recommendation (if spillover fires): hold family ADR, open min-stay 2 on Aug 7–9, +6% on remaining doubles; expected impact +9–14k RON, confidence 0.61 (existence 1.0 × relevance 0.74 × impact cal 0.83); deadline Aug 1; lineage: event → ticks → signals → comp-set observations → forecast → this card.
- Post-event: outcome vs. counterfactual; κ for `event_hype` spillover at 45 km gets its first Romanian-coast posterior.

## 12. Guardrails

- **Article 4 firewall:** NIS stores metrics, thesis strings (≤140 chars), and source URLs in operational `raw_jsonb` — never article bodies, never post content, never feeds rendered to users.
- **GDPR:** aggregate channel metrics only. "Influencers" is a network *tier*, not named individuals — no creator profiling, no person rows, ever.
- **Truth:** until detectors run live, any narrative content in the UI carries the SIMULATION designation; narrative strengths are never hand-entered.
- **Surfacing** (per [COMMAND_CENTER](AETHER_COMMAND_CENTER.md)): Coast altitude shows the "narrative weather" panel (top narratives by |expected impact|, lifecycle-glyph + sparkline of strength); narratives render as reasoning sentences with Why? lineage — never as a content feed.

## 13. Build order (reality-checked)

- **Wave 2 of Graph V4** (ROADMAP Phase 3) is NIS's home; `narrative_archetypes` joins that wave. Nothing before launch.
- Pilot-feasible detector set, in order of cost-to-signal: (1) structural — routes, fuel indices, advisories, event calendars (deterministic, cheap, high-confidence); (2) Google Trends baskets (cheap, attention+intent); (3) news clustering into `geo_events` (existing table, LLM classifier); (4) social metrics via Apify actors (last — costliest, noisiest, needs the bot discount working).
- The first archetypes live should be `access_change`, `cost_shock`, `event_hype` (structural, defensible), then `geopolitical_risk`, then `viral_social` / `lifestyle_wave` as social sensing matures. Calibration before charisma.
