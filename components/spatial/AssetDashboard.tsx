"use client";

import { motion } from "framer-motion";
import { X, ArrowRight, Wind, Thermometer, Route, CalendarRange, DoorOpen, Share2, TrendingUp, CalendarDays, Layers } from "lucide-react";
import type { PropertyIntelligenceNode } from "@/types/spatial";
import { deriveIntel, deriveCompetitorIntel } from "@/lib/spatial-intel";
import { StatBlock, RateLadder, Sparkline } from "./charts";
import { LiquidMetalChip } from "@/components/ui/liquid-metal-surface";

const PACE_LABEL: Record<string, string> = { tight: "Demand tight", balanced: "Balanced pace", soft: "Demand soft" };

function CardHead({ title, tag }: { title: string; tag?: string }) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-3">
      <span className="text-[15px] font-semibold tracking-tight text-white">{title}</span>
      {tag ? <span className="text-[11.5px] text-white/35">{tag}</span> : null}
    </div>
  );
}
function DriverRow({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3.5 py-2.5">
      <Icon className="size-4 shrink-0 text-white/30" />
      <span className="flex-1 text-[13px] text-white/50">{label}</span>
      <span className="text-[13.5px] font-medium tabular-nums" style={{ color: accent ?? "rgba(255,255,255,.9)" }}>{value}</span>
    </div>
  );
}
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[.12em] text-white/35">{label}</span>
      <span className="text-right text-[13.5px] text-white/85">{children}</span>
    </div>
  );
}
const spring = { type: "spring" as const, stiffness: 220, damping: 26 };
function verbFor(dir: "up" | "down" | "hold") { return dir === "up" ? "Raise rate" : dir === "down" ? "Trim rate" : "Hold — aligned to demand"; }

