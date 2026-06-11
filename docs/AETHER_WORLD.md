# AETHER — WORLD ARCHITECTURE

**Architecture · v1.0 · 2026-06-11 · status: DESIGN**
Resolves the split-world problem. Binds: [FOCUS_ALTITUDE](AETHER_FOCUS_ALTITUDE.md) (navigation state), [DESIGN_LANGUAGE](AETHER_DESIGN_LANGUAGE.md) §10 (map doctrine), [COMMAND_CENTER](AETHER_COMMAND_CENTER.md) (surfaces), [GRAPH_V4](AETHER_GRAPH_V4.md) (places hierarchy), [ECONOMIC_FLOW_ENGINE](AETHER_ECONOMIC_FLOW_ENGINE.md) §6 (flow grammar).

---

## 1. The problem, named precisely

Four worlds currently exist, each pretending to be the place:

| World | Artifact | Reality it fakes |
|---|---|---|
| **Mapbox world** | `CoastalCommandCenter.tsx` (GL, extrusions, glow) | the actual coast |
| **Sector world** | `CoastalSectorMap.tsx` (CSS `rotateX(52deg)` plane + SVG blobs) | a tilted strategic coast that shares no camera, coordinates, or light with the map |
| **Showcase world** | `AssetCard`'s `RouteUnderlay` (decorative SVG streets, CSS-tilted) | a mini-map that corresponds to nothing |
| **Twin world** | `HotelTwin3D.tsx` (CSS 3D placeholder building) | a building interior with its own void |

Each is individually attractive; together they teach the user that AETHER's space is theater. **Goal: one continuous reality** — when the owner travels from planet to room, nothing ever cuts.

## 2. Thesis: one state, one covenant, one atmosphere, many renderers

No single renderer spans planet → room. Google Earth, Apple flyover→indoor, and AAA space games all solve this the same way, and so does AETHER:

1. **One world state.** The ontology + `CommandView` (focus, decision-altitude, window, scenario) + camera + selection + overlay set. Renderers are *subscribers*; none owns state.
2. **One coordinate covenant.** Every entity has a geographic anchor (`lng, lat, altitude`); below Building, a local frame (building-relative meters) rigidly registered to the geo anchor (origin + true-north bearing). One camera struct describes any view at any depth:
   `WorldCamera = { lngLat, altMeters, pitch, bearing, local?: { building, floor?, room?, orbit } }`
