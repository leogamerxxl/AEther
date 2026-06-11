// Builds PropertyIntelligenceNode[] from the REAL corridor (OSM-accurate coords,
// real competitor ADR). Telemetry + OODA insight are deterministic SAMPLE until
// OpenWeather / traffic / the OODA edge function connect. Marked SAMPLE in the UI.

import { ALL_POINTS, OWN, MARKET_AVG, METRICS, TRAJECTORY } from "@/lib/corridor";
import type {
  PropertyIntelligenceNode,
  EnvironmentalTelemetry,
  CompetitorRateSnapshot,
  TacticalOODAInsight,
} from "@/types/spatial";

function seeded(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const VELOCITIES: CompetitorRateSnapshot["bookingVelocityTrend"][] = ["accelerating", "stable", "decelerating"];

function buildTelemetry(r: () => number): EnvironmentalTelemetry {
  const wind = Math.round(6 + r() * 32);
  const status: EnvironmentalTelemetry["maritimeAlertStatus"] = wind > 30 ? "critical" : wind > 22 ? "warning" : "clear";
  return {
    temperatureCelsius: Math.round((22 + r() * 9) * 10) / 10,
    windSpeedKmH: wind,
    maritimeAlertStatus: status,
    trafficDecelerationMinutes: Math.round(r() * 18),
    activeRegionalEventsCount: Math.round(r() * 3),
  };
}

function buildInsight(name: string, isOwn: boolean, t: EnvironmentalTelemetry, r: () => number): TacticalOODAInsight {
  let observedContext: string;
  let delta: number;
  if (t.maritimeAlertStatus !== "clear") {
    observedContext =
      "Coastal wind front building offshore. Beach occupancy migrates inland toward pool and spa domains. Capture the shift with a bundled indoor-leisure premium rather than discounting the room.";
    delta = 38 + Math.round(r() * 40);
  } else if (t.trafficDecelerationMinutes > 10) {
    observedContext =
      "Inbound arterial congestion on the DN39 corridor is rising and the rail window is tightening. Short-stay inventory is at risk of last-minute scarcity. Hold rate and push direct mobile offers to high-intent traffic.";
    delta = 22 + Math.round(r() * 30);
  } else {
    observedContext = isOwn
      ? "Your competitive set sits near " + MARKET_AVG + " RON and demand across the corridor is firm. There is headroom to lift ADR without surrendering pace."
      : "Demand across the corridor is firm and this asset is tracking the set. Pricing pressure is upward over the next ten days.";
    delta = isOwn ? MARKET_AVG - (OWN.rate as number) + Math.round(r() * 20) : 10 + Math.round(r() * 24);
  }
  const triggers = [
    { id: "adr", label: "Optimize ADR by +45 RON", targetPayload: { kind: "rate", deltaRon: 45 } },
    { id: "pool", label: "Deploy Dynamic Weekend Premium Pool Package", targetPayload: { kind: "package", sku: "pool-weekend" } },
    { id: "flash", label: "Push Direct Mobile Flash Offer", targetPayload: { kind: "promo", channel: "direct-mobile" } },
  ].slice(0, t.maritimeAlertStatus !== "clear" ? 2 : 3);
  return { observedContext, computedImpactDeltaRon: delta, confidenceScore: Math.round((0.62 + r() * 0.3) * 100) / 100, actionableTriggers: triggers };
}

export function buildNodes(): PropertyIntelligenceNode[] {
  const rated = ALL_POINTS.filter((p) => p.rate != null);
  return ALL_POINTS.map((p) => {
    const r = seeded(p.id + p.name);
    const telemetry = buildTelemetry(r);
    const competitors: CompetitorRateSnapshot[] = rated
      .filter((c) => c.id !== p.id)
      .sort((a, b) => (b.rate as number) - (a.rate as number))
      .slice(0, 5)
      .map((c) => ({ propertyId: c.id, name: c.own ? "Hotel Terra" : c.name, currentAdrRon: c.rate as number, bookingVelocityTrend: VELOCITIES[Math.floor(r() * 3)] }));
    return {
      id: p.id,
      name: p.own ? "Hotel Terra Neptun" : p.name,
      currentOccupancy: p.own ? METRICS.occupancy : Math.round(58 + r() * 34),
      environmentCategory: "coast",
      coordinates: [p.lng, p.lat],
      isOwn: !!p.own,
      stars: p.stars,
      city: p.city,
      adrRon: (p.rate ?? MARKET_AVG),
      adrMin: (p.minRate ?? Math.round((p.rate ?? MARKET_AVG) * 0.86)),
      adrMax: (p.maxRate ?? Math.round((p.rate ?? MARKET_AVG) * 1.2)),
      availabilityPct: p.avail,
      adrTrajectory: p.own ? TRAJECTORY : TRAJECTORY.map((v) => Math.round(v + (r() - 0.5) * 26)),
      telemetry,
      competitors,
      insight: buildInsight(p.name, !!p.own, telemetry, r),
    };
  });
}

export const NODES: PropertyIntelligenceNode[] = buildNodes();
export const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));
