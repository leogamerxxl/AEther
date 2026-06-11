# AETHER — LIVING MARKET SIMULATION LAYER (LMS)

**Architecture · v1.0 · 2026-06-11 · status: DESIGN**
The layer that makes the market *react*. Binds: [GRAPH_V4](AETHER_GRAPH_V4.md) (scenarios, forecasts, outcomes, calibration), [ECONOMIC_FLOW_ENGINE](AETHER_ECONOMIC_FLOW_ENGINE.md) (flows, DP/CP/RO, transfer functions), [NARRATIVE_INTELLIGENCE](AETHER_NARRATIVE_INTELLIGENCE.md) (exogenous forcing), [PROVENANCE](AETHER_PROVENANCE.md) (confidence law), [WORLD](AETHER_WORLD.md) (where reactions render), [COMMAND_CENTER](AETHER_COMMAND_CENTER.md) §5 ("it moves when operated").

---

## 1. Thesis

**Belief state, not game state.** Cities Skylines owns its citizens; AETHER does not own the Black Sea coast. The simulation is therefore a *calibrated structural model of a partially observed market*: every parameter is a belief with an interval, every reaction it renders is a prediction with provenance, and reality grades the model daily. The "living" feel comes from three properties, none of which require pretending omniscience:

1. **Immediate propagation** — any state change (your price move, a rival's scrape, a narrative tick) visibly ripples through the causal graph in under a second.
2. **Reactive agents** — competitors are modeled as behavioral policies *learned from their observed rate histories*, with fit quality. NPCs with personalities — and confidence scores.
3. **Daily reconciliation** — every morning, yesterday's predictions meet yesterday's observations; parameters update; the sim gets sharper. The loop closes through reality, not inside the model.

**One engine, four uses.** Baseline forecasting = the sim run with no intervention. A scenario = the sim run with assumptions (Graph V4 `scenarios`). A recommendation's expected impact = the *difference* of two runs (EFE already defines RO as scenario differencing). The live "drag the slider and watch the world react" = an interactive scenario run. There is no separate forecast engine to keep consistent with the sim — they are the same artifact.

## 2. Position in the stack

```
NIS signals + EFE flows/stocks + observations          (inputs, L1–L3)
        │
   ┌────▼─────────────────────────────────────────┐
   │ LIVING MARKET SIMULATION                      │
   │  ParameterSet (beliefs) · SimAgents · Loops   │
   │  fast path (linearized) + full path (agents)  │
   └────┬─────────────────────────────────────────┘
        │ writes: forecasts (+ sensitivities), flow_metrics (projected),
        │         scenario results, recommendation expected_impact
        ▼
Decision layer (L4) → World overlays react (WORLD §8) → Outcomes → calibration → ParameterSet
```

## 3. Simulation entities (the cast)

| Entity | Role | Key state / parameters |
|---|---|---|
| **SimMarket** | the arena | capacity by class, seasonal demand baseline, market price index |
| **SimSegment** | demand agents — *cohorts, never individuals* (GDPR + honesty) | volume potential per stay-date, price elasticity ε, cross-elasticity to substitutes, booking-window distribution, channel mix, narrative resonance |
| **SimAsset (own)** | the controlled supply agent | price/inventory levers, capacity, quality position (review score), product capabilities |
| **SimAsset (competitor)** | reactive NPCs | **behavioral policy fit from `rate_observations` history**: archetype ∈ {follower, leader, anchor, discounter, erratic}, reaction lag distribution, follow ratio, sellout behavior, **fit quality** (how predictable this rival has been) |
| **SimCorridor** | access constraints | capacity ceiling σ, travel cost sensitivity (fuel response), arrival lags |
| **SimForcing** | exogenous terms | NIS narrative signals, events, weather indices — modify segment attention/intent; never simulated, only injected |
| **ChoiceModel** | the matching engine | each tick, each segment's demand per stay-date allocates across assets via discrete choice (logit) over price, quality, position, availability — **the outside option (book a substitute destination, or don't travel) *is* Demand Leakage** (EFE §3.2 falls out of the choice model rather than being computed separately) |
| **SimClock** | bitemporal ticks | steps over *booking days*; each booking day places demand onto future *stay-dates* per window distributions — stay-date forward by construction |
| **ParameterSet** | the belief registry | every parameter = (value, interval, confidence, calibration window, lineage); versioned via `model_versions`; updated only by the calibration loop, never by hand |

