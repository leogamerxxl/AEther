"use client";
// MapPulseChip - the floating contextual reading over the world: tonight''s
// sell-out compression, from the real market IO. Glance-level, one number.

import { useMemo } from "react";
import { motion } from "framer-motion";
import { C } from "@/lib/command-theme";
import { TRANSITION } from "@/lib/motion";
import { ioFreshness } from "@/lib/intelligence-map";
import { useIntelligence } from "./SpatialIntelligenceProvider";

export default function MapPulseChip() {
  const { objects, source } = useIntelligence();
  const latest = useMemo(() => objects
    .filter((io) => io.signal_type === "market_rate_pressure" && ioFreshness(io) !== "dead")
    .sort((a, b) => String(a.raw_jsonb?.stay_date).localeCompare(String(b.raw_jsonb?.stay_date)))[0],
    [objects]);
  const raw = latest?.raw_jsonb as Record<string, unknown> | undefined;
  if (source !== "live" || raw?.compression == null) return null;
  const cmp = Math.round(Number(raw.compression) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION.standard}
      className="gx gx-matte pointer-events-none rounded-[20px] px-4 py-3"
    >
      <div className="text-[10px] uppercase tracking-[.12em] text-white/40">Compresie diseara</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="num text-[26px] font-light leading-none text-white/95">{cmp}</span>
        <span className="text-[13px]" style={{ color: cmp >= 50 ? C.money : C.live }}>%</span>
      </div>
      <div className="mt-0.5 text-[10px] tabular-nums text-white/40">{String(raw.soldout_count)}/{String(raw.urlset_size)} hoteluri pline</div>
    </motion.div>
  );
}