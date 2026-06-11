// Derived revenue intelligence for a node. Turns raw rate/availability/telemetry
// into decision-grade signals: rate gap vs comp set, market rank, demand pressure,
// and a single concrete recommendation with evidence. Real where data is real
// (ADR, availability, comp set); telemetry-driven lines are deterministic sample.

import type { PropertyIntelligenceNode } from "@/types/spatial";

export type Pace = "tight" | "balanced" | "soft";

export interface AssetIntel {
  occupancy: number;
  adr: number;
  revparEst: number;
  compMedian: number;
  gapRon: number;
  gapPct: number;
  rank: number;
  total: number;
  availabilityPct: number;
  pressurePct: number;
  pace: Pace;
  band: [number, number];
  trajectory: number[];
  headline: { action: string; deltaRon: number; direction: "up" | "down" | "hold"; confidencePct: number };
  evidence: string[];
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function deriveIntel(n: PropertyIntelligenceNode): AssetIntel {
  const compRates = n.competitors.map((c) => c.currentAdrRon);
  const compMedian = median(compRates) || n.adrRon;
  const gapRon = n.adrRon - compMedian;
  const gapPct = Math.round((gapRon / compMedian) * 1000) / 10;
  const all = [n.adrRon, ...compRates].sort((a, b) => b - a);
  const rank = all.indexOf(n.adrRon) + 1;
  const total = all.length;
  const pressurePct = Math.max(0, Math.min(100, 100 - n.availabilityPct));
  const pace: Pace = pressurePct >= 72 ? "tight" : pressurePct >= 48 ? "balanced" : "soft";
  const revparEst = Math.round((n.adrRon * n.currentOccupancy) / 100);

  // recommendation: underpriced + tight demand => raise toward median; overpriced + soft => trim.
  let direction: "up" | "down" | "hold" = "hold";
  let deltaRon = 0;
  if (gapRon < -8 && pressurePct >= 65) { direction = "up"; deltaRon = Math.min(Math.round(-gapRon * 0.6), Math.round(n.adrRon * 0.09)); }
  else if (gapRon > 20 && pressurePct <= 45) { direction = "down"; deltaRon = -Math.min(Math.round(gapRon * 0.4), Math.round(n.adrRon * 0.07)); }
  const action = direction === "up" ? `Raise ADR +${deltaRon} RON`
    : direction === "down" ? `Trim ADR ${deltaRon} RON`
    : "Hold rate — aligned to demand";

  const t = n.telemetry;
  const driver = t.maritimeAlertStatus !== "clear"
    ? `Wind front ${t.windSpeedKmH} km/h → demand shifts to pool & spa; protect indoor-leisure rate`
    : t.trafficDecelerationMinutes > 10
    ? `DN39 +${t.trafficDecelerationMinutes} min inbound → short-stay scarcity, weekend pricing power`
    : t.activeRegionalEventsCount > 0
    ? `${t.activeRegionalEventsCount} regional event(s) live → compression window opening`
    : `No weather or transport friction — demand purely rate-led`;

  const evidence = [
    pace === "tight"
      ? `Occupancy ${n.currentOccupancy}% · only ${n.availabilityPct}% rooms left while comp set sits softer`
      : pace === "soft"
      ? `Occupancy ${n.currentOccupancy}% · ${n.availabilityPct}% open — demand needs stimulation, not premium`
      : `Occupancy ${n.currentOccupancy}% · ${n.availabilityPct}% open — balanced pace`,
    gapRon < 0
      ? `ADR ${n.adrRon} RON · ${Math.abs(gapPct)}% below comp median ${compMedian} · rank ${rank}/${total}`
      : `ADR ${n.adrRon} RON · ${gapPct}% above comp median ${compMedian} · rank ${rank}/${total}`,
    driver,
  ];

  return {
    occupancy: n.currentOccupancy,
    adr: n.adrRon,
    revparEst,
    compMedian,
    gapRon,
    gapPct,
    rank,
    total,
    availabilityPct: n.availabilityPct,
    pressurePct,
    pace,
    band: [n.adrMin, n.adrMax],
    trajectory: n.adrTrajectory,
    headline: { action, deltaRon, direction, confidencePct: Math.round(n.insight.confidenceScore * 100) },
    evidence,
  };
}

/* Competitor intelligence — what a rival is doing, not what to price.
   Social reach, booking pace, and live activations. Deterministic SAMPLE
   (reviews/posts/booking pace are not in the DB yet). */
export interface CompetitorIntel {
  socialReach: string;
  socialGrowthPct: number;
  sentimentPct: number;
  topPlatform: string;
  bookingPaceDeltaPct: number;
  bookingPaceLabel: string;
  events: string[];
}

const EVENT_POOL = [
  "Live DJ sunset sessions", "Spa & wellness retreat week", "Seafood festival partnership",
  "Kids club summer program", "Wine tasting weekends", "Beach volleyball series",
  "Rooftop cinema nights", "Sunrise yoga series", "Pool party Saturdays", "Local craft market pop-up",
];
const PLATFORMS = ["Instagram", "TikTok", "Facebook"];

function rng(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

export function deriveCompetitorIntel(n: PropertyIntelligenceNode): CompetitorIntel {
  const r = rng(n.id + n.name + "social");
  const reachK = Math.round((9 + r() * 42) * 10) / 10;
  const growth = Math.round(r() * 42 - 9);
  const sentiment = Math.round(63 + r() * 31);
  const platform = PLATFORMS[Math.floor(r() * PLATFORMS.length)];
  const pace = Math.round(r() * 26 - 7);
  const paceLabel = pace > 6 ? "strong pickup" : pace < -2 ? "softening" : "steady";
  const start = Math.floor(r() * EVENT_POOL.length);
  const count = 2 + Math.floor(r() * 2);
  const events = Array.from({ length: count }, (_, j) => EVENT_POOL[(start + j * 3) % EVENT_POOL.length]);
  return { socialReach: reachK + "k", socialGrowthPct: growth, sentimentPct: sentiment, topPlatform: platform, bookingPaceDeltaPct: pace, bookingPaceLabel: paceLabel, events };
}