## 4. Feedback loops (named, gained, damped)

| # | Loop | Sign | Mechanism | Governance |
|---|---|---|---|---|
| L1 | **Price → Demand** | − | own ADR ↑ → choice share ↓ per ε → occupancy ↓; the RevPAR optimum emerges from the tension | ε bounded by calibration; never extrapolated beyond observed price range without widening intervals |
| L2 | **Competitive reaction** | − (restoring) | rivals observe your move at their fitted lags → followers partially match → market index shifts → your *relative* position partly restores → second-order demand effect. This is why naive elasticity overestimates gains — the sim shows the equilibrium path, not the first-order fantasy | competitors are never modeled doing what they have never done (policy support = their observed history); beyond that requires an explicit scenario assumption |
| L3 | **Compression** | + (capacity-bound) | demand > rival capacity → sellouts → spillover to remaining supply → DP > 1 → pricing power. The Uber-surge loop — pressure-derived price guidance, *recommended, never imposed* (Article 5) | hard-capped by physical capacity; positive loop terminates naturally |
| L4 | **Corridor pressure** | − | demand shifts across markets → corridor utilization changes → access cost/availability feeds back into segment effective demand | σ ceilings from EFE; conservation checks |
| L5 | **Narrative feedback** | − / slow | sustained discounting feeds "cheap destination" narratives → price-sensitive mix → ADR ceiling falls (and the reverse for premium discipline) | months-scale, low confidence, always flagged; influences strategic cells only |
| L6 | **Booking-window pacing** | − | today's bookings deplete tomorrow's demand pool per stay-date; pace vs expected re-estimates remaining demand (pickup mechanics) | reconciled daily against OTB |
| L7 | **Calibration (meta)** | learning | predicted vs realized → parameter posteriors update (bounded step) → tomorrow's sim is sharper | the only loop allowed to change parameters; big residuals also *lower* confidence and emit a "model surprised" signal — surprise is information |

Stability law: every loop carries an explicit damping factor; the system must converge within the simulation horizon. Modeled price wars that oscillate beyond historically observed bounds are clamped and flagged rather than rendered as prophecy.

## 5. Recalculation logic

### 5.1 Event-driven, not batch

State changes (action applied, new scrape, OTB row, signal tick, scenario assumption, slider drag) enter a **dirty-propagation DAG**: the change marks downstream nodes dirty along causal edges; recomputation proceeds in topological order; clean branches reuse cached results. This — not raw speed — is what makes the product feel alive: the world reacts to *the thing that changed*, immediately, everywhere it matters and nowhere else.

### 5.2 Two-tier evaluation

| Tier | Latency | Mechanism | Honesty contract |
|---|---|---|---|
| **Fast path** | < 100 ms, in-UI | local linearization: the nightly full run emits a Jacobian of sensitivities (∂occ/∂ADR, ∂RevPAR/∂ADR, ∂leakage/∂ADR per stay-date × segment) stored as `sensitivities_jsonb` on the forecast row. Dragging the ADR slider animates the linearized response instantly — no sim in the browser | renders with *widened* intervals + "estimating…" provenance state |
| **Full path** | seconds, async | the actual run: choice model + competitor policies at their lags + capacity constraints + ensemble | replaces the linear estimate; the UI visibly *settles* (numbers re-fit, bands narrow) — the settle is honest, not theatrical |

