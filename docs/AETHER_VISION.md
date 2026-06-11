# AETHER — VISION

**Constitution · Document 1 of 7 · v1.0 · 2026-06-10**
Governs: why AETHER exists and what it must become.
Siblings: [OPERATING_DOCTRINE](AETHER_OPERATING_DOCTRINE.md) · [ONTOLOGY_V3](AETHER_ONTOLOGY_V3.md) · [DESIGN_LANGUAGE](AETHER_DESIGN_LANGUAGE.md) · [COMMAND_CENTER](AETHER_COMMAND_CENTER.md) · [DATA_SOURCES](AETHER_DATA_SOURCES.md) · [ROADMAP](AETHER_ROADMAP.md)

---

## 1. One sentence

AETHER is an **Economic Intelligence Operating System**: it observes a regional economy, reasons about cause and effect, and tells operators what to do next — with **hospitality on the Romanian Black Sea coast as the first vertical**.

Hospitality is the wedge, not the identity. A hotel is simply the first asset class whose revenue is legible enough, daily enough, and underserved enough to prove the model: that a regional economy can be observed, forecast, and operated.

## 2. What AETHER is not

These exclusions are binding. A feature that turns AETHER into any of the following is out of scope regardless of customer request:

- **Not a PMS.** AETHER never manages rooms, reservations, invoices, or guests.
- **Not a channel manager.** AETHER recommends prices; it does not (yet) push them. When it does, pushing is an *Action* executed through integrations, governed by the ontology — not a booking-engine feature.
- **Not a BI dashboard.** Dashboards display data and delegate thinking. AETHER delegates *observation* to machines and delivers *reasoning*. If a screen shows a chart without an interpretation, a confidence, and a next step, it is not finished.
- **Not a content feed.** News, weather, and events are raw material for signals — they are never surfaced as items to read. (Doctrine, Article 4.)
- **Not generic AI chat.** AETHER's intelligence is grounded in its ontology and lineage. It does not answer questions it cannot trace to observations.

## 3. The causal spine

Every entity, signal, and screen in AETHER exists to illuminate one chain:

```
ATTENTION → DEMAND → MOVEMENT → SPENDING → REVENUE
(searches,   (booking   (traffic,    (rates paid,  (ADR, occupancy,
 mentions,    pace,      flights,     basket        RevPAR — the
 events)      pickup)    arrivals)    size)         operator's P&L)
```

- The chain runs left to right in the world and right to left in diagnosis ("revenue is soft → which upstream stage broke?").
- Forecasting is the act of reading early stages to predict late stages.
- Recommending is the act of choosing an intervention at the stage where leverage is highest.
- The ontology ([ONTOLOGY_V3](AETHER_ONTOLOGY_V3.md)) is this chain made into a typed, timestamped graph.

## 4. The wedge and the launch definition

**Current target:** Hotel Terra Neptun (pilot, 60 days free → €150/month).
**Launch deadline:** June 15, 2026.

> **Launch definition (verbatim, supreme):** Morning brief email at owner's inbox by 07:00 EEST, every day, with real scraped data, for 7 consecutive days. Nothing else counts.

**Supremacy clause.** Until the launch definition is met, no work item that does not serve it may be scheduled. This Vision document describes the destination; it licenses *direction*, never pre-launch scope. The [ROADMAP](AETHER_ROADMAP.md) is the sole arbiter of sequence.

## 5. Who operates AETHER

| Role | Question they wake up with | Primary altitude (see COMMAND_CENTER) |
|---|---|---|
| Owner / GM (Leonardo, pilot) | "What should I do about price and inventory *today*?" | Asset (operational) |
| Revenue strategist | "Where is demand forming over the next 30–90 days?" | Sector / Market (strategic) |
| Portfolio / investor (future) | "Which assets and markets are outperforming, and why?" | Coast / Region (executive) |

One product, three altitudes, one ontology underneath. The morning brief is the Asset-altitude executive summary delivered by email; the Command Center is the same intelligence made navigable.

## 6. The product ladder

Each rung must be earned before the next is climbed:

1. **The Brief** (now → launch): one hotel, one email, real data, daily, trusted.
2. **The Command Center** (post-launch): the brief's reasoning made explorable — map-first, focus + altitude navigation, provenance on every number.
3. **The Intelligence OS** (pilot proven): the full Signal → Forecast → Recommendation → Action → Outcome loop, with calibration. AETHER learns whether its advice worked.
4. **The Platform** (expansion): more assets, more sectors (Mamaia, Eforie, Costinești, Olimp), more verticals (vertical_profiles already first-class), more markets in CEE.

## 7. The Eight Principles

Canonical statements; full articles with binding rules live in [OPERATING_DOCTRINE](AETHER_OPERATING_DOCTRINE.md):

1. **Focus + Altitude is the primary navigation model.**
2. **The world is the interface.**
3. **Truth has a timestamp.**
4. **Signals are reasoning, not content.**
5. **Recommendations own actionability.**
6. **Everything must be explainable through lineage.**
7. **The command center is a viewport into the ontology.**
8. **AETHER is an Economic Intelligence OS with hospitality as the first vertical.**

## 8. North-star metrics

| Horizon | Metric | Definition |
|---|---|---|
| Launch | **Brief streak** | Consecutive days the brief landed by 07:00 EEST with fresh data. Target: 7, then never broken. |
| Pilot | **Decisions influenced** | Recommendations the owner acted on (accepted / adapted), per week. |
| Pilot | **Forecast calibration** | Forecast vs. realized occupancy/ADR error, tracked publicly inside the product. |
| Growth | **Net revenue retention** | Expansion across properties and verticals; €150/month is the floor, not the model. |

## 9. The honest baseline (as of 2026-06-10)

The constitution is written with eyes open. As of today: the Python pipeline (nexus-scrape / nexus-brief / nexus-mail) is not on disk; competitive rate data is stale since 2026-05-22; parts of the demo UI display fabricated numbers; known Supabase security defects are unremediated; there is no git history. The vision stands — and the [ROADMAP](AETHER_ROADMAP.md) Phase 0 exists precisely to close the gap between this document and reality before June 15.
