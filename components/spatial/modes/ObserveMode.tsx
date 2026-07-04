"use client";
// ObserveMode - "is the system healthy?" The morning loop rendered as the
// sequence it actually is: collect -> validate -> signals -> verdicts ->
// ontology -> brief -> send. One connected flow, ops truth per stage:
// green only when the run succeeded, red only on a real failure.

import { useMemo } from "react";
import { C } from "@/lib/command-theme";
import { usePipelineHealth, relTime, stageIndex, stageLabel, type AgentHealth } from "@/lib/mode-data";
import ModePane, { PaneCard, PaneEmpty, PaneLabel, PaneSkeleton } from "./ModePane";

const GOOD = new Set(["ok", "succeeded"]);

function statusColor(a: AgentHealth): string {
  if (a.last_status === "failed") return C.crit;
  if (a.missed_schedule || a.last_status === "degraded") return C.warn;
  if (GOOD.has(a.last_status ?? "")) return C.up;
  return C.idle;
}

function statusLabel(a: AgentHealth): string {
  if (a.last_status === "failed") return "esuat";
  if (a.missed_schedule) return "peste program";
  if (a.last_status === "degraded") return "degradat";
  if (GOOD.has(a.last_status ?? "")) return "ok";
  return a.last_status ?? "-";
}

export default function ObserveMode({ onClose }: { onClose: () => void }) {
  const { loading, error, data } = usePipelineHealth();
  const agents = useMemo(() => [...data].sort((a, b) =>
    stageIndex(a.agent_code) - stageIndex(b.agent_code) || a.agent_code.localeCompare(b.agent_code)
  ), [data]);
  const streak = data[0]?.brief_streak_days ?? 0;
  const okCount = agents.filter((a) => GOOD.has(a.last_status ?? "") && !a.missed_schedule).length;
  const attention = agents.length - okCount;

  return (
    <ModePane title="Observa" subtitle="starea sistemului - agent_runs / daily_briefs" onClose={onClose}>
      {loading ? <PaneSkeleton /> : error ? (
        <PaneEmpty>Nu am putut citi starea sistemului: {error}</PaneEmpty>
      ) : agents.length === 0 ? (
        <PaneEmpty>Niciun agent nu a rulat inca.</PaneEmpty>
      ) : (
        <>
          {/* one counter strip - same grammar as the feed's severity row */}
          <PaneCard className="mb-4 flex items-center justify-around py-2.5">
            {[
              { n: streak, l: "zile consecutive cu brief", c: streak > 0 ? C.up : C.idle },
              { n: okCount, l: `agenti sanatosi / ${agents.length}`, c: C.up },
              { n: attention, l: "necesita atentie", c: attention > 0 ? C.warn : C.idle },
            ].map((s) => (
              <div key={s.l} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: s.c }} />
                <span className="num text-[20px] font-light tabular-nums text-white/90">{s.n}</span>
                <span className="text-[10px] text-white/45">{s.l}</span>
              </div>
            ))}
          </PaneCard>

          <PaneLabel>Bucla de dimineata, in ordinea executiei</PaneLabel>
          <ol className="mt-2">
            {agents.map((a, i) => {
              const col = statusColor(a);
              const label = stageLabel(a.agent_code);
              const last = i === agents.length - 1;
              return (
                <li key={a.agent_code} className="grid grid-cols-[14px_1fr] gap-x-3">
                  {/* flow rail: stage dot + connector to the next stage */}
                  <div className="flex flex-col items-center">
                    <span className="mt-[7px] size-2 shrink-0 rounded-full"
                          style={{ background: col, boxShadow: `0 0 6px ${col}` }} />
                    {!last ? <span className="w-px flex-1 bg-white/[.08]" /> : null}
                  </div>
                  <div className={"flex items-baseline justify-between gap-3 " + (last ? "pb-1" : "pb-4")}>
                    <div className="min-w-0">
                      <div className="text-[13px] text-white/90">{label ?? a.agent_code}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-white/35">{a.agent_code}</div>
                      {a.last_status === "failed" && a.last_error ? (
                        <div className="mt-1 line-clamp-2 font-mono text-[10px] leading-relaxed" style={{ color: C.down }}>
                          {a.last_error}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-baseline gap-2.5">
                      <span className="text-[11px] tabular-nums text-white/45">{relTime(a.last_run_at)} in urma</span>
                      <span className="text-[11px] font-medium" style={{ color: col }}>{statusLabel(a)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </ModePane>
  );
}