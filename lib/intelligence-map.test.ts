// Pure read-model tests. Run: npx tsx lib/intelligence-map.test.ts
import {
  ioFreshness,
  ioToInsight,
  evidenceCount,
  selectIntelligence,
  type IntelligenceObject,
} from "./intelligence-map";
import type { PropertyIntelligenceNode } from "../types/spatial";

function io(over: Partial<IntelligenceObject> = {}): IntelligenceObject {
  const now = new Date();
  return {
    id: "io-1",
    altitude_level: "market",
    entity_type: "competitive_set",
    entity_id: "cs-1",
    property_id: "terra",
    signal_type: "market_rate_pressure",
    severity: "low",
    confidence: 0.42,
    evidence: [{ source_id: "s", observation_ids: ["a", "b"], observed_at: now.toISOString() }],
    causal_hypothesis: "Median 460 RON pe 11/12.",
    forecast_impact: null,
    recommended_actions: [],
    visual_anchor: { kind: "market", label: "Comp-set", property_id: "terra" },
    status: "active",
    observed_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 3.6e6).toISOString(),
    raw_jsonb: null,
    ...over,
  };
}

function node(id: string): PropertyIntelligenceNode {
  return {
    id,
    name: id,
    currentOccupancy: 60,
    environmentCategory: "coast",
    coordinates: [28, 43],
    isOwn: id === "terra",
    stars: 4,
    city: "Neptun",
    adrRon: 400,
    adrMin: 350,
    adrMax: 500,
    availabilityPct: 40,
    adrTrajectory: [1, 2, 3],
    telemetry: {
      temperatureCelsius: 25,
      windSpeedKmH: 10,
      maritimeAlertStatus: "clear",
      trafficDecelerationMinutes: 0,
      activeRegionalEventsCount: 0,
    },
    competitors: [],
    insight: { observedContext: "SAMPLE", computedImpactDeltaRon: 0, confidenceScore: 0.5, actionableTriggers: [] },
  };
}

let fails = 0;
function ok(cond: boolean, label: string) {
  if (!cond) {
    fails++;
    console.log("  FAIL " + label);
  } else {
    console.log("  ok " + label);
  }
}

const DEAD = new Date(Date.now() - 100 * 3.6e6).toISOString();

ok(ioFreshness(io()) === "fresh", "fresh within expiry");
ok(ioFreshness(io({ expires_at: DEAD })) === "dead", "long-expired -> dead");

const ins = ioToInsight(io({ causal_hypothesis: "X", confidence: 0.42, recommended_actions: [{ type: "raise", label: "Raise" }] }));
ok(ins.observedContext === "X", "causal_hypothesis -> observedContext");
ok(ins.confidenceScore === 0.42, "confidence -> confidenceScore");
ok(ins.actionableTriggers.length === 1 && ins.actionableTriggers[0].label === "Raise", "recommended_actions -> triggers");
ok(evidenceCount(io()) === 2, "evidence observation_ids counted");

const sampleNodes = [node("terra"), node("p2")];

const s0 = selectIntelligence([], sampleNodes);
ok(s0.source === "sample" && s0.objects.length === 0, "no IOs -> SAMPLE");

const s1 = selectIntelligence([io({ id: "io-x", causal_hypothesis: "LIVE", visual_anchor: { property_id: "terra" } })], sampleNodes);
ok(s1.source === "live", "IOs present -> LIVE");
ok((s1.nodes.find((n) => n.id === "terra") as PropertyIntelligenceNode).insight.observedContext === "LIVE", "matched node insight overlaid from IO");
ok((s1.nodes.find((n) => n.id === "p2") as PropertyIntelligenceNode).insight.observedContext === "SAMPLE", "unmatched node keeps sample insight");

const s2 = selectIntelligence([io({ expires_at: DEAD })], sampleNodes);
ok(s2.source === "sample", "all-dead IOs -> SAMPLE (never rendered as live)");

console.log(fails === 0 ? "  ALL PASS" : "  " + fails + " FAILED");
process.exit(fails === 0 ? 0 : 1);