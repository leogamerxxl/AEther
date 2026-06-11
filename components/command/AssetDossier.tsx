"use client";

// AssetDossier - the full glass dossier for one property, opened by the asset
// card's expand arrow or its forecast popover. Composes command primitives:
// KPI readouts, weekly forecast, competitor movements, and intel cards.

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Swords } from "lucide-react";
import { CommandPanel, IntelCard, MetricReadout, Delta } from "@/components/command/primitives";
import { HotelLineArt } from "@/components/command/illustrations";
import { NODES } from "@/lib/spatial-data";
import { deriveIntel } from "@/lib/spatial-intel";
import { paceColor } from "@/lib/property-extrusions";
import { weeklyForecast } from "@/lib/asset-forecast";
import { C, ron } from "@/lib/command-theme";

export function AssetDossier({ nodeId, onClose, onLocate }: { nodeId: string | null; onClose: () => void; onLocate?: (id: string) => void }) {
  const node = nodeId ? NODES.find((n) => n.id === nodeId) ?? null : null;

  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  return (
    <AnimatePresence>
      {node ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] grid place-items-center px-4 py-8" style={{ background: "rgba(2,3,5,.7)", backdropFilter: "blur(8px)" }} onMouseDown={onClose}>
          <DossierBody node={node} onClose={onClose} onLocate={onLocate} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DossierBody({ node, onClose, onLocate }: { node: NonNullable<ReturnType<typeof NODES.find>>; onClose: () => void; onLocate?: (id: string) => void }) {
  const i = deriveIntel(node);
  const accent = paceColor(node);
  const occ = i.occupancy, adr = i.adr, revpar = i.revparEst;
  const forecast = weeklyForecast(node.id, occ, adr);
  const fMax = Math.max(...forecast.map((d) => d.occ));
  const up = i.headline.direction !== "down";

  const comps = node.competitors.slice(0, 5).map((c) => ({ name: c.name, delta: Math.round(((c.currentAdrRon - adr) / adr) * 100) }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      onMouseDown={(e) => e.stopPropagation()}
      className="gx-glass flex max-h-[86vh] w-full max-w-[940px] flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-white/[.08] p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.03]" style={{ color: accent }}>
            <HotelLineArt className="h-9 w-12 text-current" />
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-white">{node.name}</h2>
            <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-white/45">
              <MapPin className="size-3.5" /> {node.city} &middot; {node.stars}-star
              {node.isOwn ? <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[.1em]" style={{ background: C.liveSoft, color: C.live }}>Your asset</span> : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onLocate ? <button onClick={() => onLocate(node.id)} className="gx-ghost rounded-lg px-3 py-2 text-[12.5px] font-medium text-white/80 transition-colors hover:text-white">Locate on map</button> : null}
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/[.06] hover:text-white"><X className="size-4.5" /></button>
        </div>
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3 overflow-y-auto p-5 no-scrollbar">
        <div className="col-span-12 grid grid-cols-3 gap-3">
          <MetricReadout label="Occupancy" value={String(occ)} unit="%" delta={{ v: 2.4 }} tone="up" />
          <MetricReadout label="ADR" value={String(adr)} unit=" RON" delta={{ v: i.gapPct, money: true }} tone="money" />
          <MetricReadout label="RevPAR" value={String(revpar)} unit=" RON" delta={{ v: 6.1 }} tone="live" />
        </div>

        {/* Forecast */}
        <CommandPanel className="col-span-12 lg:col-span-7" title="7-day occupancy forecast" eyebrow="Predictions" status={{ level: "live", label: "Live" }}>
          <div className="flex flex-col gap-1.5">
            {forecast.map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <span className={d.today ? "w-9 text-[12px] text-white" : "w-9 text-[12px] text-white/45"}>{d.day}</span>
                <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-white/[.06]">
                  <div className="h-full rounded-full" style={{ width: `${(d.occ / fMax) * 100}%`, background: d.today ? accent : "rgba(255,255,255,.3)" }} />
                </div>
                <span className="w-20 text-right text-[12px] tabular-nums text-white/70">{d.occ}% &middot; {ron(d.adr)}</span>
              </div>
            ))}
          </div>
        </CommandPanel>

        {/* Competitors */}
        <CommandPanel className="col-span-12 lg:col-span-5" title="Competitor movements" eyebrow="The battlefield" actions={<Swords className="size-4 text-white/40" />}>
          <div className="flex flex-col gap-2.5">
            {comps.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-3">
                <span className="truncate text-[13px] text-white/65">{c.name}</span>
                <Delta v={c.delta} money />
              </div>
            ))}
          </div>
        </CommandPanel>

        {/* Intel */}
        <div className="col-span-12 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <IntelCard
            kind={up ? "opportunity" : "recommendation"}
            title={up ? "Headroom to lift ADR" : "Protect midweek pace"}
            signal={i.headline.action}
            forecast={`Booking pace is ${i.pace}; weekend occupancy projects to ${Math.max(...forecast.map((d) => d.occ))}%.`}
            action={up ? "Lift weekend ADR and hold a 2-night minimum." : "Hold rate; push direct value bundles midweek."}
            impact={{ label: "Expected gain", valueRon: Math.round(adr * 0.08 * 32) }}
            confidencePct={i.headline.confidencePct}
            source="Aether revenue model"
          />
          <IntelCard
            kind="risk"
            title="Corridor leakage to Bulgaria"
            signal="Bulgarian 4-star alternatives price ~17% below the corridor in EUR."
            context="Fuel and soft sentiment raise drive-market price sensitivity."
            forecast="Defection probability rises if you hold into the weekend."
            action="Counter with value bundles, not headline discounts."
            impact={{ label: "Demand impact", deltaPct: -5 }}
            confidencePct={78}
            source="Corridor migration model"
          />
        </div>
      </div>
    </motion.div>
  );
}