### 5.3 Tick structure (full path)

```
for booking_day b in today..horizon:
  inject forcing (signals, events, weather) active at b
  for each segment: draw booking-day demand; place onto stay-dates (window dist)
  allocate via ChoiceModel across assets (price, quality, availability at b)
  apply competitor policy updates due at b (their fitted reaction lags)
  enforce capacity; emit bookings, flows, sellouts, leakage (outside option)
  update DP / CP / pace state
```

Ensemble: N runs (pilot N ≈ 200 — the state space is tiny) with parameter draws from posteriors + demand noise → full distributions for every output.

### 5.4 Where results live

- **Baseline** (no interventions): nightly run → `forecasts` rows (superseding, with `sensitivities_jsonb`), projected `flow_metrics`. The world's ghost-future timeline reads these.
- **Interactive scenario**: ephemeral until saved → Graph V4 `scenarios` + `scenario_assumptions`; results are scenario-scoped forecast rows. SIMULATION designation everywhere (Truth doctrine).
- **Accepted action**: the intervention enters the *baseline* → immediate re-forecast → arcs, gauges, and bands shift within the session (Command Center §5 — the world responds because the data changed).
- **Reconciliation (07:00 cycle, before the brief)**: yesterday predicted vs observed (OTB pickup, comp rates, availability deltas) → residuals → bounded Bayesian parameter updates → baseline recompute → the brief cites what changed and *why the model now believes differently*.

## 6. Confidence propagation

Extends V4 §4 with simulation-specific machinery:

1. **Parameter confidence** — posterior width from calibration. Year-one honesty: data-starved parameters start at archetype priors with wide intervals; the UI shows wide bands and says so.
2. **Two uncertainties, reported separately** — ensemble spread (aleatory: the market is noisy) and parameter width (epistemic: we are still learning). Total interval on the forecast; breakdown in `confidence_jsonb`.
3. **Chain propagation through loops** — MIN_CHAIN along conjunctive causal paths; NOISY_OR where independent paths corroborate (elasticity path and historical-analog path agreeing on an occupancy drop *raises* confidence in the drop).
4. **Horizon decay** — confidence compounds down with booking-days simulated ahead; bands visibly widen along the timeline.
5. **Common random numbers** — intervention impact = diff of two runs sharing noise draws (classic variance reduction). The *difference* is far tighter than either absolute level: the sim can honestly say "+9.4k RON ± 3.1k" while absolute occupancy carries ± 8 pp. This single technique is why recommendation impacts are usable in year one.
6. **Competitor fit quality** — each rival's policy carries predictability ("Vega follows within 2 days, 78% of observed episodes"); erratic rivals widen second-order terms and the UI names them as the uncertainty source.
7. **The sim never asserts.** Every output lands as a forecast or expected impact with the full provenance envelope; baseline world never renders un-actioned interventions; scenario views carry the SIMULATION designation at all times.

## 7. The worked example — "Raise ADR +8%, Jul 11–13"

**T+0 ms (fast path):** slider moves; linearized response renders: own occupancy Jul 11–13 −2.9 pp (± 1.4), RevPAR +4.1% (± 2.0); own extrusion's emissive shifts; choice-share particles visibly re-route toward two rivals; the Mamaia/Greece leakage arc thickens slightly. Interval bands widened, provenance reads "estimating".

