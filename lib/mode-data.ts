"use client";
// Aether - mode data layer: read-only fetchers for the world's non-map modes.
//
//   Observe  <- pipeline_health          (last run per agent, missed flag, brief streak)
//   Brief    <- daily_briefs             (RLS tenant-scoped; rendered_html lazy per brief)
//   Act      <- io_actions + outcomes    (the decision ledger, joined to its IOs)
//
// No intelligence is computed here - every row is the world model's own record.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { IntelligenceObject } from "@/lib/intelligence-map";

export type WorldMode = "observe" | "brief" | "map" | "simulate" | "act";
export const MODES: { id: WorldMode; label: string }[] = [
  { id: "observe", label: "Observa" },
  { id: "brief", label: "Brief" },
  { id: "map", label: "Harta" },
  { id: "simulate", label: "Simulare" },
  { id: "act", label: "Decizii" },
];

export type Loadable<T> = { loading: boolean; error: string | null; data: T };

function useLoadable<T>(fetcher: () => Promise<T>, empty: T): Loadable<T> {
  const [s, setS] = useState<Loadable<T>>({ loading: true, error: null, data: empty });
  useEffect(() => {
    let alive = true;
    fetcher()
      .then((data) => { if (alive) setS({ loading: false, error: null, data }); })
      .catch((e: unknown) => {
        if (alive) setS({ loading: false, error: e instanceof Error ? e.message : String(e), data: empty });
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return s;
}

/** Relative hours/minutes since an ISO timestamp - shared by mode surfaces. */
export function relTime(iso?: string | null): string {
  if (!iso) return "-";
  const h = (Date.now() - Date.parse(iso)) / 3.6e6;
  if (h < 1) return Math.max(1, Math.round(h * 60)) + "m";
  if (h < 48) return Math.round(h) + "h";
  return Math.round(h / 24) + "z";
}

const RO_DATE = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long" });
export function roDate(iso?: string | null): string {
  return iso ? RO_DATE.format(new Date(iso + (iso.length === 10 ? "T00:00:00" : ""))) : "-";
}

// Owner-language labels for signal types - raw codes stay in provenance only.
export const SIGNAL_LABELS: Record<string, string> = {
  market_rate_pressure: "Presiune pe tarifele pietei",
  weather_demand_outlook: "Perspectiva meteo a cererii",
  fx_affordability_shift: "Curs valutar - accesibilitate",
};
export function signalLabel(t?: string | null): string {
  return (t && SIGNAL_LABELS[t]) || t || "semnal";
}

// The morning loop, in execution order - Observe renders the pipeline as the
// sequence it actually is, not an alphabetical card dump.
const PIPELINE_STAGES: { match: RegExp; label: string }[] = [
  { match: /^collector\.booking_rates/, label: "Colectare tarife concurenta" },
  { match: /^collector\.weather/, label: "Colectare meteo" },
  { match: /^collector\.bnr_fx/, label: "Colectare curs BNR" },
  { match: /^collector\.otb/, label: "Colectare ocupare proprie" },
  { match: /^validator/, label: "Validare date" },
  { match: /^signal_engine/, label: "Semnale - presiunea pietei" },
  { match: /^signal_weather/, label: "Semnale - meteo" },
  { match: /^signal_fx/, label: "Semnale - curs valutar" },
  { match: /^outcome_engine/, label: "Verdicte - a functionat?" },
  { match: /^ontology_sync/, label: "Ontologie - graful lumii" },
  { match: /^brief/, label: "Generare brief" },
  { match: /^mail/, label: "Trimitere email" },
];
export function stageIndex(code: string): number {
  const i = PIPELINE_STAGES.findIndex((s) => s.match.test(code));
  return i === -1 ? PIPELINE_STAGES.length : i;
}
export function stageLabel(code: string): string | null {
  return PIPELINE_STAGES.find((s) => s.match.test(code))?.label ?? null;
}

// ---------------- Observe: pipeline_health ----------------

export interface AgentHealth {
  agent_code: string;
  last_status: string | null;
  last_run_at: string | null;
  last_error: string | null;
  missed_schedule: boolean | null;
  brief_streak_days: number | null;
}

export async function fetchPipelineHealth(): Promise<AgentHealth[]> {
  const { data, error } = await supabase.from("pipeline_health").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentHealth[];
}
export const usePipelineHealth = () => useLoadable(fetchPipelineHealth, [] as AgentHealth[]);

// ---------------- Brief: daily_briefs ----------------

export interface BriefMeta {
  id: string;
  brief_date: string;
  sent_at: string | null;
  opened_at: string | null;
  recipient_count: number | null;
}

export async function fetchBriefList(limit = 14): Promise<BriefMeta[]> {
  const { data, error } = await supabase
    .from("daily_briefs")
    .select("id,brief_date,sent_at,opened_at,recipient_count")
    .order("brief_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as BriefMeta[];
}
export const useBriefList = () => useLoadable(fetchBriefList, [] as BriefMeta[]);

export async function fetchBriefHtml(id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("daily_briefs")
    .select("rendered_html")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.rendered_html as string | null) ?? null;
}

// ---------------- Act: io_actions x outcomes x intelligence_objects ----------------

const IO_COLS =
  "id,altitude_level,entity_type,entity_id,property_id,signal_type,severity,confidence," +
  "evidence,causal_hypothesis,forecast_impact,recommended_actions,visual_anchor,status," +
  "observed_at,expires_at,raw_jsonb";

export type Verdict = "supported" | "contradicted" | "inconclusive";

export interface DecisionEntry {
  id: string;
  io_id: string;
  action_type: string;
  decision: "accepted" | "dismissed";
  decided_at: string;
  verdict: Verdict | null;
  measured_at: string | null;
  compression_delta: number | null;
  io: IntelligenceObject | null;
}

export async function fetchDecisionLedger(): Promise<DecisionEntry[]> {
  const { data: acts, error } = await supabase
    .from("io_actions")
    .select("id,io_id,action_type,decision,decided_at")
    .order("decided_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (acts ?? []) as Pick<DecisionEntry, "id" | "io_id" | "action_type" | "decision" | "decided_at">[];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.io_id))];
  const [ioRes, outRes] = await Promise.all([
    supabase.from("intelligence_objects").select(IO_COLS).in("id", ids),
    supabase.from("outcomes").select("io_id,verdict,measured_at,delta").in("io_id", ids),
  ]);
  const ios = (ioRes.data ?? []) as unknown as IntelligenceObject[];
  const ioMap = new Map(ios.map((io) => [io.id, io]));
  type OutRow = { io_id: string; verdict: Verdict; measured_at: string | null; delta: Record<string, unknown> | null };
  const outMap = new Map(((outRes.data ?? []) as OutRow[]).map((o) => [o.io_id, o]));

  return rows.map((r) => {
    const o = outMap.get(r.io_id);
    const d = o?.delta?.compression_delta;
    return {
      ...r,
      verdict: o?.verdict ?? null,
      measured_at: o?.measured_at ?? null,
      compression_delta: typeof d === "number" ? d : null,
      io: ioMap.get(r.io_id) ?? null,
    };
  });
}
export const useDecisionLedger = () => useLoadable(fetchDecisionLedger, [] as DecisionEntry[]);