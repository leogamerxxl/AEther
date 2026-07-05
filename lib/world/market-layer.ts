// Market massing - deck.gl low-poly extrusions for the WIDER market (Olimp ->
// Jupiter, outside the crafted three.js patch which owns the 750m around the
// pilot). Real OSM footprints (lib/world/market-osm.json), deterministic
// heights, flat dark lambert - context, not spectacle. Interleaved with the
// Mapbox scene so buildings sit in the world, not on top of it.

import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer, ArcLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import market from "@/lib/world/market-osm.json";
import { MASSING, type DayPhase, type Rgba } from "@/lib/world/daylight";

const FLOOR_M = 3.1;

type Props = { n?: string; l?: string; h?: string; k?: string };

function hash(n: number): number { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

function heightFor(f: Feature<Polygon, Props>): number {
  const p = f.properties ?? {};
  const h = p.h ? parseFloat(p.h) : NaN;
  if (!Number.isNaN(h) && h > 2) return h;
  const lv = p.l ? parseInt(p.l, 10) : NaN;
  if (!Number.isNaN(lv) && lv > 0) return lv * FLOOR_M + 1.5;
  const name = (p.n ?? "").toLowerCase();
  // deck.gl does NOT expose the top-level GeoJSON id to accessors - seed the
  // deterministic variation from geometry instead (fixes the flat-sole bug:
  // untagged buildings hashed NaN -> elevation 0 -> only footprints rendered)
  const c0 = f.geometry?.coordinates?.[0]?.[0] ?? [0, 0];
  const seed = (c0[0] * 1e6 + c0[1] * 1e6) % 100000;
  if (name.includes("hotel") || p.k === "hotel") return (6 + Math.round(hash(seed) * 4)) * FLOOR_M;
  if (p.k === "apartments") return 5 * FLOOR_M;
  return (2 + Math.round(hash(seed) * 2)) * FLOOR_M;
}

// world pigment comes from the shared daylight clock (cream at noon, dark at night)

export const MARKET_MIN_ZOOM = 11.8;
export const MARKET_MAX_ZOOM = 15.6;

function buildLayer(visible: boolean, phase: DayPhase) {
  const M = MASSING[phase];
  return new GeoJsonLayer<Props>({
    id: "aether-market-massing",
    data: market as unknown as FeatureCollection<Polygon, Props>,
    visible,
    extruded: true,
    filled: true,
    stroked: false,
    getElevation: (f) => heightFor(f as Feature<Polygon, Props>),
    getFillColor: (f) => {
      const p = (f as Feature<Polygon, Props>).properties ?? {};
      const hotel = (p.n ?? "").toLowerCase().includes("hotel") || p.k === "hotel";
      return (hotel ? M.hotel : M.body) as Rgba;
    },
    material: { ambient: 0.4, diffuse: 0.55, shininess: 24, specularColor: [28, 38, 58] },
    parameters: { cullMode: "back" },
  });
}

// Market flows - REAL evidence rendered spatially:
//   arcs = overflow demand from sold-out comps toward the pilot (the exact
//          mechanism behind hold_or_raise recommendations). Arcs live in the
//          interleaved massing overlay (ArcLayer works interleaved).
//   The pressure HEATMAP is a native Mapbox layer (managed in the map effect) -
//          two deck MapboxOverlays on one map collapse the second canvas, and
//          HeatmapLayer is a no-op interleaved, so native is the correct home.
export interface FlowPoint { position: [number, number]; weight: number }
export interface FlowArc { from: [number, number]; to: [number, number] }

export interface MarketOverlayHandle {
  overlay: MapboxOverlay;
  setVisible: (v: boolean) => void;
  setFlowsVisible: (v: boolean) => void;
  setArcs: (arcs: FlowArc[]) => void;
}

export function createMarketOverlay(phase: DayPhase): MarketOverlayHandle {
  let massingVis = true;
  let flowsVis = false;
  let arcs: FlowArc[] = [];

  const build = (): Layer[] => {
    const layers: Layer[] = [buildLayer(massingVis, phase)];
    layers.push(new ArcLayer<FlowArc>({
      id: "aether-demand-arcs",
      data: arcs,
      visible: flowsVis && arcs.length > 0,
      getSourcePosition: (d) => d.from,
      getTargetPosition: (d) => d.to,
      getSourceColor: [230, 181, 102, 40],
      getTargetColor: [230, 181, 102, 230],
      getWidth: 3.2,
      getHeight: 0.4,
      greatCircle: false,
    }));
    return layers;
  };

  const overlay = new MapboxOverlay({ interleaved: true, layers: build() });
  const rebuild = () => overlay.setProps({ layers: build() });
  return {
    overlay,
    setVisible: (v: boolean) => { if (v !== massingVis) { massingVis = v; rebuild(); } },
    setFlowsVisible: (v: boolean) => { if (v !== flowsVis) { flowsVis = v; rebuild(); } },
    setArcs: (a2: FlowArc[]) => { arcs = a2; rebuild(); },
  };
}