// Corridor migration-pressure intelligence.
//
// Feeds the real, tested correlationEngine (calculateMigrationProbability) with
// the live corridor snapshot (lib/corridor.ts) plus the current macro signals
// for the Neptun / DN39 axis, so Revenue Command can answer the strategic
// question the dashboard exists to answer:
//
//   "If I hold my rate, do my guests defect to Bulgaria / Greece?"
//
// All inputs are aggregate market signals (Zero-PII). When live fuel / sentiment
// / traffic / event feeds land, this is the single function to rewire - the UI
// consumes the typed MigrationRiskResult and does not change.

import { calculateMigrationProbability } from "@/lib/analytics/correlationEngine";
import type { MigrationRiskResult } from "@/lib/analytics/types";
import { OWN } from "@/lib/corridor";

// BNR reference (RON per EUR), captured alongside the corridor snapshot.
const RON_PER_EUR = 4.97;

// Total sellable rooms at Hotel Terra (mirrors revenue-intel ROOMS).
const ROOMS = 32;

/**
 * Build the current macro vector from the corridor snapshot and run the
 * migration-risk engine. Deterministic given the day - safe to call in render.
 */
export function deriveMigrationRisk(): MigrationRiskResult {
  const ownAdrEur = (OWN.rate ?? 575) / RON_PER_EUR; // ~115.7 EUR

  // Nearest credible Bulgarian alternative (Sunny Beach 4-star, June corridor).
  const bulgariaAdrEur = 96;

  const now = new Date();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const month = now.getMonth() + 1;
  const season: "peak" | "shoulder" | "off" =
    month >= 7 && month <= 8 ? "peak" : month === 6 || month === 9 ? "shoulder" : "off";

  return calculateMigrationProbability(
    {
      date: now,

      // Fuel - drive-to-coast budget sensitivity (RON/L benzina 95, June 2026).
      fuelPriceRon: 7.42,
      fuelPriceDeltaPct: 0.016,
      fuelPriceIndex: 1.031,

      // Competitor (Bulgaria) vs Hotel Terra base.
      competitorAdrEur: bulgariaAdrEur,
      competitorDestination: "sunny_beach",
      romanianBaseAdrEur: ownAdrEur,
      competitorAdrIndex: bulgariaAdrEur / ownAdrEur, // ~0.83 -> Bulgaria ~17% cheaper

      // Aggregate social sentiment for the Romanian coast.
      sentimentScore: -0.08,
      sentimentVelocity: -0.03,

      // DN39 inbound demand proxy (Constanta-Mangalia).
      dn39TrafficIndex: 0.62,

      // Calendar anchors.
      daysToNearestMajorEvent: 26,
      nearestEventName: "Neversea 2026",
      isWeekendOrHoliday: isWeekend,
      season,
      month,
    },
    {
      name: OWN.name,
      segment: "4star",
      currentOccupancy: 0.76,
      currentAdrEur: ownAdrEur,
      targetOccupancy: 0.82,
      totalRooms: ROOMS,
    },
  );
}

/** Convert an EUR ADR back to RON for display alongside the rest of the UI. */
export function eurToRon(eur: number): number {
  return Math.round(eur * RON_PER_EUR);
}