**T+2 s (full path settles):**
- **Competitor reaction (L2):** Vega (follower, lag 1–2d, follow ratio 0.6, fit 0.78) and one anchor partially match at +4–5% by Jul 9–10 in 71% of ensemble runs → market index rises → your relative position partly restores → net own occupancy effect improves to **−1.8 pp (± 1.1)**.
- **Corridor (L4):** RO-urban weekend drive-flow to the market −≈60 pax across the window; DE corridor unaffected (booked weeks ago — their window closed; L6 knows this).
- **Leakage:** +0.4 pp of formed demand exits to substitutes (choice model's outside option) — the Greece arc widens by exactly that, with its own interval.
- **Forecast (L1+L3):** Jul 12 (Sat) holds compression probability 0.66 → the optimum splits: **hold +8% on Sat, trim to +5% on Thu/Fri**.
- **Verdict:** RevPAR +5.2% (± 2.1) ≈ **+9.4k RON (± 3.1k)** vs baseline (common random numbers), confidence 0.61 = MIN_CHAIN(ε 0.71, reaction fit 0.78, pace 0.84) × calibration 0.93.
- **If accepted:** intervention enters baseline; re-forecast supersedes; T+14d the Outcome grades it; ε and Vega's follow ratio update; next time the bands are tighter.

## 8. The feel (surge × Skylines, mapped to the one world)

- **Surge made visible:** DP is a continuously rendered pressure field (sector tint → extrusion emissive per WORLD §8); price guidance *derives from pressure* and renders as guidance — Article 5 keeps the human on the trigger.
- **Skylines made honest:** drag a lever and the world answers — buildings brighten/dim, flow particles re-route between buildings, corridor ribbons thicken, the leakage arc breathes, rival buildings pulse with ghost previews of their *modeled* reactions ("Vega follows in ~2d", with its 0.78 fit shown). Every reaction is an overlay on the one world (no second view), every number carries its envelope.
- **The ghost timeline:** scrubbing forward shows the simulated future as ghost state — the AssetCard forecast slider grammar, generalized to the whole world. Scrub, drag, watch the future re-fit.
- **Scenario sandbox:** visually distinct (SIMULATION designation + glass tint per DESIGN_LANGUAGE) — you always know whether you are looking at the world or at a possible world.

## 9. Persistence and deltas (deliberately tiny)

- **New table: `sim_parameters`** — the belief registry: `(id, scope_kind, scope_id, param_code, value, interval_low, interval_high, confidence, method, calibration_window, model_version_id, valid_from, valid_to, lineage refs)`. Competitor policies are parameter *families* under `scope=asset` (`archetype`, `reaction_lag`, `follow_ratio`, `fit_quality`) — no second table.
- **Additive column: `forecasts.sensitivities_jsonb`** — the Jacobian that powers the fast path.
- Everything else rides Graph V4 + EFE: `scenarios`, `scenario_assumptions`, `forecasts`, `flow_metrics`, `model_versions`, `model_calibrations`, `outcomes`, `lineage_edges`.
- Engine home: `nexus-sim` (Python, Phase 3) — agents communicate via tables per Doctrine II.6; the browser never runs the sim, it renders Jacobians and subscribes to results.

## 10. Phasing and the honesty rules

| Phase | Sim capability |
|---|---|
| 0–1 (launch + hardening) | none. But every daily scrape is *training data for competitor policies* — the collectors running is what makes the sim possible; weeks of rate history are the tuition. |
| 2.5–3 (with V4 waves) | **v0**: pickup curves + elasticity priors + nightly Jacobian → the slider reacts honestly with wide bands; first competitor archetypes fit from accumulated history |
| 3+ | full choice model + reactive agents + ensembles + daily reconciliation + calibration loop through Outcomes |
| post-pilot | multi-market coupling (corridor competition between markets), narrative feedback loop L5 active |

**What the simulation may never do:** present a simulated number without interval + SIMULATION/forecast designation · model a competitor beyond the support of their observed behavior without a named scenario assumption · auto-execute its own recommendations (Article 5) · hide a surprise (large residuals emit signals, not silence) · run a second world (every reaction renders as overlays on the one world, per WORLD §10).

The closing truth: Uber's surge works because it *prices a pressure it can measure*; Skylines delights because *the world answers the hand*. AETHER earns both only through the calibration loop — and the calibration loop starts the day the collectors run. The sim's first ancestor is tomorrow's scrape.
