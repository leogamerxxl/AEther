"use client";
// The single intelligence provider. It performs the ONE fetch of the world model's
// Intelligence Objects (via the read layer) and exposes { source, objects, nodes,
// loading } to every spatial view through context. Build Plan section 2: no view
// fetches or derives on its own - they read from here.

import { createContext, useContext, type ReactNode } from "react";
import { useSpatialIntelligence, type IntelligenceState } from "@/lib/intelligence";
import { NODES } from "@/lib/spatial-data";

type IntelligenceValue = IntelligenceState;

const IntelligenceContext = createContext<IntelligenceValue | null>(null);

// Used when a consumer renders OUTSIDE the provider (e.g. the /showcase design
// route). Honest SAMPLE - no fetch, labeled by the consuming UI.
const SAMPLE_DEFAULT: IntelligenceValue = {
  source: "sample", nodes: NODES, objects: [], loading: false, decisions: {},
  decide: async () => ({ ok: false, error: "sample mode" }),
};

export function SpatialIntelligenceProvider({ children }: { children: ReactNode }) {
  const value = useSpatialIntelligence();
  return <IntelligenceContext.Provider value={value}>{children}</IntelligenceContext.Provider>;
}

// Inside the provider: the tenant's live intelligence. Outside it (e.g. /showcase):
// labeled SAMPLE. Either way, no component fetches or derives on its own.
export function useIntelligence(): IntelligenceValue {
  return useContext(IntelligenceContext) ?? SAMPLE_DEFAULT;
}