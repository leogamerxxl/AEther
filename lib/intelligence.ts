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

// Defaults to SAMPLE immediately, then upgrades to LIVE once the tenant's IOs load.
// Any auth/network gap (or an empty world model) stays on the labeled SAMPLE path.
export function useSpatialIntelligence(): SpatialIntelligence & { loading: boolean } {
  const [state, setState] = useState<SpatialIntelligence & { loading: boolean }>({
    ...SAMPLE,
    loading: true,
  });
  useEffect(() => {
    let alive = true;
    fetchIntelligenceObjects()
      .then((ios) => {
        if (alive) setState({ ...selectIntelligence(ios, NODES), loading: false });
      })
      .catch(() => {
        if (alive) setState({ ...SAMPLE, loading: false });
      });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}