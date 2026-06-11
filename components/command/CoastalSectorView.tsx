"use client";

// CoastalSectorView - the sector monitor: the tilted glowing sector map plus
// floating glass intelligence panels overlaid (demand-index ring, per-sector
// occupancy bars, selected-sector metrics) - the UXP smart-city look for the
// Romanian coast (Mamaia / Eforie / Costinesti / Olimp / Neptun).

import { useState } from "react";
import { CoastalSectorMap } from "./CoastalSectorMap";
import { RingGauge } from "./RingGauge";
import { CommandPanel, MetricReadout, SmartSuggestion } from "./primitives";
import { COAST_SECTORS, SECTOR_COLORS } from "@/lib/coast-sectors";
import { cn } from "@/lib/utils";

const mean = (a: number[]) => Math.round(a.reduce((s, v) => s + v, 0) / a.length);
function indexColor(v: number) { return v >= 70 ? SECTOR_COLORS.high.color : v >= 50 ? SECTOR_COLORS.medium.color : SECTOR_COLORS.calm.color; }

function SectorBars({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex h-16 items-end gap-2">
      {COAST_SECTORS.map((s) => {
        const c = SECTOR_COLORS[s.level];
        const active = selected === s.id;
        return (
          <button key={s.id} onClick={() => onSelect(s.id)} className="flex flex-1 cursor-pointer flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end">
              <div className="w-full rounded-[3px] transition-all" style={{ height: `${s.occupancy}%`, background: c.color, opacity: active ? 1 : 0.6, boxShadow: active ? `0 0 10px ${c.color}` : "none" }} />
            </div>
            <span className={cn("text-[8.5px]", active ? "text-white/80" : "text-white/40")}>{s.name.slice(0, 3)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CoastalSectorView() {
  const [selected, setSelected] = useState<string>("neptun");
  const sel = COAST_SECTORS.find((s) => s.id === selected) ?? COAST_SECTORS[0];
  const selC = SECTOR_COLORS[sel.level];
  const avgDemand = mean(COAST_SECTORS.map((s) => s.demandIndex));
  const avgOcc = mean(COAST_SECTORS.map((s) => s.occupancy));

  return (
    <div className="atmos relative min-h-[640px] overflow-hidden rounded-3xl px-6 py-8 sm:px-8">
      {/* Map */}
      <div className="mx-auto mt-2 max-w-[900px]">
        <CoastalSectorMap selected={selected} onSelect={setSelected} />
      </div>

      {/* Intro text (left) */}
      <div className="pointer-events-none absolute left-6 top-7 max-w-[290px] sm:left-8">
        <div className="text-[11px] font-medium uppercase tracking-[.18em] text-cyan-300/70">Coastal corridor</div>
        <h3 className="mt-1.5 text-[24px] font-semibold tracking-[-.02em] text-white">Sector Monitor</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-white/50">Live demand, occupancy and rate pressure across the Mamaia&ndash;Neptun corridor, aggregated per resort.</p>
      </div>

      {/* Floating intelligence panels (bottom-right) */}
      <div className="absolute bottom-7 right-6 flex w-[330px] flex-col gap-3 sm:right-8">
        <CommandPanel title="Coastal demand" eyebrow="Aggregate" status={{ level: "live", label: "Live" }} motif="radar">
          <div className="flex items-center gap-4">
            <RingGauge value={avgDemand} sub="INDEX" label="Demand" color={indexColor(avgDemand)} size={118} />
            <div className="flex-1">
              <div className="text-[28px] font-semibold leading-none tabular-nums text-white">{avgOcc}<span className="text-[13px] font-normal text-white/40">% occ</span></div>
              <div className="mt-3 flex flex-col gap-1.5">
                {(["high", "medium", "calm"] as const).map((lvl) => (
                  <div key={lvl} className="flex items-center gap-2 text-[11px] text-white/55">
                    <span className="size-2 rounded-sm" style={{ background: SECTOR_COLORS[lvl].color }} /> {SECTOR_COLORS[lvl].label}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-white/[.06] pt-3">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[.14em] text-white/40">Occupancy by sector</div>
            <SectorBars selected={selected} onSelect={setSelected} />
          </div>
        </CommandPanel>

        <div className="grid grid-cols-2 gap-3">
          <MetricReadout label={`${sel.name} occ`} value={String(sel.occupancy)} unit="%" tone="up" motif="occupancy" />
          <MetricReadout label={`${sel.name} ADR`} value={String(sel.adr)} unit=" RON" tone="money" motif="trend" />
        </div>

        <SmartSuggestion text={sel.level === "high" ? `Lift ${sel.name} weekend ADR - demand is hot` : sel.level === "calm" ? `Bundle ${sel.name} spa - demand is soft` : `Hold ${sel.name} rate, monitor pace`} confidencePct={sel.demandIndex} accent={selC.color} onApply={() => {}} />
      </div>
    </div>
  );
}
