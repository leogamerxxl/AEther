// Aether - intelligence object read-model mapping (pure, framework-free).
//
// intelligence_objects are the canonical source of truth for the spatial UI. This
// module maps a raw IO row onto the existing spatial UI model
// (PropertyIntelligenceNode / TacticalOODAInsight). It RENDERS what the world model
// already computed - it never re-derives intelligence. Freshness is read-time.

import type { PropertyIntelligenceNode, TacticalOODAInsight } from "../types/spatial";

export type IntelSource = "live" | "sample";
export type Freshness = "fresh" | "cooling" | "stale" | "dead";

export interface IntelligenceObject {
  id: string;
  altitude_level: string;
  entity_type: string;
  entity_id: string | null;
  property_id: string;
  signal_type: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  confidence: number;
  evidence:
    | { source_id?: string; observation_ids?: string[]; observed_at?: string; coverage?: number }[]
    | null;
  causal_hypothesis: string | null;
  forecast_impact:
    | { metric?: string; direction?: string; magnitude?: number; unit?: string; horizon_days?: number }
    | null;
  recommended_actions: { id?: string; type?: string; label?: string; [k: string]: unknown }[] | null;
  visual_anchor: { kind?: string; label?: string; property_id?: string; lat?: number; lng?: number } | null;
  status: string;
  observed_at: string;
  expires_at: string | null;
  raw_jsonb: Record<string, unknown> | null;
}

// Computed at read time from the IO's own observed_at/expires_at (provenance
// doctrine) - never stored, never invented.
export function ioFreshness(
  io: Pick<IntelligenceObject, "observed_at" | "expires_at">,
  now: Date = new Date(),
): Freshness {
  const t = now.getTime();
  const exp = io.expires_at ? Date.parse(io.expires_at) : NaN;
  if (!Number.isNaN(exp)) {
    if (t <= exp) return "fresh";
    const ageH = (t - exp) / 3.6e6;
    return ageH <= 24 ? "cooling" : ageH <= 72 ? "stale" : "dead";
  }
  const obs = io.observed_at ? Date.parse(io.observed_at) : NaN;
  if (Number.isNaN(obs)) return "dead";
  const ageH = (t - obs) / 3.6e6;
  return ageH <= 26 ? "fresh" : ageH <= 50 ? "cooling" : ageH <= 96 ? "stale" : "dead";
}

export function evidenceCount(io: IntelligenceObject): number {
  return (io.evidence ?? []).reduce((n, e) => n + (e.observation_ids?.length ?? 0), 0);
}

// IO -> the existing OODA insight model the UI already renders.
export function ioToInsight(io: IntelligenceObject): TacticalOODAInsight {
  return {
    observedContext: io.causal_hypothesis ?? `${io.signal_type} (${io.severity})`,
    computedImpactDeltaRon: io.forecast_impact?.magnitude ?? 0,
    confidenceScore: io.confidence,
    actionableTriggers: (io.recommended_actions ?? []).map((a, i) => ({
      id: String(a.id ?? a.type ?? i),
      label: String(a.label ?? a.type ?? "Actiune"),
      targetPayload: a,
    })),
  };
}

const SEV_RANK: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

// Overlay the live IO-derived insight onto matching sample nodes (matched by
// visual_anchor.property_id or entity_id). Unmatched nodes keep their sample
// scaffold; the global `source` flag + badge tell the user coverage is partial.
export function applyIntelligenceToNodes(
  sampleNodes: PropertyIntelligenceNode[],
  ios: IntelligenceObject[],
): PropertyIntelligenceNode[] {
  const byNode = new Map<string, IntelligenceObject>();
  for (const io of ios) {
    const key = io.visual_anchor?.property_id ?? io.entity_id ?? "";
    if (!key) continue;
    const cur = byNode.get(key);
    const better =
      !cur ||
      SEV_RANK[io.severity] > SEV_RANK[cur.severity] ||
      (SEV_RANK[io.severity] === SEV_RANK[cur.severity] && io.observed_at > cur.observed_at);
    if (better) byNode.set(key, io);
  }
  if (byNode.size === 0) return sampleNodes;
  return sampleNodes.map((n) => {
    const io = byNode.get(n.id);
    return io ? { ...n, insight: ioToInsight(io) } : n;
  });
}

export interface SpatialIntelligence {
  source: IntelSource;
  nodes: PropertyIntelligenceNode[];
  objects: IntelligenceObject[];
}

// Live only when at least one non-dead IO exists; otherwise SAMPLE (never render a
// dead/empty world model as if it were production).
export function selectIntelligence(
  ios: IntelligenceObject[] | null | undefined,
  sampleNodes: PropertyIntelligenceNode[],
): SpatialIntelligence {
  const live = (ios ?? []).filter((io) => ioFreshness(io) !== "dead");
  if (live.length === 0) return { source: "sample", nodes: sampleNodes, objects: [] };
  return { source: "live", nodes: applyIntelligenceToNodes(sampleNodes, live), objects: live };
}