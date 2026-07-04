"use client";
// Aether - intelligence object read layer for the spatial UI.
//
// Queries intelligence_objects (RLS-scoped to the authenticated tenant) and maps
// them onto the spatial UI model, with a clearly-labeled SAMPLE fallback when no
// live rows exist. No intelligence is computed here - the world model is canonical.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { NODES } from "@/lib/spatial-data";
import {
  selectIntelligence,
  type IntelligenceObject,
  type SpatialIntelligence,
} from "@/lib/intelligence-map";

// Decision record (io_actions): the authenticated owner accepted/dismissed a
// recommendation. Read back so a decision survives refresh (never write-only).
export type IoDecision = { decision: "accepted" | "dismissed"; decided_at: string;
  verdict?: "supported" | "contradicted" | "inconclusive" };
export type DecisionMap = Record<string, IoDecision>;

export async function fetchDecisions(ioIds: string[]): Promise<DecisionMap> {
  if (ioIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from("io_actions")
      .select("io_id,decision,decided_at")
      .in("io_id", ioIds);
    if (error || !data) return {};
    const map: DecisionMap = {};
    for (const r of data as { io_id: string; decision: IoDecision["decision"]; decided_at: string }[]) {
      map[r.io_id] = { decision: r.decision, decided_at: r.decided_at };
    }
    // outcome verdicts: did the accepted action hold up against the market?
    try {
      const { data: outs } = await supabase
        .from("outcomes")
        .select("io_id,verdict")
        .in("io_id", ioIds);
      for (const o of (outs ?? []) as { io_id: string; verdict: IoDecision["verdict"] }[]) {
        if (map[o.io_id]) map[o.io_id].verdict = o.verdict;
      }
    } catch { /* verdicts are additive - decisions render without them */ }
    return map;
  } catch {
    return {};
  }
}

// Writes the decision record. RLS enforces: own property, own uid, io belongs to
// property, one decision per user per IO. org_id is filled server-side (trigger).
export async function recordDecision(
  io: IntelligenceObject,
  decision: IoDecision["decision"],
): Promise<{ ok: true; decided_at: string } | { ok: false; error: string }> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return { ok: false, error: "not authenticated" };
    const act = (io.recommended_actions ?? [])[0] ?? {};
    const decided_at = new Date().toISOString();
    const { error } = await supabase.from("io_actions").insert({
      io_id: io.id,
      property_id: io.property_id,
      action_type: String(act.type ?? "unknown"),
      decision,
      decided_by: uid,
      decided_at,
      action_snapshot: act,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, decided_at };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

const COLS =
  "id,altitude_level,entity_type,entity_id,property_id,signal_type,severity,confidence," +
  "evidence,causal_hypothesis,forecast_impact,recommended_actions,visual_anchor,status," +
  "observed_at,expires_at,raw_jsonb";

export async function fetchIntelligenceObjects(): Promise<IntelligenceObject[]> {
  try {
    const { data, error } = await supabase
      .from("intelligence_objects")
      .select(COLS)
      .eq("status", "active")
      .order("observed_at", { ascending: false })
      .limit(200);
    if (error) return [];
    return (data ?? []) as unknown as IntelligenceObject[];
  } catch {
    return [];
  }
}

const SAMPLE: SpatialIntelligence = { source: "sample", nodes: NODES, objects: [] };

export type IntelligenceState = SpatialIntelligence & {
  loading: boolean;
  decisions: DecisionMap;
  decide: (io: IntelligenceObject, d: IoDecision["decision"]) => Promise<{ ok: boolean; error?: string }>;
};

// Defaults to SAMPLE immediately, then upgrades to LIVE once the tenant's IOs load.
// Any auth/network gap (or an empty world model) stays on the labeled SAMPLE path.
export function useSpatialIntelligence(): IntelligenceState {
  const [state, setState] = useState<SpatialIntelligence & { loading: boolean }>({
    ...SAMPLE,
    loading: true,
  });
  const [decisions, setDecisions] = useState<DecisionMap>({});
  useEffect(() => {
    let alive = true;
    fetchIntelligenceObjects()
      .then(async (ios) => {
        if (!alive) return;
        setState({ ...selectIntelligence(ios, NODES), loading: false });
        const map = await fetchDecisions(ios.map((io) => io.id));
        if (alive) setDecisions(map);
      })
      .catch(() => {
        if (alive) setState({ ...SAMPLE, loading: false });
      });
    return () => {
      alive = false;
    };
  }, []);
  const decide = async (io: IntelligenceObject, d: IoDecision["decision"]) => {
    const res = await recordDecision(io, d);
    if (res.ok) setDecisions((m) => ({ ...m, [io.id]: { decision: d, decided_at: res.decided_at } }));
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  };
  return { ...state, decisions, decide };
}