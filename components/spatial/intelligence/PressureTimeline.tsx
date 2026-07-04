"use client";
// PressureTimeline - the bottom time band: the next 7 nights as cells (date,
// median, compression bar). Harbor cell = actionable night. Click -> drawer.

import { useMemo } from "react";
import { motion } from "framer-motion";
import { C } from "@/lib/command-theme";
import { TRANSITION } from "@/lib/motion";
import { ioFreshness, type IntelligenceObject } from "@/lib/intelligence-map";
import { useIntelligence } from "./SpatialIntelligenceProvider";

const ron = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const ddmm = (d?: string) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : "-");

export default function PressureTimeline({ onPick }: { onPick: (io: IntelligenceObject) => void }) {
  const { objects, decisions } = useIntelligence();
  const market = useMemo(() => objects
    .filter((io) => io.signal_type === "market_rate_pressure" && ioFreshness(io) !== "dead")
    .sort((a, b) => String(a.raw_jsonb?.stay_date).localeCompare(String(b.raw_jsonb?.stay_date)))
    .slice(0, 7), [objects]);
  if (market.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={TRANSITION.standard}
      className="gx gx-matte fixed bottom-4 left-1/2 z-[78] hidden -translate-x-1/2 items-stretch gap-1 rounded-[16px] p-1.5 lg:flex">
      {market.map((io) => {
        const raw = io.raw_jsonb as Record<string, unknown>;
        const cmp = raw?.compression != null ? Math.round(Number(raw.compression) * 100) : 0;
        const rec = (io.recommended_actions ?? []).length > 0 && !decisions[io.id];
        return (
          <button key={io.id} onClick={() => onPick(io)}
            className="flex w-[86px] flex-col gap-1 rounded-[10px] px-2 py-1.5 text-left transition-colors duration-200 hover:bg-white/[.05]"
            style={rec ? { background: C.moneySoft } : undefined}
            aria-label={`Noaptea ${ddmm(String(raw?.stay_date))}`}>
            <div className="flex items-baseline justify-between">
              <span className="text-[9.5px] uppercase tracking-[.06em] text-white/45">{ddmm(String(raw?.stay_date))}</span>
              <span className="num text-[10px]" style={{ color: cmp >= 50 ? C.money : "rgba(255,255,255,0.5)" }}>{cmp}%</span>
            </div>
            <div className="num text-[13px] font-light leading-none text-white/85">
              {raw?.median_adr_ron != null ? `${ron.format(Number(raw.median_adr_ron))}` : "epuizat"}
              {raw?.median_adr_ron != null ? <span className="ml-0.5 text-[8px] text-white/35">RON</span> : null}
            </div>
            <div className="h-[3px] w-full overflow-hidden rounded-[2px] bg-white/[.07]">
              <div className="h-full rounded-[2px]" style={{ width: `${cmp}%`, background: rec ? C.money : C.live, opacity: 0.85 }} />
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}