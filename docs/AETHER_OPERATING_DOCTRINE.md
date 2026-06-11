# AETHER — OPERATING DOCTRINE

**Constitution · Document 2 of 7 · v1.0 · 2026-06-10**
Governs: how AETHER behaves — the eight articles, plus engineering, truth, security, and scope law.
A violation of this document requires an entry in `docs/DECISIONS.md` *before* the violating change ships.

---

## Part I — The Eight Articles

### Article 1 — Focus + Altitude is the primary navigation model

**Statement.** All navigation state reduces to `view = f(focus, altitude)` where *focus* is an ontology node (a Place, Asset, Corridor, Signal, Recommendation…) and *altitude* is the level of abstraction (Coast → Sector → Asset; lensed as Executive / Strategic / Operational).

**Binding rules.**
- No route may exist that cannot be expressed as `(focus, altitude)`. URLs serialize this pair; deep links restore it exactly.
- Changing focus keeps altitude; changing altitude keeps focus (the camera moves, the subject persists).
- "Pages" are forbidden as a mental model. There is one world and a camera. Anything that feels like leaving the world (a settings page, an auth screen) is chrome, not product, and must be visually subordinate.

### Article 2 — The world is the interface

**Statement.** The map is the substrate of the product. It is full-bleed, always present, and everything else floats above it as glass.

**Binding rules.**
- The map is never framed inside a card, never given margins, never treated as a widget.
- Every entity in the ontology has a defined map representation per altitude (see [COMMAND_CENTER](AETHER_COMMAND_CENTER.md) routing matrix) or is explicitly routed to a non-map surface — silence is not allowed.
- Panels obscuring more than ~40% of the viewport at rest are a design defect.
- Off-map screens (lists, tables) are *dense lenses* over the same focus, reachable without losing `(focus, altitude)` state.

### Article 3 — Truth has a timestamp

**Statement.** Every number AETHER shows is an observation or a derivation, and both carry provenance: source, observed-at, and freshness.

**Binding rules.**
- No metric renders without a provenance affordance (source · age · freshness state). The UI for this is specified in [DESIGN_LANGUAGE](AETHER_DESIGN_LANGUAGE.md) §5.
- Stale data must *look* stale (visual decay beyond its freshness SLA, per [DATA_SOURCES](AETHER_DATA_SOURCES.md)). The interface is honest even when the pipeline is sick.
- Fabricated, placeholder, or demo data is permitted only behind an explicit, visible "SIMULATION" designation. Shipping invented numbers as real to an operator is the cardinal sin of this product.
- All temporal data is bitemporal where the distinction matters: *when it was true* (stay_date / valid time) vs. *when we learned it* (observed_at). Rates are always indexed stay-date-forward.

### Article 4 — Signals are reasoning, not content

**Statement.** A signal is an interpreted observation — direction, magnitude, confidence, decay, and an implication for the causal spine — never an item to read.

**Binding rules.**
- Raw inputs (a news article, a weather forecast, an event listing, an FX tick) are *observations*. They become signals only when typed against the ontology with: affected entity, affected stage (attention/demand/movement/spending/revenue), direction, magnitude estimate, confidence, half-life.
- The UI never renders a feed of articles, headlines, or "updates." It renders signals: "German school holidays start Jul 4 → +arrival pressure on Corridor DE→Coast, weeks 27–29, confidence 0.7."
- A signal with no implication is noise and must not be stored as a signal.
- Signals decay. Every signal type declares a half-life; expired signals leave active reasoning automatically.

### Article 5 — Recommendations own actionability

**Statement.** Only Recommendation nodes may ask the operator to do something. Everything else informs.

**Binding rules.**
- Buttons that change the world (apply price, hold inventory, send offer) exist exclusively on Recommendation surfaces. Signals, forecasts, and metrics are read-only by construction.
- Every recommendation states: the action, the expected impact (with unit and confidence), the reasoning chain (lineage), the deadline/decay, and the cost of doing nothing.
- Recommendations have a lifecycle — `proposed → seen → accepted | adapted | declined | expired → outcome-measured` — and every transition is recorded. An un-measurable recommendation must not be issued.
- Accepted recommendations trigger re-forecast. The product visibly *moves* when operated (the loop in [COMMAND_CENTER](AETHER_COMMAND_CENTER.md) §5).

### Article 6 — Everything must be explainable through lineage

**Statement.** Every derived node (signal, forecast, recommendation, brief sentence) must be traceable to the observations and rules/models that produced it.

**Binding rules.**
- Every derived row carries references to its parents (observation IDs, model/prompt version, agent run ID in `agent_runs`).
- "Why?" is a first-class interaction: any number or claim in the UI can expand into its lineage chain within one gesture.
- The morning brief is generated *from* stored reasoning, not as free prose: each claim in the brief maps to signal/forecast IDs. If the generator cannot cite, it must not claim.
- Orphan intelligence (a number whose parents were deleted or never recorded) is a data-integrity bug, severity: high.

### Article 7 — The command center is a viewport into the ontology

