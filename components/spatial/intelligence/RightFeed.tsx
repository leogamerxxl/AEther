"use client";
// RightFeed - the intelligence feed column (right edge): severity counter row +
// the live intelligence objects as compact alert cards. Click -> evidence drawer.
// Harbor tint ONLY on actionable (undecided rec) cards; the rest stay neutral.

import { useMemo } from "react";
import { motion } from "framer-motion";
import { C } from "@/lib/command-theme";
import { TRANSITION } from "@/lib/motion";
import { ioFreshness, type IntelligenceObject } from "@/lib/intelligence-map";
import { useIntelligence } from "./SpatialIntelligenceProvider";

function relTime(iso?: string | null): string {
  if (!iso) return "-";
  const h = (Date.now() - Date.parse(iso)) / 3.6e6;
  if (h < 1) return Math.max(1, Math.round(h * 60)) + "m";
  return Math.round(h) + "h";
}

export default function RightFeed({ onPick }: { onPick: (io: IntelligenceObject) => void }) {
  const { objects, decisions, loading, source } = useIntelligence();
  const fresh = useMemo(() => objects
    .filter((io) => ioFreshness(io) !== "dead")
    .sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at))), [objects]);
  const actionable = fresh.filter((io) => (io.recommended_actions ?? []).length > 0 && !decisions[io.id]);
  const decided = fresh.filter((io) => !!decisions[io.id]);
  const informational = fresh.filter((io) => (io.recommended_actions ?? []).length === 0);
  const cards = [...actionable, ...informational].slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={TRANSITION.standard}
      className="fixed right-4 top-16 z-[80] hidden w-[252px] flex-col gap-2 lg:flex">
      {/* severity counters */}
      <div className="gx gx-matte flex items-center justify-around rounded-[14px] px-2 py-2">
        {[{ n: actionable.length, l: "actiuni", c: C.money },
          { n: informational.length, l: "semnale", c: C.live },
          { n: decided.length, l: "decise", c: C.idle }].map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: s.c }} />
            <span className="num text-[16px] font-light text-white/90">{s.n}</span>
            <span className="text-[9px] text-white/40">{s.l}</span>
          </div>
        ))}
      </div>
      {/* alert cards */}
      {loading ? (
        <div className="gx gx-matte rounded-[14px] p-3"><div className="h-3 w-3/4 animate-pulse rounded-[4px] bg-white/[.06]" /></div>
      ) : cards.length === 0 ? (
        <div className="gx gx-matte rounded-[14px] p-3 text-[11px] text-white/45">
          {source === "live" ? "Fara semnale active." : "DEMO - fara semnale."}
        </div>
      ) : cards.map((io) => {
        const rec = (io.recommended_actions ?? []).length > 0 && !decisions[io.id];
        const title = rec ? String(io.recommended_actions?.[0]?.label ?? io.signal_type)
          : io.signal_type === "weather_demand_outlook" ? "Perspectiva meteo" : io.causal_hypothesis ?? io.signal_type;
        return (
          <button key={io.id} onClick={() => onPick(io)}
            className="gx gx-matte rounded-[14px] p-2.5 text-left transition-transform duration-200 hover:-translate-x-0.5"
            style={rec ? { borderColor: C.moneySoft } : undefined}>
            <div className="flex items-start gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: rec ? C.money : C.live }} />
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[11px] leading-snug text-white/85">{title}</div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-white/35">
                  <span className="uppercase tracking-[.08em]">{rec ? "actiune" : "semnal"} - {io.severity}</span>
                  <span className="tabular-nums">{relTime(io.observed_at)}</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}