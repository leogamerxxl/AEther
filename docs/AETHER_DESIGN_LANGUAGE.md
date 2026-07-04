# AETHER — DESIGN LANGUAGE v1: "NIGHT HARBOR"

**Constitution · Document 4 of 7 · v1.0 · 2026-06-10**
Governs: how AETHER looks, moves, and feels. Supersedes "Operational Calm" (DESIGN.md) and the interim "Cinematic Glass" / "Vercel-matte Bento" sections; those remain as history.
Reference targets: Bloomberg Terminal × Palantir Foundry × UXP Smart City × modern AAA game UI. **Not a SaaS dashboard.**

---

## 0. The name

*AETHER is the view from a harbor-master's tower at night — a dark coast, cold instrument light reading the world, and one warm lamp where money changes hands.*

Night Harbor resolves the codebase's warm/cool schism by making it doctrine: the **warm black shell** is the night harbor; **cold cyan light** is the machine (signals, now, attention); **warm amber light** is the human (money, decisions, action). The accident becomes the identity.

## 1. Principles

1. **The world is the interface.** The map is full-bleed and never framed. Everything else floats (Doctrine, Article 2).
2. **Two temperatures, one story.** Cold light = signal/now. Warm light = money/decision. Verdict colors (emerald/red) appear only as deltas and severities — never decoration.
3. **Truth has a timestamp.** No number without source + age + freshness (Doctrine, Article 3). Stale data visibly cools.
4. **Motion explains causality.** Animate state change, altitude change, and consequence — never idleness. Entrances are earned once.
5. **Drama is a budget.** Max one hero-glass pane and one full edge-refraction per viewport. Rarity is what makes it cinematic.

## 2. Color

Single source of truth: `lib/command-theme.ts`. **Zero color literals elsewhere** (audit found 109 across 22 files — see Kill List).

### 2.1 Ink ladder (the only four text colors)

| Token | Value | Use |
|---|---|---|
| `ink-1` | `#F5F2EE` | primary content |
| `ink-2` | `rgba(245,242,238,.70)` | secondary |
| `ink-3` | `rgba(245,242,238,.45)` | labels, eyebrows |
| `ink-4` | `rgba(245,242,238,.30)` | ghost, provenance |

### 2.2 Surfaces (one black, three steps)

| Token | Value | Use |
|---|---|---|
| `night-0` | `#070809` | the void: atmosphere, map fog, `themeColor` (unify the current three blacks) |
| `night-1` | `#0E0F12` | shell |
| `night-2` | `#15161A` | raised non-glass chrome |

### 2.3 Semantic accents (exclusive roles)

| Token | Value | Role — and *only* this role |
|---|---|---|
| `signal` | `#22D3EE` | live, selected, real-time, info. Never money, never mid-confidence. |
| `harbor` | `#E6B566` | money, price, action, applied. The only warm light. |
| `up` | `#5FD0A0` | positive verdicts (deltas, ok-status) |
| `down` | `#EF8B7A` | negative verdicts; `crit #EF6A55` for critical severity |
| `refraction` | `#BC96FF` | glass edge gradients **only**. Never UI, never data. |

Confidence rendering: monochrome segmented meter in ink (lit-segment count carries meaning); red only below 30%. This frees `signal` cyan of its current fifth job.

## 3. Material — "Command Glass"

Three tiers, one furnace (cool-neutral glass on the warm night — the contrast is the point):

| Tier | Class | Spec | Budget |
|---|---|---|---|
| **Pane** | `gx-glass` | blur 34 / sat 150%, top-light, full cyan-violet edge refraction | 1–2 per viewport (hero only) |
| **Tile** | `gx-bento` | blur 28 / sat 142%, top-light, **no refraction** | default card |
| **Well** | `gx-inset` | recessed, inner shadow | data zones inside Tiles |

Laws: glass only over world or atmosphere (never on flat fills — it degrades to a gray rectangle paying a blur tax); text on glass never below `ink-3` for ≤11px sizes; `.glass` / `.glass-2` (warm gen-1.5 recipes) are retired.

## 4. Typography — three voices, seven sizes

| Voice | Face | Role |
|---|---|---|
| **Narrative** | Fraunces 300 | morning-brief headline, place names, greetings. Never data, never chrome. The ownable counterpoint — nobody else ships a serif over a tactical map. |
| **Interface** | Geist | everything operable |
| **Data** | Geist Mono, `tabular-nums` | **every number that is data, no exceptions** (fixes the current Mono/Sans split) |

