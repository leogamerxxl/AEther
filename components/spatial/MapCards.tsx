"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import type { PropertyIntelligenceNode } from "@/types/spatial";
import { deriveIntel, deriveCompetitorIntel } from "@/lib/spatial-intel";
import { Sparkline } from "./charts";

const PACE_DOT: Record<string, string> = { tight: "#5fd0a0", balanced: "#ffffff", soft: "#e6b566" };
const PACE_LABEL: Record<string, string> = { tight: "Demand tight", balanced: "Balanced", soft: "Demand soft" };

function Stars({ n }: { n: number }) {
  return <span className="text-[11px] tracking-[.1em] text-white/30">{"★".repeat(n)}{"☆".repeat(Math.max(0, 5 - n))}</span>;
}
function verbFor(dir: "up" | "down" | "hold") {
  return dir === "up" ? "Raise rate" : dir === "down" ? "Trim rate" : "Hold — aligned to demand";
}

export function HoverChip({ node, x, y }: { node: PropertyIntelligenceNode; x: number; y: number }) {
  const i = deriveIntel(node);
  const ci = node.isOwn ? null : deriveCompetitorIntel(node);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="gx gx-bento pointer-events-none absolute z-40 w-[272px] p-5"
      style={{ left: x, top: y, transform: "translate(-50%, calc(-100% - 22px))" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: PACE_DOT[i.pace] }} />
          <span className="truncate text-[15px] font-semibold tracking-tight text-white">{node.name}</span>
        </div>
        <Stars n={node.stars} />
      </div>
      <div className="mt-5 flex items-stretch gap-6">
        <div>
          <div className="text-[11px] text-white/40">Occupancy</div>
          <div className="mt-1.5 text-[29px] font-semibold leading-none tracking-[-.02em] tabular-nums text-white">{i.occupancy}<span className="text-[14px] text-white/35">%</span></div>
        </div>
        <div>
          <div className="text-[11px] text-white/40">ADR</div>
          <div className="mt-1.5 text-[29px] font-semibold leading-none tracking-[-.02em] tabular-nums text-white">{i.adr}</div>
        </div>
      </div>
      <div className="mt-4 h-7"><Sparkline data={i.trajectory} h={28} /></div>
      <div className="mt-4 border-t border-white/[.06] pt-3.5 text-[12.5px] text-white/80">
        {ci ? <span>Booking pace <span className="tabular-nums text-white">{ci.bookingPaceDeltaPct >= 0 ? "+" : ""}{ci.bookingPaceDeltaPct}%</span> &middot; {ci.bookingPaceLabel}</span> : <span className="font-medium">{verbFor(i.headline.direction)}</span>}
      </div>
    </motion.div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[.12em] text-white/35">{label}</span>
      <span className="text-right text-[13.5px] text-white/85">{children}</span>
    </div>
  );
}

export function PinPopup({ node, x, y, onExpand, onClose, live }: { node: PropertyIntelligenceNode; x: number; y: number; onExpand: () => void; onClose: () => void; live?: { narrative: string; delta: number } | null }) {
  const i = deriveIntel(node);
  const own = node.isOwn;
  const ci = own ? null : deriveCompetitorIntel(node);
  const dir = live ? (live.delta > 0 ? "up" : live.delta < 0 ? "down" : "hold") : i.headline.direction;
  const delta = live ? live.delta : i.headline.deltaRon;
  const W = 392, M = 16;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const cx = Math.min(Math.max(x, W / 2 + M), vw - W / 2 - M);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [popH, setPopH] = useState(own ? 470 : 520);
  useEffect(() => { const el = popRef.current; if (el) setPopH(el.offsetHeight); }, [node.id, own, live]);
  let topPx = y - 26 - popH;
  topPx = Math.max(16, Math.min(topPx, vh - 92 - popH));
  return (
    <motion.div
      ref={popRef}
      initial={{ opacity: 0, y: 16, scale: 0.96, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: 12, scale: 0.97, filter: "blur(6px)" }}
      transition={{ type: "spring", stiffness: 210, damping: 23 }}
      className="gx gx-bento absolute z-40 w-[392px] p-7"
      style={{ left: cx, top: topPx, transform: "translateX(-50%)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[20px] font-semibold tracking-tight text-white">{node.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-white/40">
            <Stars n={node.stars} /><span className="text-white/20">&middot;</span><span>{node.city}</span><span className="text-white/20">&middot;</span><span>{own ? "Your asset" : PACE_LABEL[i.pace]}</span>
            {live ? <span className="flex items-center gap-1 text-white/70"><span className="size-1.5 animate-pulse rounded-full bg-white/70" />Live</span> : null}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="gx-ghost grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-white/70 transition-colors hover:text-white"><X className="size-4" /></button>
      </div>

      {own ? (
        <div>
          <div className="mt-7">
            <div className="text-[11px] font-medium uppercase tracking-[.14em] text-white/35">Recommended move</div>
            <div className="mt-2.5 flex items-end justify-between gap-4">
              <div className="text-[22px] font-semibold leading-tight tracking-[-.02em] text-white">{verbFor(dir)}</div>
              <div className="shrink-0 text-right">
                <div className="text-[24px] font-semibold leading-none tabular-nums text-white">{delta >= 0 ? "+" : ""}{delta}</div>
                <div className="mt-1 text-[10.5px] text-white/35">RON / night</div>
              </div>
            </div>
          </div>
          <div className="mt-7 space-y-4">
            {i.evidence.map((e, idx) => (
              <div key={idx} className="flex gap-3"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-white/30" /><span className="text-[13.5px] leading-relaxed text-white/70">{e}</span></div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-7 space-y-5">
          <InfoRow label="Social reach"><span className="tabular-nums text-white">{ci!.socialReach}</span> &middot; <span className="tabular-nums" style={{ color: ci!.socialGrowthPct >= 0 ? "#5fd0a0" : "#e6b566" }}>{ci!.socialGrowthPct >= 0 ? "+" : ""}{ci!.socialGrowthPct}%</span> WoW</InfoRow>
          <InfoRow label="Sentiment"><span className="tabular-nums text-white">{ci!.sentimentPct}%</span> positive &middot; {ci!.topPlatform}</InfoRow>
          <InfoRow label="Booking pace"><span className="tabular-nums text-white">{ci!.bookingPaceDeltaPct >= 0 ? "+" : ""}{ci!.bookingPaceDeltaPct}%</span> &middot; {ci!.bookingPaceLabel}</InfoRow>
          <InfoRow label="ADR vs you"><span className="tabular-nums text-white">{i.gapRon >= 0 ? "+" : ""}{i.gapRon}</span> RON</InfoRow>
          <div className="border-t border-white/[.06] pt-5">
            <div className="text-[11px] font-medium uppercase tracking-[.12em] text-white/35">Live activations</div>
            <div className="mt-3 space-y-2.5">
              {ci!.events.map((ev) => <div key={ev} className="flex gap-2.5"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-white/30" /><span className="text-[13.5px] leading-snug text-white/80">{ev}</span></div>)}
            </div>
          </div>
        </div>
      )}

      <div className="mt-7 flex justify-center">
        <LiquidMetalButton width={336} onClick={onExpand} label={own ? "Open full dossier" : "Open competitor intel"} />
      </div>
    </motion.div>
  );
}
