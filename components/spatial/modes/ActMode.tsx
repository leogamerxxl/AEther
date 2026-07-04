"use client";
// ActMode - the decision ledger: every accept/dismiss the owner recorded, and
// what the market said afterwards (outcomes). This is the 8th question as a
// surface: decided -> measured -> verdict. Click a row to reopen the full IO.

import { useMemo } from "react";
import { C } from "@/lib/command-theme";
import type { IntelligenceObject } from "@/lib/intelligence-map";
import { useDecisionLedger, relTime, roDate, signalLabel, type DecisionEntry, type Verdict } from "@/lib/mode-data";
import ModePane, { PaneCard, PaneEmpty, PaneSkeleton } from "./ModePane";

const VERDICT: Record<Verdict, { label: string; color: string }> = {
  supported:    { label: "validat de piata", color: C.up },
  contradicted: { label: "contrazis de piata", color: C.down },
  inconclusive: { label: "neconcludent", color: C.idle },
};

function verdictChip(e: DecisionEntry): { label: string; color: string; pulse: boolean } {
  if (e.verdict) return { ...VERDICT[e.verdict], pulse: false };
  if (e.decision === "accepted") return { label: "in evaluare", color: C.live, pulse: true };
  return { label: "fara masurare", color: C.idle, pulse: false };
}

function stayDate(io: IntelligenceObject | null): string | null {
  const d = (io?.raw_jsonb as Record<string, unknown> | undefined)?.stay_date;
  return typeof d === "string" ? d : null;
}

export default function ActMode({ onPick, onClose }: {
  onPick: (io: IntelligenceObject) => void; onClose: () => void;
}) {
  const { loading, error, data } = useDecisionLedger();
  const counts = useMemo(() => ({
    accepted: data.filter((e) => e.decision === "accepted").length,
    dismissed: data.filter((e) => e.decision === "dismissed").length,
    supported: data.filter((e) => e.verdict === "supported").length,
    contradicted: data.filter((e) => e.verdict === "contradicted").length,
    pending: data.filter((e) => e.decision === "accepted" && !e.verdict).length,
  }), [data]);

  return (
    <ModePane title="Decizii" subtitle="fiecare decizie, masurata apoi contra pietei" onClose={onClose}>
      {loading ? <PaneSkeleton /> : error ? (
        <PaneEmpty>Nu am putut citi registrul de decizii: {error}</PaneEmpty>
      ) : data.length === 0 ? (
        <PaneEmpty>Nicio decizie inregistrata inca. Accepta sau respinge o recomandare din harta - apare aici, apoi piata o valideaza.</PaneEmpty>
      ) : (
        <>
          <PaneCard className="mb-3 flex items-center justify-around py-2.5">
            {[
              { n: counts.accepted, l: "acceptate", c: C.money },
              { n: counts.dismissed, l: "respinse", c: C.idle },
              { n: counts.supported, l: "validate", c: C.up },
              { n: counts.contradicted, l: "contrazise", c: C.down },
              { n: counts.pending, l: "in evaluare", c: C.live },
            ].map((s) => (
              <div key={s.l} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: s.n > 0 ? s.c : "rgba(255,255,255,.18)" }} />
                <span className="num text-[18px] font-light tabular-nums" style={{ color: s.n > 0 ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.35)" }}>{s.n}</span>
                <span className="text-[10px] text-white/45">{s.l}</span>
              </div>
            ))}
          </PaneCard>
          <div className="flex flex-col gap-1.5">
            {data.map((e) => {
              const chip = verdictChip(e);
              const stay = stayDate(e.io);
              return (
                <button key={e.id} onClick={() => e.io && onPick(e.io)} disabled={!e.io}
                  className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-3 text-left transition-colors duration-200 hover:bg-white/[.04] disabled:cursor-default disabled:hover:bg-white/[.02]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: e.decision === "accepted" ? C.money : C.idle }} />
                        <span className="truncate text-[12.5px] text-white/90">
                          {e.io ? signalLabel(e.io.signal_type) : e.action_type}{stay ? " - noaptea " + roDate(stay) : ""}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40">
                        <span className="rounded-[6px] border border-white/[.08] px-1.5 py-0.5 font-mono">{e.action_type}</span>
                        <span>{e.decision === "accepted" ? "acceptata" : "respinsa"}</span>
                        <span className="tabular-nums">{relTime(e.decided_at)} in urma</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="flex items-center justify-end gap-1.5 text-[11px]" style={{ color: chip.color }}>
                        <span className={chip.pulse ? "size-1.5 animate-pulse rounded-full" : "size-1.5 rounded-full"} style={{ background: chip.color }} />
                        {chip.label}
                      </span>
                      {e.compression_delta != null ? (
                        <div className="mt-1 text-[10px] tabular-nums text-white/45">
                          compresie {e.compression_delta > 0 ? "+" : ""}{(e.compression_delta * 100).toFixed(1)} pp
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </ModePane>
  );
}