Scale (px): `10` microlabel · `11` caption · `12.5` body · `14` title · `20` sub-hero · `26` metric · `34` display.
Microlabel recipe (standardized once): `10px / 600 / .14em tracking / uppercase / ink-3`.

## 5. Numbers & provenance (the Bloomberg organ)

Every metric renders with a 14px provenance row: `◦ source · age` — freshness dot (`signal` <1h · `harbor` <24h · `down` >24h), source name in `ink-4`, age in Data voice. Beyond a source's freshness SLA the owning surface desaturates 40%. CountUp ticks on *data change*, not only on mount.

## 6. Space & radius

- 4px grid; component paddings from {8, 12, 16, 20, 24}.
- Radius scale of five: `6` chips · `10` controls · `14` inner · `20` Tiles · `26` Panes · `full` pills. (Down from thirteen ad-hoc radii.)
- Data elements (bars, cells, sparklines) ≤ 4px radius.

## 7. Motion

Tokens: durations `120 instant / 200 quick / 320 standard / 600 cinematic / ≥2000 ambient`; easings `--ease-spring`, `--ease-out`; one framer spring (`stiffness 300, damping 28`).

Choreography patterns (the only sanctioned ones):
- **rise-in** — first mount, 40ms stagger, blur-up; once per surface per session
- **draw-on** — SVG paths, once
- **tick** — numbers on data change
- **altitude-morph** — shared-element (`layoutId`) card → dossier; camera + UI move together
- **boot scanline** — once per session, at boot only
- **alert-arrival** — edge pulse + ping (budgeted signature moment)
- **action-applied** — number ticks to new value + single `harbor` edge sweep

Reduced-motion law: honored via both `prefers-reduced-motion` and the in-app setting (already implemented; never regress).

## 8. Iconography & motifs

- Lucide, stroke `1.6`, sizes 14/16/20.
- The 8-motif monochrome watermark library (`trend, building, skyline, waves, radar, calendar, occupancy, compass`) is canon: idle opacity .06, hover .12, slow parallax. Every Tile declares a motif — a card with no idea of its own illustration doesn't ship.

## 9. Density tiers

`data-density` on the shell: **ambient** (map + ≤2 Panes, lean-back) · **focus** (current kit) · **dense** (11px Data voice, 28px rows, p-2, inline sparklines — the terminal). Dense-tier table spec: hover row gets a 1px `signal` left edge, no fill. The Bloomberg test — forty facts without scrolling — must pass in dense.

## 10. Map doctrine

- Full-bleed, no stage frame, no margins (Article 2).
- Label grammar at all altitudes: the diamond-marker + stem + counter-rotated upright pill (promoted from CoastalSectorMap to the universal standard).
- Altitude rendering: Coast = tilted glowing sector regions; Sector = luminescent extrusions (emissive, not blocky fills; constant extrusion opacity — feature-state via emissive/height only); Asset = focused building glow + dossier morph.
- Own asset reads `harbor`-warm on the map; everything observed reads cool. One warm light in the harbor.

## 11. Kill list

1. Gen-1 classes `.panel .metric .action .sheet .rung .ladder` + their last consumer (`components/Dashboard.tsx`).
2. `.glass` / `.glass-2` warm recipes.
3. `.glow-amber` — rename `glow-signal` (it has glowed cyan all along; end the lie).
4. All 109 hardcoded accent literals → theme imports (incl. `#5fd0a0` in Toast, `#f59e0b` Tailwind amber in `gx-tint-amber`).
5. The light theme (parked, not maintained — dark-only material system).
6. Two of the three blacks (`#0A0908`, `#05070b` → `night-0`).
7. The `.stage` frame around the map.

## 12. Governance

No new hex, no new radius, no new duration, no new glass recipe — additions amend this document first (PR must link the amendment). `/showcase` is the contract: a primitive that isn't in the showcase isn't in the language. Migration order lives in [ROADMAP](AETHER_ROADMAP.md) Phase 2.

---
## Amendment - 2026-07-04 (owner directive): gx-matte night-shade tier
Instrument panels (rail, chrome, variance, pulse, controls, drawer) use the new
gx-matte tier: near-opaque night surface (rgba 16-9 gradient at .94-.96), blur 14,
hairline border, NO iridescent edges. Rationale: readability over any basemap;
the world glows, the instruments do not. gx-glass/gx-bento remain for in-world
accent surfaces only. Zoning rule: one left column (menu - title - rail); map
center stays instrument-free; bottom-right = reading stack (pulse + variance) +
camera controls; drawer above all chrome (z 88/90).
