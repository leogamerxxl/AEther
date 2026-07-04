// Builds color-coded 3D building extrusions for each property on the command map.
// Replaces flat point markers with volumetric towers:
//   color  = booking pace  (own = cyan, tight = emerald, soft = amber, balanced = slate)
//   height = ADR, normalized across the set (taller tower = pricier asset)
// Consumed by CoastalCommandCenter as a Mapbox `fill-extrusion` layer.

import type { Feature, FeatureCollection, Polygon } from "geojson";
import { NODES } from "@/lib/spatial-data";
import { deriveIntel } from "@/lib/spatial-intel";
import type { PropertyIntelligenceNode } from "@/types/spatial";

export const PACE_COLORS = {
  own: "#06b6d4",
  tight: "#10b981",
  soft: "#f59e0b",
  balanced: "#5b7fa6",
} as const;

/** Mix a hex toward white by amt (0..1) for a soft luminous tint. */
export function lightenHex(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function paceColor(n: PropertyIntelligenceNode): string {
  if (n.isOwn) return PACE_COLORS.own;
  const pace = deriveIntel(n).pace;
  if (pace === "tight") return PACE_COLORS.tight;
  if (pace === "soft") return PACE_COLORS.soft;
  return PACE_COLORS.balanced;
}

// Square footprint (5-point ring) around [lng,lat] with a half-size in metres.
function footprint(lng: number, lat: number, halfMeters: number): number[][] {
  const dLat = halfMeters / 111_320;
  const dLng = halfMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}

export interface ExtrusionProps {
  id: string;
  name: string;
  color: string;
  lit: string;
  height: number;
  isOwn: boolean;
  [k: string]: unknown;
}

export function buildPropertyExtrusions(): FeatureCollection<Polygon, ExtrusionProps> {
  const adrs = NODES.map((n) => n.adrRon).filter((v) => v > 0);
  const min = Math.min(...adrs);
  const max = Math.max(...adrs);
  const span = Math.max(1, max - min);

  const features: Feature<Polygon, ExtrusionProps>[] = NODES.map((n) => {
    const norm = (n.adrRon - min) / span; // 0..1 across the set
    const height = Math.round(34 + norm * 58 + (n.isOwn ? 18 : 0));
    const half = n.isOwn ? 24 : 18; // metres
    return {
      type: "Feature",
      id: n.id, // enables feature-state for hover/selection
      properties: {
        id: n.id,
        name: n.name,
        color: paceColor(n),
        lit: lightenHex(paceColor(n), 0.66),
        height,
        isOwn: n.isOwn,
      },
      geometry: {
        type: "Polygon",
        coordinates: [footprint(n.coordinates[0], n.coordinates[1], half)],
      },
    };
  });

  return { type: "FeatureCollection", features };
}

/** Centroid points for the soft luminescent ground-glow halo under each asset. */
export function buildPropertyGlowPoints(): FeatureCollection<import("geojson").Point, { id: string; name: string; color: string; isOwn: boolean }> {
  return {
    type: "FeatureCollection",
    features: NODES.map((n) => ({
      type: "Feature" as const,
      id: n.id, // enables feature-state + hit-testing on the halo layer
      properties: { id: n.id, name: n.name, color: paceColor(n), isOwn: n.isOwn },
      geometry: { type: "Point" as const, coordinates: [n.coordinates[0], n.coordinates[1]] },
    })),
  };
}
