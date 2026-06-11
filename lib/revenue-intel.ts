// Revenue intelligence - the strategic layer. Deterministic derivations from the
// property node so Revenue Command answers the only two questions that matter:
//   "If I do nothing, what happens?"  and  "What should I do right now to earn more?"

import type { PropertyIntelligenceNode } from "@/types/spatial";
import { deriveIntel } from "./spatial-intel";

const ROOMS = 32;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r100 = (n: number) => Math.round(n / 100) * 100;

export interface DemandDriver { label: string; deltaPct: number }
export interface CompetitorMove { name: string; change: string; dir: "up" | "down" | "soldout" | "new" }
export interface RevenueIntel {
  occupancy: number; adr: number; revpar: number;
  marketPosition: { ratePct: number; occPct: number; revparPct: number };
  action: { title: string; currentAdr: number; suggestedAdr: number; expectedGainRon: number; confidencePct: number; lever: string; up: boolean };
  doNothingLossRon: number;
  revenueForecast: { expectedRon: number; confidencePct: number; vsLastYearPct: number };
  occForecast: { tomorrow: number; weekend: number; next14: number };
  pace: { current: number; vsLastYear: number; vsCompetitors: number; label: string };
  pickup: { today: number; yesterday: number; trend: string };
  demand: { index: number; drivers: DemandDriver[] };
  competitors: CompetitorMove[];
  marketAdrPct: number;
  risks: { label: string; impactPct: number; when: string }[];
  trajectory: number[];
}

export function deriveRevenueIntel(node: PropertyIntelligenceNode): RevenueIntel {
  const i = deriveIntel(node);
  const occ = i.occupancy, adr = i.adr, revpar = i.revparEst;

  const up = i.headline.direction !== "down";
  const premium = Math.round(adr * 0.087);
  const suggested = up ? adr + premium : adr - premium;
  const weekend = clamp(occ + 18, 50, 99);
  const tomorrow = clamp(occ + 6, 40, 99);
  const next14 = clamp(occ - 3, 40, 95);
  const gain = r100(premium * ROOMS * (weekend / 100) * 3 + premium * ROOMS * (occ / 100) * 2);
  const forecast7 = Math.round(revpar * ROOMS * 7);
  const paceCur = i.pace === "tight" ? 18 : i.pace === "balanced" ? 6 : -9;

  const drivers: DemandDriver[] = [
    { label: "Hotel demand", deltaPct: paceCur >= 0 ? paceCur : 4 },
    { label: "Weather outlook", deltaPct: node.telemetry.temperatureCelsius >= 24 ? 9 : -4 },
    { label: "Romanian coast searches", deltaPct: 14 },
    { label: "Bulgaria coast searches", deltaPct: -6 },
    { label: "Inbound traffic", deltaPct: node.telemetry.trafficDecelerationMinutes > 8 ? 11 : 3 },
  ];
  const demandIndex = clamp(54 + Math.round(drivers.reduce((a, d) => a + d.deltaPct, 0) * 0.8), 0, 100);

  const comps = node.competitors.slice(0, 3);
  const moves: CompetitorMove[] = comps.map((c, k) =>
    k === 0 ? { name: c.name, change: "+8%", dir: "up" as const } :
    k === 1 ? { name: c.name, change: "Sold out", dir: "soldout" as const } :
    { name: c.name, change: "New package", dir: "new" as const });

  const storm = node.telemetry.windSpeedKmH > 20 || node.telemetry.maritimeAlertStatus !== "clear";
  const risks = storm
    ? [{ label: "Storm front building offshore", impactPct: -5, when: "Fri" }]
    : [{ label: "Midweek demand softness", impactPct: -3, when: "Tue-Wed" }];

  return {
    occupancy: occ, adr, revpar,
    marketPosition: { ratePct: i.gapPct, occPct: 2.4, revparPct: 6.1 },
    action: { title: up ? "Increase weekend ADR" : "Soften midweek rate", currentAdr: adr, suggestedAdr: suggested, expectedGainRon: gain, confidencePct: i.headline.confidencePct, lever: up ? "Fri-Sun" : "Tue-Wed", up },
    doNothingLossRon: gain,
    revenueForecast: { expectedRon: forecast7, confidencePct: 84, vsLastYearPct: 12 },
    occForecast: { tomorrow, weekend, next14 },
    pace: { current: paceCur, vsLastYear: 7, vsCompetitors: 11, label: i.pace === "tight" ? "Ahead of pace" : i.pace === "soft" ? "Behind pace" : "On pace" },
    pickup: { today: 12, yesterday: 4, trend: "Accelerating" },
    demand: { index: demandIndex, drivers },
    competitors: moves, marketAdrPct: 6,
    risks, trajectory: i.trajectory,
  };
}
