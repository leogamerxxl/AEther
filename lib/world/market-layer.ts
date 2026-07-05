// Market massing - deck.gl low-poly extrusions for the WIDER market (Olimp ->
// Jupiter, outside the crafted three.js patch which owns the 750m around the
// pilot). Real OSM footprints (lib/world/market-osm.json), deterministic
// heights, flat dark lambert - context, not spectacle. Interleaved with the
// Mapbox scene so buildings sit in the world, not on top of it.

import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import market from "@/lib/world/market-osm.json";

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
  const id = Number(f.id ?? 0);
  if (name.includes("hotel") || p.k === "hotel") return (6 + Math.round(hash(id) * 4)) * FLOOR_M;
  if (p.k === "apartments") return 5 * FLOOR_M;
  return (2 + Math.round(hash(id) * 2)) * FLOOR_M;
}

// world pigment (scene asset, same doctrine as the resort scene palette)
const BODY: [number, number, number, number] = [22, 27, 38, 235];
const HOTEL: [number, number, number, number] = [30, 37, 52, 240];

export const MARKET_MIN_ZOOM = 11.8;
export const MARKET_MAX_ZOOM = 16.4;

function buildLayer(visible: boolean) {
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
      return hotel ? HOTEL : BODY;
    },
    material: { ambient: 0.4, diffuse: 0.55, shininess: 24, specularColor: [28, 38, 58] },
    parameters: { cullMode: "back" },
  });
}

export function createMarketOverlay(): { overlay: MapboxOverlay; setVisible: (v: boolean) => void } {
  const overlay = new MapboxOverlay({ interleaved: true, layers: [buildLayer(true)] });
  let cur = true;
  return {
    overlay,
    setVisible: (v: boolean) => {
      if (v === cur) return;
      cur = v;
      overlay.setProps({ layers: [buildLayer(v)] });
    },
  };
}