**Statement.** Screens do not own data or logic; they are queries over the ontology rendered at a given `(focus, altitude)`.

**Binding rules.**
- No component fetches bespoke, screen-shaped data. Components consume ontology query results (nodes + edges + provenance).
- If something appears on screen, it exists in the ontology; if it exists in the ontology, the routing matrix says where (or that it is hidden at this altitude).
- Adding a feature means: extend the ontology, then extend the matrix, then render. Never the reverse.
- The same query layer feeds the brief (email), the command center (web), and any future surface (mobile, API). One brain, many viewports.

### Article 8 — AETHER is an Economic Intelligence OS with hospitality as the first vertical

**Statement.** The architecture must never hard-code hospitality where the concept is economic.

**Binding rules.**
- Verticals are configuration (`vertical_profiles`), never enum branches. `if (vertical === 'hospitality')` is forbidden in code.
- Core entities are economic (Asset, Market, Corridor, Signal…); hospitality terms (room, ADR, occupancy) live in the vertical profile's metric definitions.
- Multi-tenant from day one: every query scoped by `org_id` / `property_id` (global reference data exempted: `macro_observations`, `signal_sources`, `signal_categories`).
- The second vertical is a test the first vertical must not fail: any pilot-era shortcut that would block a non-hotel asset class requires a DECISIONS.md entry.

---

## Part II — Engineering Doctrine

Inherited from project memory (CLAUDE.md), restated as constitutional law:

1. **Multi-tenant from day one** — RLS at the DB *and* tenant filters in code.
2. **Config over enums** — verticals, source markets, room types live in tables.
3. **VerticalProfile first-class** — features gated by profile, not by code branches.
4. **Stay-date forward** — rates and forecasts indexed by the night being sold.
5. **Raw JSONB preserved** — full API responses stored before normalization; nothing discarded.
6. **Agent interface contracts** — pipeline agents communicate via Supabase tables (write → next reads). No direct imports between stages.
7. **Native currency** — store as scraped (RON/EUR); convert at display time using BNR rate from `macro_observations`.
8. **GDPR-clean** — hotel data, never person data. No guest PII. Review text display-only, never stored.

**Additional law (from audit findings):**
9. **Version control is not optional.** No further feature work outside a git repository with remotes and history.
10. **Tests gate the pipeline.** The brief pipeline (collect → validate → generate → send) must have automated checks at each table boundary; a brief that would ship with stale or missing data must fail loudly and page, not send silently.
11. **Schema truth lives in migrations.** Local and remote schema drift is a defect; `information_schema` is consulted before any DB-touching code is written (never hallucinate column names).
12. **Every agent run is logged** to `agent_runs` (agent_code, input, output, model, cost_cents, latency_ms, ts).

## Part III — Truth Doctrine

- The demo era ends at launch. Any surface visible to a paying or pilot operator shows only: real observations, derivations with lineage, or clearly-labeled simulation.
- Confidence is never decoration: displayed confidence must come from the producing model/rule, not be invented at the UI layer.
- Forecast error is published *inside* the product (calibration view). AETHER earns trust by showing when it was wrong.

## Part IV — Security Doctrine

Standing law:

- `SUPABASE_SERVICE_ROLE_KEY` lives server-side only (Python / server runtime). Never in frontend code, Vercel env vars exposed to the client, or any committed file.
- No new `SECURITY DEFINER` function or view without explicit review; `security_invoker` is the default posture for views.
- RLS policies (`*_policies`) are never modified without review. `DROP TABLE` / `TRUNCATE` / `DELETE` require explicit human confirmation.
- Anon role: deny-by-default. Any grant to `anon` beyond auth flows requires a DECISIONS.md entry.

**Known defects (confirmed by the 2026-06 security audit; remediation is ROADMAP Phase 0/1, pre-revenue, non-negotiable):**

| ID | Defect | Risk |
|---|---|---|
| SEC-1 | `integrations_safe` SECURITY DEFINER view bypasses RLS — anon receives cross-tenant rows (15 observed) and effective DML | Critical |
| SEC-2 | `property_live_telemetry` world-readable | High |
| SEC-3 | `scraped_properties` readable by any authenticated user regardless of tenant | High |
| SEC-4 | `rls_auto_enable` callable by anon | High |
| SEC-5 | Client-side demo auth with user-selectable roles still reachable in product shell | High (until real auth is default) |

## Part V — Scope Doctrine

- **The 3-word test**: every proposed feature is written in three words, then asked: *"Does this help Hotel Terra's owner make a better pricing decision tomorrow morning?"* No → `docs/phase-n-ideas.md`, not the sprint.
- **Launch supremacy**: until the launch definition (VISION §4) is met, the only sprint is: collectors live → brief generated → email by 07:00. Plus SEC-1 (actively exploitable).
- **Decisions log**: significant architecture decisions recorded in `docs/DECISIONS.md` as `## [DATE] — [Title]` → Why → Alternatives rejected.
- **The JARVIS clause**: ambition is welcome in these documents and banned from the sprint board. The constitution dreams; the roadmap sequences; the sprint ships.
