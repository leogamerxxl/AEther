"use client";
// AssetPanel - the REAL competitor glance (replaces the fabricated English
// AssetDashboard / OperationsConsole). Shows only what we actually scraped:
// tonight's availability state, rate, delta vs the market median, rooms left.
// Honest about the gap: we do NOT have competitors' internal occupancy / RevPAR,
// so we say so rather than invent it. Romanian, command-theme colors only.

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { C } from "@/lib/command-theme";
import { PACE_COLORS } from "@/lib/property-extrusions";
import { SPRING, TRANSITION } from "@/lib/motion";
import type { PropertyIntelligenceNode } from "@/types/spatial";

const ron = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

export interface AssetLive { sold: boolean; rate: number | null; rooms: number | null }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[11px] uppercase tracking-[.1em] text-white/35">{label}</span>
      <span className="text-right text-[13px] tabular-nums text-white/80">{children}</span>
    </div>
  );
}

export default function AssetPanel({ node, live, median, monitored, onClose }: {
  node: PropertyIntelligenceNode;
  live: AssetLive | null;
  median: number | null;
  monitored: boolean;
  onClose: () => void;
}) {
  const rate = live?.rate ?? null;
  const delta = rate != null && median != null ? Math.round(rate - median) : null;
  const state = live?.sold ? "epuizat" : live ? "disponibil" : "fara date diseara";
  const stateColor = live?.sold ? PACE_COLORS.balanced : live ? C.live : C.idle;

  return (
    <>
      <motion.div className="fixed inset-0 z-[88] bg-black/50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={TRANSITION.quick} onClick={onClose} />
      <motion.aside
        className="gx gx-matte fixed right-0 top-0 z-[90] flex h-[100dvh] w-full max-w-[400px] flex-col gap-4 overflow-y-auto rounded-none p-5"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={SPRING}
        role="dialog" aria-label="Detaliu proprietate">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: stateColor, boxShadow: `0 0 8px ${stateColor}` }} />
              <span className="text-[16px] font-semibold text-white">{node.name}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[.1em] text-white/40">
              <span>{node.city}</span>
              {monitored ? (
                <span className="flex items-center gap-1" style={{ color: C.live }}>
                  <span className="size-1.5 animate-pulse rounded-full" style={{ background: C.live }} /> monitorizat activ
                </span>
              ) : null}
            </div>
          </div>
          <button onClick={onClose} aria-label="Inchide" className="rounded-md p-1.5 text-white/40 transition-colors duration-200 hover:text-white/80">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[10px] border border-white/[.06] bg-white/[.02] px-3 py-2.5">
            <div className="text-[9px] font-semibold uppercase tracking-[.12em] text-white/40">Stare diseara</div>
            <div className="mt-1 text-[15px] font-medium" style={{ color: stateColor }}>{state}</div>
          </div>
          <div className="rounded-[10px] border border-white/[.06] bg-white/[.02] px-3 py-2.5">
            <div className="text-[9px] font-semibold uppercase tracking-[.12em] text-white/40">Camere ramase</div>
            <div className="mt-1 text-[15px] font-medium tabular-nums text-white/85">
              {live?.rooms != null ? live.rooms : "-"}
            </div>
          </div>
        </div>

        <div className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-3">
          <Row label="Tarif diseara">{rate != null ? `${ron.format(rate)} RON` : "fara pret"}</Row>
          <Row label="Median piata">{median != null ? `${ron.format(median)} RON` : "-"}</Row>
          <Row label="Fata de median">
            {delta != null ? (
              <span style={{ color: delta > 0 ? C.money : delta < 0 ? PACE_COLORS.balanced : C.idle }}>
                {delta > 0 ? "+" : ""}{ron.format(delta)} RON
              </span>
            ) : "-"}
          </Row>
        </div>

        <p className="mt-auto rounded-[10px] border border-white/[.06] bg-white/[.02] p-3 text-[11.5px] leading-relaxed text-white/45">
          Date din setul competitiv scrapuit (Booking via Apify). Gradul de ocupare, RevPAR-ul si
          impactul social intern al concurentilor nu sunt observabile public - nu le estimam.
        </p>
      </motion.aside>
    </>
  );
}