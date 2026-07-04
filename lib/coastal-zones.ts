// Coastal market zones - the region-altitude world treatment (UXP grammar: the
// territory reads as extruded slabs, the instrumented market glows). Zone
// geometry is approximate market-area footprint, NOT cadastral truth - it is a
// visual index of WHERE the platform watches. Heights/colors derive from real
// intelligence_objects: the live zone rises with tonight's market compression;
// zones without collectors stay low, neutral slate (Truth Doctrine - no fake
// signal outside the instrumented market).

import type { Feature, FeatureCollection, Polygon } from "geojson";
import { C } from "@/lib/command-theme";
import { PACE_COLORS } from "@/lib/property-extrusions";
import type { IntelligenceObject } from "@/lib/intelligence-map";

interface CoastZone { id: string; name: string; ring: number[][] }

const ZONES: CoastZone[] = [
  { id: "mamaia",    name: "Mamaia",                  ring: [[28.590, 44.205], [28.640, 44.205], [28.665, 44.275], [28.615, 44.285], [28.590, 44.205]] },
  { id: "constanta", name: "Constanta",               ring: [[28.580, 44.130], [28.670, 44.140], [28.660, 44.205], [28.590, 44.200], [28.580, 44.130]] },
  { id: "eforie",    name: "Eforie",                  ring: [[28.615, 44.010], [28.660, 44.020], [28.650, 44.075], [28.610, 44.065], [28.615, 44.010]] },
  { id: "costinesti", name: "Costinesti",             ring: [[28.625, 43.925], [28.665, 43.935], [28.660, 43.965], [28.620, 43.955], [28.625, 43.925]] },
  { id: "olimp-neptun", name: "Olimp - Neptun",       ring: [[28.580, 43.855], [28.625, 43.862], [28.618, 43.900], [28.575, 43.892], [28.580, 43.855]] },
  { id: "jupiter-saturn", name: "Jupiter - Saturn",   ring: [[28.565, 43.810], [28.615, 43.818], [28.610, 43.855], [28.560, 43.848], [28.565, 43.810]] },
  { id: "mangalia",  name: "Mangalia",                ring: [[28.555, 43.775], [28.605, 43.782], [28.600, 43.812], [28.550, 43.805], [28.555, 43.775]] },
];

const LIVE_ZONE = "olimp-neptun";
const BASE_HEIGHT = 1100;  // metres - uninstrumented zones, a quiet slab
const LIVE_FLOOR = 2600;   // metres - the live market always reads taller
const LIVE_SPAN = 5200;    // metres - scaled by tonight's compression

export interface ZoneProps {
  id: string; name: string; height: number; color: string; live: boolean;
  [k: string]: unknown;
}

export function buildCoastalZones(objects: IntelligenceObject[]): FeatureCollection<Polygon, ZoneProps> {
  const market = objects.filter((io) => io.signal_type === "market_rate_pressure");
  const tonight = market
    .slice()
    .sort((a, b) => String((a.raw_jsonb as Record<string, unknown>)?.stay_date ?? "")
      .localeCompare(String((b.raw_jsonb as Record<string, unknown>)?.stay_date ?? "")))[0];
  const cmp = Number((tonight?.raw_jsonb as Record<string, unknown>)?.compression ?? 0);
  const actionable = market.some((io) => (io.recommended_actions ?? []).length > 0);

  const features: Feature<Polygon, ZoneProps>[] = ZONES.map((z) => {
    const live = z.id === LIVE_ZONE && market.length > 0;
    return {
      type: "Feature",
      id: z.id,
      properties: {
        id: z.id,
        name: z.name,
        live,
        height: live ? Math.round(LIVE_FLOOR + cmp * LIVE_SPAN) : BASE_HEIGHT,
        color: live ? (actionable ? C.money : C.live) : PACE_COLORS.balanced,
      },
      geometry: { type: "Polygon", coordinates: [z.ring] },
    };
  });
  return { type: "FeatureCollection", features };
}

/** Label anchor (centroid-ish) per zone for the symbol layer. */
export function buildZoneLabels(objects: IntelligenceObject[]): FeatureCollection<import("geojson").Point, ZoneProps> {
  const zones = buildCoastalZones(objects);
  return {
    type: "FeatureCollection",
    features: zones.features.map((f) => {
      const ring = f.geometry.coordinates[0];
      const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      return {
        type: "Feature" as const,
        id: f.properties.id,
        properties: f.properties,
        geometry: { type: "Point" as const, coordinates: [lng, lat] },
      };
    }),
  };
}