export default function AssetDashboard({ node, onClose, onAction, onOpenOps, live }: { node: PropertyIntelligenceNode; onClose: () => void; onAction?: (label: string) => void; onOpenOps?: () => void; live?: { narrative: string; delta: number; alert: string } | null }) {
  const i = deriveIntel(node);
  const own = node.isOwn;
  const ci = own ? null : deriveCompetitorIntel(node);
  const t = node.telemetry;
  const dir = live ? (live.delta > 0 ? "up" : live.delta < 0 ? "down" : "hold") : i.headline.direction;
  const delta = live ? live.delta : i.headline.deltaRon;
  const ladder = [{ name: node.name + " (you)", value: node.adrRon, own: true }, ...node.competitors.map((c) => ({ name: c.name, value: c.currentAdrRon }))].sort((a, b) => b.value - a.value);

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div className="pointer-events-auto absolute left-5 top-5 z-10">
        <div className="flex items-center gap-2.5 text-[12.5px] text-white/45">
          <span>{node.city} &middot; {node.environmentCategory}</span><span className="text-white/20">&middot;</span>
          <span>{own ? "Your asset" : PACE_LABEL[i.pace]}</span>
          {live ? <span className="flex items-center gap-1.5 text-white/75"><span className="size-1.5 animate-pulse rounded-full bg-white/75" />Live</span> : null}
        </div>
        <h2 className="mt-2 text-[32px] font-semibold leading-none tracking-[-.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.8)]">{node.name}</h2>
      </div>
      <LiquidMetalChip onClick={onOpenOps} aria-label="Open operations" className="pointer-events-auto absolute right-[124px] top-5 z-10 h-11 rounded-full px-5 text-[13px] font-medium">Operations <Layers className="size-4" /></LiquidMetalChip>
      {/* 3D Twin button removed - twin set aside for now */}
      <LiquidMetalChip onClick={onClose} aria-label="Close dossier" className="pointer-events-auto absolute right-5 top-5 z-10 h-11 rounded-full px-5 text-[13px] font-medium">Close <X className="size-4" /></LiquidMetalChip>

      <motion.div initial={{ opacity: 0, x: -28, filter: "blur(8px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={spring} className="pointer-events-auto absolute bottom-5 left-5 top-[96px] flex w-[392px] flex-col gap-5 overflow-y-auto no-scrollbar pr-2">
        <div className="gx gx-bento shrink-0 p-7">
          <div className="grid grid-cols-2 gap-x-7 gap-y-6">
            <StatBlock label="Occupancy" value={String(i.occupancy)} unit="%" delta={{ v: "2.0", up: false }} spark={i.trajectory.map((v) => Math.round(v / 8 + i.occupancy - 12))} />
            <StatBlock label="ADR" value={String(i.adr)} unit="RON" delta={{ v: i.gapPct + "%", up: i.gapRon >= 0 }} spark={i.trajectory} />
            <StatBlock label="RevPAR est" value={String(i.revparEst)} unit="RON" delta={{ v: "6.1%", up: true }} spark={i.trajectory.map((v) => Math.round((v * i.occupancy) / 100))} />
            <StatBlock label="Comp rank" value={i.rank + " / " + i.total} delta={null} />
          </div>
        </div>

        {own ? (
          <div className="gx gx-bento shrink-0 p-7">
            <CardHead title="Daily Briefing" tag="OODA" />
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[.14em] text-white/35">Recommended move</div>
                <div className="mt-2.5 text-[22px] font-semibold leading-tight tracking-[-.02em] text-white">{verbFor(dir)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[26px] font-semibold leading-none tabular-nums text-white">{delta >= 0 ? "+" : ""}{delta}</div>
                <div className="mt-1 text-[10.5px] text-white/35">RON / nt</div>
              </div>
            </div>
            {live ? <p className="mt-5 line-clamp-3 text-[13px] leading-relaxed text-white/45">{live.narrative}</p> : null}
            <div className="mt-6 space-y-4">
              {i.evidence.map((e, idx) => (
                <div key={idx} className="flex gap-3"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-white/30" /><span className="text-[13px] leading-relaxed text-white/70">{e}</span></div>
              ))}
            </div>
            {node.insight.actionableTriggers.length ? (
              <div className="mt-7 flex flex-col gap-2.5">
                {node.insight.actionableTriggers.map((a, idx) => (
                  <LiquidMetalChip key={a.id} onClick={() => onAction?.("Queued: " + a.label)} className="h-11 w-full rounded-2xl px-5 text-[13px] font-semibold">{a.label} <ArrowRight className="ml-auto size-4" /></LiquidMetalChip>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="gx gx-bento shrink-0 p-7">
            <CardHead title="Competitive Intelligence" tag="live read" />
            <div className="space-y-3">
              <InfoRow label="Social reach"><span className="tabular-nums text-white">{ci!.socialReach}</span> &middot; <span className="tabular-nums" style={{ color: ci!.socialGrowthPct >= 0 ? "#5fd0a0" : "#e6b566" }}>{ci!.socialGrowthPct >= 0 ? "+" : ""}{ci!.socialGrowthPct}%</span> WoW</InfoRow>
              <InfoRow label="Sentiment"><span className="tabular-nums text-white">{ci!.sentimentPct}%</span> positive &middot; {ci!.topPlatform}</InfoRow>
              <InfoRow label="Booking pace"><span className="tabular-nums text-white">{ci!.bookingPaceDeltaPct >= 0 ? "+" : ""}{ci!.bookingPaceDeltaPct}%</span> &middot; {ci!.bookingPaceLabel}</InfoRow>
              <InfoRow label="ADR vs you"><span className="tabular-nums text-white">{i.gapRon >= 0 ? "+" : ""}{i.gapRon}</span> RON</InfoRow>
            </div>
            <div className="mt-5 border-t border-white/[.06] pt-5">
              <div className="text-[11px] font-medium uppercase tracking-[.12em] text-white/35">Live activations</div>
              <div className="mt-3 space-y-2.5">
                {ci!.events.map((ev) => <div key={ev} className="flex gap-2.5"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-white/30" /><span className="text-[13px] leading-snug text-white/80">{ev}</span></div>)}
              </div>
            </div>
            <div className="mt-7 flex flex-col gap-2.5">
              <LiquidMetalChip onClick={() => onAction?.("Preparing full social breakdown")} className="h-11 w-full rounded-2xl px-5 text-[13px] font-semibold">Full social breakdown <Share2 className="ml-auto size-4" /></LiquidMetalChip>
              <LiquidMetalChip onClick={() => onAction?.("Loading booking pace history")} className="h-11 w-full rounded-2xl px-5 text-[13px] font-semibold">Booking pace history <TrendingUp className="ml-auto size-4" /></LiquidMetalChip>
              <LiquidMetalChip onClick={() => onAction?.("Opening event calendar")} className="h-11 w-full rounded-2xl px-5 text-[13px] font-semibold">Event calendar <CalendarDays className="ml-auto size-4" /></LiquidMetalChip>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 28, filter: "blur(8px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={spring} className="pointer-events-auto absolute bottom-5 right-5 top-[96px] flex w-[392px] flex-col gap-5 overflow-y-auto no-scrollbar pl-2">
        <div className="gx gx-bento shrink-0 p-7">
          <CardHead title="Rate Position" tag={"rank " + i.rank + " of " + i.total} />
          <RateLadder rows={ladder} />
          <div className="mt-6 border-t border-white/[.06] pt-5">
            <div className="mb-2.5 flex items-center justify-between text-[11.5px] text-white/35"><span>ADR trajectory &middot; 14 nights</span><span className="tabular-nums">median {i.compMedian}</span></div>
            <div className="h-12"><Sparkline data={i.trajectory} h={48} stroke="rgba(255,255,255,0.5)" /></div>
          </div>
        </div>
        <div className="gx gx-bento shrink-0 p-7">
          <CardHead title="Demand Drivers" tag="environment" />
          <DriverRow icon={Thermometer} label="Sea-front temperature" value={t.temperatureCelsius + "°C"} />
          <DriverRow icon={Wind} label="Coastal wind" value={t.windSpeedKmH + " km/h"} accent={t.windSpeedKmH > 22 ? "#e6b566" : undefined} />
          <DriverRow icon={Route} label="DN39 inbound delay" value={"+" + t.trafficDecelerationMinutes + " min"} accent={t.trafficDecelerationMinutes > 10 ? "#e6b566" : undefined} />
          <DriverRow icon={CalendarRange} label="Regional events live" value={String(t.activeRegionalEventsCount)} />
          <DriverRow icon={DoorOpen} label="Rooms remaining" value={node.availabilityPct + "%"} />
        </div>
      </motion.div>
    </div>
  );
}