3. **One atmosphere.** Night Harbor is the *physics* of this world, not a stylesheet: `night-0` (#070809) fog, near-black water with cyan specular, one warm light on owned assets (`harbor`), fixed session light direction. Mapbox style tokens and twin materials reference the same palette — light behaves identically on a sector polygon and a room wall.
4. **Renderers as LOD bands with rehearsed handoffs.** The user perceives one zoom; the system swaps renderers behind match-cuts (§6.5). A cut you can feel is a defect.

## 3. The hierarchy as address space

```
World → Country → Region → Market → Corridor → Asset → Building → Floor → Room
```

- **Ontology mapping:** World/Country/Region = `places`; Market = `markets`; Asset = `properties` / `scraped_properties`; Corridor = `corridors` — a *path object*, not a containment ring (§5, corridor camera). Building/Floor/Room = **asset-interior nodes**: spatial addresses reserved now, ontology tables post-pilot (no room-level data exists yet — the address space must not wait for the data).
- **World Address** (extends the Focus+Altitude URL; the navigation focus remains the asset — interior position is camera/selection state, not ontology focus):
  `/c/{altitude}/{kind}/{id}` + optional interior suffix `?in=b1.f3.r304`
- **Containment chain** = the `GraphResolver.parentOf` chain (already specified): Room→Floor→Building→Asset→Market→Region→Country→World. `ascend` walks it; at World it raises decision altitude.

## 4. The renderer ladder

Camera altitude **in meters** is the master zoom scalar; bands and renderers derive from it. Mapbox zoom is computed, never authored.

| Band | Level | altMeters | Renderer | Pitch | What exists here |
|---|---|---|---|---|---|
| B0 | World | 10,000–2,500 km | Mapbox globe | 0° | narrative weather, corridors as great arcs |
| B1 | Country | 2,500–400 km | Mapbox | 15° | country places, corridor arcs descend |
| B2 | Region | 400–40 km | Mapbox **+ sector layer** | **58–62°** | the signature UXP view: glowing sector polygons, sea-fog gradient, MH/DP tint |
| B3 | Market | 40–4 km | Mapbox | 55° | comp-set extrusions (height = ADR, emissive = availability), flows as ribbons |
| B4 | Asset | 4 km–250 m | Mapbox | 50° | one luminescent building, comps dimmed 40%, halo |
| B5 | Building | 250–30 m | **Twin renderer** (CSS twin today → Three.js post-pilot) | free orbit 20–70° | the digital twin, matched silhouette |
| B6 | Floor | 30–8 m | Twin | 35° oblique | focused floor; others ghosted glass |
| B7 | Room | 8–2 m | Twin | dollhouse | room state — occupancy/rate/status; **never guest identity** (GDPR) |

Corridor is not a band: corridor focus engages the **path camera** (§5) across B1–B3.

## 5. Camera behaviors (per level)

| Level | Behavior | Ambient motion (the world breathes) |
|---|---|---|
| World | globe framing, slow drift | 0.2°/s rotation; corridor arcs pulse with live flow |
| Country | frame country bounds, pitch eases in | flow particles on arcs |
| Region | **locked composition**: pitch ~60°, bearing ≈ −15° so the coastline runs diagonal (the UXP frame, now earned by descent, not faked by CSS) | sector glow breathes with DP (2s+ ambient band) |
| Market | orbit-on-idle: after 10 s idle, 0.5°/s yaw around market centroid | extrusions rise on first entry (draw-on, once) |
| **Corridor** | **path camera**: flies the corridor spline origin→destination; the timeline scrubber doubles as position-along-path; pitch 45° looking along flow | particles stream beneath the camera |
| Asset | close orbit, radius ≈ 200 m, building luminescent, surroundings dim | emissive flicker ≤ 2% (alive, not noisy) |
| Building | free orbit (drag), radius ≈ 40 m, pitch clamped 20–70° | floors glow by occupancy |
| Floor | camera locks to floor plane, 35° oblique; floors above lift 12 px and ghost to 8% opacity | room states pulse on change only |
| Room | dollhouse peek from doorway height — **never first-person** (command tool, not a game walkthrough; context must survive) | none — stillness reads as respect |

Universal camera laws: every move is **interruptible and blendable** (a new input retargets mid-flight — no animation lockout); free camera movement never changes focus (§7); reduced-motion replaces flights with 200 ms cross-fades; all easings/durations from the DESIGN_LANGUAGE motion tokens (band changes = `cinematic` 600 ms, within-band = `standard` 320 ms).

## 6. Altitude transitions (the eight seams, choreographed)

1. **World ⇄ Country** — zoom + great-arc fade; globe curvature flattens.
2. **Country ⇄ Region** — *the tilt is earned*: pitch ramps 15°→60° **during** descent, so the user arrives into the strategic tilt by traveling, not by teleport. (This is precisely what the standalone CSS sector world could never do — the tilt appeared without travel, which is why it felt like another app.)
3. **Region ⇄ Market** — **conservation of light**: the sector polygon's glow dims exactly as its member buildings' emissives rise — the sector's luminance visibly *redistributes* into its constituents. One light budget, handed down. The single strongest "one reality" cue in the product.
4. **Market ⇄ Asset** — dolly-in; comps dim to 40%; the asset's label pill promotes (grows from list-rank to title-rank).
5. **Asset ⇄ Building** — **the renderer match-cut** (§6.5).
6. **Building ⇄ Floor** — vertical slice: floors above lift + ghost; camera lowers to plane; section line sweeps once (draw-on).
7. **Floor ⇄ Room** — glide; target room's walls opacity up; neighbors ghost; state chips settle.
8. **Corridor engage/disengage** (from any of B1–B3) — camera banks onto the path tangent; disengage returns to the stored pre-engage frame (the world remembers where you stood).

### 6.5 The match-cut specification (Mapbox ⇄ Twin)

The only renderer boundary the user ever crosses, governed by contract:

- **Calibration:** at the handoff altitude (≈250 m), the twin camera is solved so the building occupies the *same screen rectangle, bearing, and horizon* as the Mapbox extrusion. Silhouette parity is a build-time test (render both, diff the masks).
- **Cross-fade 320 ms**, building pinned: during the fade, the building must not translate, rotate, or scale on screen. The world swaps *around* it.
- **Anchor persistence:** label pills, the selection halo, and alert beacons are DOM overlays projected from `WorldCamera` — the *same DOM nodes* survive the swap. Nothing the user was looking at is destroyed.
- **Atmosphere continuity:** identical fog color, light azimuth, and emissive palette on both sides of the cut.
- **Preload covenant:** twin assets prefetch at B4 entry; Mapbox stays warm in twin (return is instant). **Loading states between bands are banned** — the world is always already there. If the twin cannot be ready, the camera politely refuses to descend past B4 (soft bounce) rather than showing a spinner.

## 7. Selection behavior

- **Look ≠ lock.** Hover/illuminate (existing grammar: target brightens, siblings dim) is *looking*. Click *selects* (halo attaches, peek panel). Double-click / Enter *commits* — focus changes, `f(focus, altitude)` re-routes panels, camera flies. Free camera roaming never mutates focus.
- **One halo.** A single selection object — ring + stem + diamond pill — projected across every band and both renderers. It is the user's body in this world; it never blinks out at a seam.
- **Band-native hit testing.** A click resolves to the *band's* native entity (Region band → sectors; Market band → buildings; Floor band → rooms). Children become clickable only when their parent is focused — no pixel-hunting a room from orbit.
- **Selection cascades visibility, not focus.** Selecting a sector pre-lights its member buildings (anticipatory illumination); focus stays put until commit.
- **Escape** = deselect, then `ascend()` (per the navigation layer — exhausts containment, then raises decision altitude).
- **Shareability:** selection *is* the URL (`/c/...` + `?in=`), restorable exactly — Article 1 extends to the interior.
- **Room-level red line:** a selected room exposes operational state (occupied/vacant, rate, stay-window, housekeeping later). Never names, never identities, never history of *who*. GDPR is a property of the world, not a setting.

## 8. Overlay behavior

Overlays attach to **ontology entities, not renderers** — the world state owns the overlay set; whichever renderer is active draws it. Every overlay family declares: bands, LOD degradation, budget, occlusion rule.

| Family | Bands | Degradation across bands | Budget / occlusion |
|---|---|---|---|
| **Labels** (diamond + stem pills) | all | World: countries only → Region: sectors → Market: assets → interior: floors/rooms | ≤ 7 at rest (collision-resolved); never occlude the focused entity |
| **Flows** (EFE particles) | B0–B3 | great arcs → ribbons → street trickle; **hidden at B4+** (noise indoors) | velocity ∝ rate; reduced-motion → static gradient arrows |
| **Pressure tint** (DP) | B2–B4, interior | sector fill → extrusion emissive → *timeline only* indoors (no spatial tint in rooms) | semantic ramp `signal`→`warn`→`crit` |
| **Leakage arcs** | B0–B2 | outbound arcs exiting toward external sinks (the Greece arc) | executive cells only |
| **Narrative weather** | B0–B2 | fronts/regions; **never below Region** — it is weather; it reads at altitude | NIS panel link |
| **Alert beacons** | all | pulse at the entity anchor; severity = color + budgeted pulse | alert budgets per decision altitude |
| **Selection halo** | all | never degrades — the persistent anchor | exactly one |
| **Provenance veil** | all | stale data cools the *geometry it feeds*: stale rates ⇒ extrusions desaturate; dead source ⇒ overlay withdraws + rail banner | StaleVeil semantics applied to world layers |

Composition rule: what is *shown* comes from the Focus+Altitude cell (`MATRIX`); *how it draws at this camera height* comes from this table. Decision altitude picks the cast; camera band picks the costume.

## 9. Relationship between the two altitudes

- **Decision altitude** (operational/strategic/executive) routes panels, alerts, recs, forecast grain — `lib/focus-altitude.ts`.
- **Camera altitude** (meters, B0–B7) routes rendering — this document.
- Coupling: each matrix cell's `CameraSpec.framing` token maps to a default band (`tight`→B4, `context`→B3, `region`→B2, `network`→B1/B0, `arc`→path-cam, `origin`→B1 over origin geography, `portfolio`→B2). Focus commits *fly the camera*; decision-altitude changes *re-route the UI* and only nudge the camera to its cell default if the user hasn't free-zoomed since last commit (respect the user's hand).
- Free zoom never changes decision altitude. Pressing `1/2/3` never yanks focus. The two axes feel like one reality precisely because neither hijacks the other.

## 10. Unification plan (what happens to the four worlds)

| Artifact | Fate |
|---|---|
| `CoastalCommandCenter` (Mapbox) | **becomes the world**: gains globe projection, pitch choreography, the sector layer, band manager |
| `CoastalSectorMap` (CSS tilt) | **retired as a world**; its grammar survives — blob glow recipe → Mapbox fill/glow layers; diamond+stem pills → DOM markers (counter-rotation dies; real pitch replaces it). Kill-listed after port. |
| `AssetCard` mini-map (`RouteUnderlay`) | replaced by **postcards**: static snapshots rendered *from the real world* at B4 with the unified camera/style. Cards stop simulating; `onLocate` flies the one world to the postcard's exact frame. |
| `HotelTwin3D` (CSS twin) | promoted to **B5–B7 placeholder renderer**: adopts `WorldCamera` + atmosphere tokens *now*, so the match-cut contract is honored even before the Three.js twin replaces it (post-pilot). |
| `/showcase` | remains the component contract gallery; its world artifacts become embedded viewports of the one world, not alternate realities. |

## 11. Phasing (honest)

- **Phase 2 (post-launch, per ROADMAP):** B0–B4 unification — sector layer on Mapbox, pitch-during-descent, conservation-of-light transition, postcards, halo/labels as persistent DOM overlays, band manager keyed to `altMeters`.
- **Phase 3:** twin match-cut with the CSS placeholder; corridor path-cam; provenance veil on world geometry.
- **Post-pilot:** Three.js twin, Floor/Room bands lit by real room-level data (ontology tables land with the data, not before).
- **Never:** first-person walkthroughs, loading spinners between bands, a second world.

The test for every future feature that touches space: *does it live inside the one world, or does it open another window?* If it opens another window, it is wrong — redesign it as a band, an overlay, or a postcard.
