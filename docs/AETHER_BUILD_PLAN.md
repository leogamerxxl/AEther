# AETHER — BUILD PLAN (the single execution reference)

**v1.0 · 2026-06-15 · the one pane for "what we build, in what order, cohesively."**

This is not another constitution. The constitution lives in the other `AETHER_*`
docs (Vision, Doctrine, Ontology, Design Language). This is the **operating plan**:
the ordered sequence, the cohesion rules that stop us from shipping disconnected
panels, the multi-vertical foundation that lets the ontology serve other markets, and
the engineering guardrails (lessons already paid for). Every PR links back here.

---

## 0. Two laws (non-negotiable)

1. **Truth before belief.** Core (world model → intelligence_objects → engine →
   memory → causality → simulation → provenance) is built and verified before
   Experience (spatial UI, motion, email, onboarding). Motion is skin, not brain.
2. **One spine, no islands.** There is exactly one path from data to pixel. Nothing
   re-derives intelligence; nothing renders a one-off panel. See §2.

---

## 1. The layered architecture

```
CORE (truth)                                   EXPERIENCE (belief)
  world model (ontology)                         spatial UI / map / twin
  intelligence_objects  ── canonical ──▶         IO context drawer
  deterministic signal engine                    motion system (lib/motion.ts)
  provenance / freshness / confidence            premium email · onboarding
  memory · causality · simulation (later)        presentations (later)
        │                                                 ▲
        └──────────────── one read layer ─────────────────┘
```

`intelligence_objects` is the contract between the two halves. The brief is one
export of it; the spatial UI is another; email is another. They are **views**, never
parallel analysis paths.

---

## 2. The cohesion spine (the antidote to "separate unconnected panels")

The failure mode we are avoiding: every view independently fetches data and reinvents
how a signal looks. The cure is four singletons.

| Singleton | Where | Rule |
|---|---|---|
| **One world model** | Supabase ontology | every signal is an `intelligence_object` |
| **One read layer** | `lib/intelligence.ts` (web) · `nexus-scrape/signal_engine.py` (server) | nothing else queries IOs; nothing re-derives |
| **One primitive family** | `components/spatial/intelligence/*` | the signal row, freshness dot, provenance row, confidence meter, SAMPLE/LIVE badge, and the IO drawer are shared components. New surfaces **compose** them. |
| **One provider** | `SpatialIntelligenceProvider` at the shell | every view reads `{ source, objects, nodes }` from context — no component imports `NODES` or fetches IOs on its own |

**Acceptance for any new surface:** it imports from the read layer + primitive family
and adds zero new fetch, zero new derivation, zero new color/motion literal. If it
can't, the primitive family is missing a piece — add it there, once.

> Debt to retire (tracked): 5 components import `NODES` directly; `IntelligencePanel`
> fetches on its own. The **Cohesion Foundation PR** (§4 step C) moves them behind the
> provider + primitives. After it, "add a panel" is impossible by construction.

---

## 3. Enterprise foundation: repurposing the ontology to other markets

The goal: **adding a new vertical changes config + two registries — never the IO
schema and never the UI.** This already mostly holds; here is why and what closes it.

**Already vertical-agnostic (no work):**
- `intelligence_objects` — `altitude_level / entity_type / signal_type / evidence /
  confidence / causal_hypothesis / recommended_actions` say nothing about hotels.
- The world hierarchy — World→Region→…→Property→Department→**Room/Table/Product**.
- The web read layer + drawer + panel — they render *any* `signal_type` generically.

**Vertical-specific today (becomes registry-driven):**
- **Collectors** → a registry keyed by `source × vertical`. Hospitality registers
  Booking rates + OTB; retail would register POS + foot-traffic; same `raw_jsonb`.
- **Signal computers** → the engine becomes `signal_type → compute(observations,
  profile)`. Hospitality registers `market_rate_pressure`; restaurants register
  `cover_pressure`; retail `stockout_risk`. Same IO output.
- **`vertical_profiles`** (table already exists) governs which collectors, signal
  types, altitudes, and entity types a tenant gets. **Never branch on
  `vertical === 'hospitality'` in code** (Principle 3) — read the profile.

**The enterprise test:** onboarding a new market = (1) a `vertical_profile` row,
(2) register its collectors, (3) register its signal computers. Zero changes to the
IO schema, the read layer, the drawer, or the brief renderer. We design every PR
below to keep that true.

---

## 4. Execution sequence (with verification gates)

> Each step is one PR. A step is "done" only when **typecheck + tests + build** are
> green and the change obeys §2 (no new island) and §3 (no vertical branch).

- **A. Merge the foundation** — `phase1-foundation` → `feat/brief-reads-io` →
  `feat/spatial-reads-io` → `feat/experience-layer-v0`, in that order, into `main`.
  Gate: CI green on `main`.
- **B. Experience Layer v0** — `lib/motion.ts` + IO context drawer. **DONE**
  (`feat/experience-layer-v0`).
- **C. Cohesion Foundation** — extract `components/spatial/intelligence/*` primitive
  family + `SpatialIntelligenceProvider`; move the 5 `NODES` consumers and the panel
  behind it. Gate: identical render, fewer fetches, no `NODES` imports outside the
  provider. *This is the "make it one thing" PR.*
- **D. `006_advisor_hardening`** — deny-anon `agent_runs`, pin `update_updated_at_column`
  search_path, revoke anon EXECUTE on the 3 RLS RPCs. Gate: advisors clean.
- **E. Vercel deploy leg** — CD on green `main`. Gate: preview deploy renders.
- **F. Live data** — resolve 8 Booking URLs (≥10/12 coverage) + OTB channel; run the
  engine so IOs are written. Gate: spatial drawer flips SAMPLE → LIVE for the tenant;
  brief reaches PASS.
- **G. Multi-vertical proof** — make the signal engine a `signal_type → computer`
  registry + wire `vertical_profiles`; prove by registering one non-hospitality
  signal computer behind a profile flag (no UI/schema change). Gate: §3 test passes.

Then, and only then, the Experience refinements (Lottie micro-signals via a §7
amendment PR; GSAP altitude-morph) — belief work, on a foundation that won't wall us.

---

## 5. Engineering guardrails (lessons already paid for — do not repeat)

| Mistake made | Guardrail going forward |
|---|---|
| Styled a component with hex/Tailwind color literals + amber for a SAMPLE state, **before** reading the design constitution | Read `AETHER_DESIGN_LANGUAGE.md` + `command-theme.ts` before any UI. **Zero color literals.** Add a CI lint rule that fails on `#hex`/`text-cyan-*` outside `command-theme.ts`. |
| Built `IntelligencePanel` as an isolated, self-fetching panel | §2: provider + shared primitives; no per-view fetch/derive |
| Committed a couple times before the build confirmed | tsc + tests + **build** must pass before commit; CI is the backstop |
| `tsconfig.tsbuildinfo` tracked → churns every build | gitignore build artifacts (fold into PR C) |
| Tooling: editor failed on `.ts`; commit messages broke on `()`; shell `$()` miscounted parens | code via file-write path; `git commit -F <file>`; no method calls inside shell string interpolation |

**The meta-rule:** every changed line traces to a request, obeys the one spine, and
keeps the ontology vertical-agnostic. If a change can't, it's the wrong change.

---

## 6. How to use this doc

- Before starting a step: re-read §2 and §3. Ask "does this add an island? does this
  branch on vertical?" If yes, stop.
- In every PR description: link the step letter (e.g. "Build Plan §4-C").
- When something here is wrong or done, amend this doc in the same PR. It is the
  living plan, not a monument.
