// Coastal market zones - the region-altitude world treatment. REAL UAT
// administrative polygons (OSM admin_level=8, lib/world/coastal-uat.json):
// every coastal irregularity, bay and enclave is the true shape, simplified
// only ~45m. Heights are near-uniform - relief exists to tell zones apart,
// not to shout; the instrumented UAT (Mangalia - Neptun/Olimp/Jupiter/Venus/
// Saturn are its littoral) carries the live accent, harbor when actionable.
// A grow feature-state lets the slabs RISE when the region band is entered.

import type { Feature, FeatureCollection, MultiPolygon, Point } from "geojson";
import { C } from "@/lib/command-theme";
import { PACE_COLORS } from "@/lib/property-extrusions";
import type { IntelligenceObject } from "@/lib/intelligence-map";
import uat from "@/lib/world/coastal-uat.json";

const LIVE_ZONE = "mangalia";
const BASE_HEIGHT = 300;  // metres - quiet, near-uniform relief
const LIVE_HEIGHT = 430;  // metres - one visible step above, no more

interface UatFeat {
  id: string;
  properties: { name: string };
  geometry: MultiPolygon;
}

export interface ZoneProps {
  id: string; name: string; height: number; color: string; live: boolean;
  [k: string]: unknown;
}

function marketState(objects: IntelligenceObject[]): { hasLive: boolean; actionable: boolean } {
  const market = objects.filter((io) => io.signal_type === "market_rate_pressure");
  return {
    hasLive: market.length > 0,
    actionable: market.some((io) => (io.recommended_actions ?? []).length > 0),
  };
}

export function buildCoastalZones(objects: IntelligenceObject[]): FeatureCollection<MultiPolygon, ZoneProps> {
  const { hasLive, actionable } = marketState(objects);
  const features: Feature<MultiPolygon, ZoneProps>[] = (uat as { features: UatFeat[] }).features.map((f) => {
    const live = f.id === LIVE_ZONE && hasLive;
    return {
      type: "Feature",
      id: f.id,
      properties: {
        id: f.id,
        name: f.properties.name,
        live,
        height: live ? LIVE_HEIGHT : BASE_HEIGHT,
        color: live ? (actionable ? C.money : C.live) : PACE_COLORS.balanced,
      },
      geometry: f.geometry,
    };
  });
  return { type: "FeatureCollection", features };
}

/** Label anchor per zone: centroid of the largest outer ring. */
export function buildZoneLabels(objects: IntelligenceObject[]): FeatureCollection<Point, ZoneProps> {
  const zones = buildCoastalZones(objects);
  return {
    type: "FeatureCollection",
    features: zones.features.map((f) => {
      const largest = f.geometry.coordinates
        .map((poly) => poly[0])
        .sort((a, b) => b.length - a.length)[0] ?? [[0, 0]];
      const lng = largest.reduce((s, p) => s + p[0], 0) / largest.length;
      const lat = largest.reduce((s, p) => s + p[1], 0) / largest.length;
      return {
        type: "Feature" as const,
        id: f.properties.id,
        properties: f.properties,
        geometry: { type: "Point" as const, coordinates: [lng, lat] },
      };
    }),
  };
}

export const ZONE_IDS: string[] = (uat as { features: UatFeat[] }).features.map((f) => f.id);