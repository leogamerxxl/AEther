// Aether (Project Palantir-H) - strict spatial intelligence contracts.

export interface EnvironmentalTelemetry {
  temperatureCelsius: number;
  windSpeedKmH: number;
  maritimeAlertStatus: "clear" | "warning" | "critical";
  trafficDecelerationMinutes: number;
  activeRegionalEventsCount: number;
}

export interface CompetitorRateSnapshot {
  propertyId: string;
  name: string;
  currentAdrRon: number;
  bookingVelocityTrend: "accelerating" | "stable" | "decelerating";
}

export interface TacticalOODAInsight {
  observedContext: string;
  computedImpactDeltaRon: number;
  confidenceScore: number; // 0..1
  actionableTriggers: {
    id: string;
    label: string;
    targetPayload: unknown; // tightened from any (strict)
  }[];
}

export interface PropertyIntelligenceNode {
  id: string;
  name: string;
  currentOccupancy: number;
  environmentCategory: "coast" | "city" | "wellness" | "rural" | "mountain";
  coordinates: [number, number]; // [lng, lat]
  isOwn: boolean;
  stars: number;
  city: string;
  adrRon: number;
  adrMin: number;
  adrMax: number;
  availabilityPct: number;
  adrTrajectory: number[];
  telemetry: EnvironmentalTelemetry;
  competitors: CompetitorRateSnapshot[];
  insight: TacticalOODAInsight;
}
