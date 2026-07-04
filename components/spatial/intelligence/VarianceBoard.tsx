"use client";
// VarianceBoard - bottom-right rate-variance table: each priced competitor's delta
// against tonight's market median (the schedule-offset analog, but for money).
// Harbor marks above-median outliers; sold-out comps show as "-". Real comps data.

import { useMemo } from "react";
import { C } from "@/lib/command-theme";
import { ioFreshness, type IntelligenceObject } from "@/lib/intelligence-map";
import { useIntelligence } from "./SpatialIntelligenceProvider";

type CompRow = { name?: string | null; rate_ron?: number | null; availability_state?: string | null };
const ron = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

export default function VarianceBoard() {
  const { objects } = useIntelligence();
  const latest = useMemo(() => objects
    .filter((io) => io.signal_type === "market_rate_pressure" && ioFreshness(io) !== "dead")
    .sort((a, b) => String(a.raw_jsonb?.stay_date).localeCompare(String(b.raw_jsonb?.stay_date)))[0] as IntelligenceObject | undefined,
    [objects]);
  const raw = latest?.raw_jsonb as Record<string, unknown> | undefined;
  const median = raw?.median_adr_ron != null ? Number(raw.median_adr_ron) : null;
  const comps = ((raw?.comps as CompRow[] | undefined) ?? [])
    .filter((c) => c.availability_state !== "sold_out" && c.rate_ron != null && median != null)
    .map((c) => ({ name: c.name ?? "hotel", delta: Math.round((c.rate_ron as number) - (median as number)) }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);
  if (!latest || median == null || comps.length === 0) return null;
  const avg = Math.round(comps.reduce((s, c) => s + Math.abs(c.delta), 0) / comps.length);

  return (
    <div className="gx gx-bento fixed bottom-4 right-16 z-[78] hidden w-[300px] flex-col rounded-[20px] p-3 lg:flex">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-white/40">Variatie tarife</span>
        <span className="num text-[16px] font-light text-white/85">± {ron.format(avg)} <span className="text-[10px] text-white/40">RON fata de median</span></span>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {comps.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-28 truncate text-[10.5px] text-white/55" title={c.name}>{c.name}</span>
            <div className="relative h-1 flex-1 rounded-[2px] bg-white/[.06]">
              <div className="absolute top-0 h-1 rounded-[2px]"
                   style={{
                     left: c.delta >= 0 ? "50%" : `${50 - Math.min(50, (Math.abs(c.delta) / (avg * 2)) * 50)}%`,
                     width: `${Math.min(50, (Math.abs(c.delta) / (avg * 2)) * 50)}%`,
                     background: c.delta > 0 ? C.money : C.live, opacity: 0.75,
                   }} />
            </div>
            <span className="w-16 text-right text-[10.5px] tabular-nums" style={c.delta > 0 ? { color: C.money } : { color: "rgba(255,255,255,0.6)" }}>
              {c.delta > 0 ? "+" : ""}{ron.format(c.delta)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}