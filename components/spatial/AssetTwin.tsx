"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { X, Boxes, Layers } from "lucide-react";
import type { PropertyIntelligenceNode } from "@/types/spatial";
import { deriveIntel, deriveCompetitorIntel } from "@/lib/spatial-intel";
import { ZONE_STATE, SEV_COLOR, zoneLabel, type ZoneId } from "@/lib/ops";
import { zoneSpec } from "@/lib/terra-building";

const HotelTwin3D = dynamic(() => import("./HotelTwin3D"), { ssr: false });

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-medium text-white/40">{label}</div>
      <div className="mt-1 text-[22px] font-semibold leading-none tracking-[-.02em] tabular-nums text-white">{value}{unit ? <span className="text-[12px] text-white/35">{unit}</span> : null}</div>
    </div>
  );
}

export default function AssetTwin({ node, onClose }: { node: PropertyIntelligenceNode; onClose: () => void }) {
  const i = deriveIntel(node);
  const own = node.isOwn;
  const ci = own ? null : deriveCompetitorIntel(node);
  const [explode, setExplode] = useState(true);
  const [zoneId, setZoneId] = useState<ZoneId | null>(null);
  const zs = zoneId ? ZONE_STATE[zoneId] : null;
  const spec = zoneId ? zoneSpec(zoneId) : null;
  const telemetry = zoneId && zs
    ? `ZONE // ${zoneLabel(zoneId).toUpperCase()} // ${zs.occupancy ? zs.occupancy + "% full" : zs.staffOnShift + " on shift"} // ${zs.recommendations.length} actions`
    : own
    ? `OODA // occ ${i.occupancy}% // ADR ${i.adr} // rank ${i.rank}/${i.total}`
    : `INTEL // social ${ci!.socialReach} // booking ${ci!.bookingPaceDeltaPct >= 0 ? "+" : ""}${ci!.bookingPaceDeltaPct}%`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="fixed inset-0 z-[60] overflow-hidden" style={{ background: "radial-gradient(130% 95% at 50% 30%, #0b1018 0%, #05070b 55%, #000 100%)" }}>
      {/* top bar */}
      <div className="absolute left-6 top-6 z-20">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.22em] text-cyan-300/70"><Boxes className="size-3.5" /> Asset Twin</div>
        <h2 className="mt-2 text-[30px] font-semibold tracking-[-.02em] text-white">{node.name}</h2>
        <div className="mt-1 text-[12.5px] text-white/40">{node.city} &middot; {node.environmentCategory} &middot; {own ? "Your asset" : "Competitor"}</div>
      </div>
      <div className="absolute right-6 top-6 z-20 flex items-center gap-2.5">
        <button onClick={() => setExplode((e) => !e)} className="gx-ghost flex h-11 cursor-pointer items-center gap-2 rounded-full px-5 text-[13px] font-medium text-white/80 transition-colors hover:text-white"><Layers className="size-4" /> {explode ? "Assemble" : "Explode"}</button>
        <button onClick={onClose} aria-label="Close asset twin" className="gx-ghost flex h-11 cursor-pointer items-center gap-2 rounded-full px-5 text-[13px] font-medium text-white/80 transition-colors hover:text-white">Close <X className="size-4" /></button>
      </div>

      {/* 3D twin */}
      <div className="absolute inset-0">
        <HotelTwin3D explode={explode} selectedZone={zoneId} onSelect={(z) => setZoneId(z)} />
      </div>

      {/* left — building-level metrics */}
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, type: "spring", stiffness: 120, damping: 20 }} className="absolute left-6 top-1/2 z-10 -translate-y-1/2">
        <div className="gx gx-bento w-[244px] p-6">
          <div className="text-[11px] font-medium uppercase tracking-[.14em] text-white/35">{own ? "Live metrics" : "Competitive read"}</div>
          {own ? (
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6">
              <Stat label="Occupancy" value={String(i.occupancy)} unit="%" />
              <Stat label="ADR" value={String(i.adr)} unit=" RON" />
              <Stat label="RevPAR" value={String(i.revparEst)} unit=" RON" />
              <Stat label="Comp rank" value={i.rank + " / " + i.total} />
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-6">
              <Stat label="Social" value={ci!.socialReach} />
              <Stat label="Booking" value={(ci!.bookingPaceDeltaPct >= 0 ? "+" : "") + ci!.bookingPaceDeltaPct} unit="%" />
              <Stat label="Occupancy" value={String(i.occupancy)} unit="%" />
              <Stat label="ADR vs you" value={(i.gapRon >= 0 ? "+" : "") + i.gapRon} />
            </div>
          )}
        </div>
      </motion.div>

      {/* right — zone callout (appears when a floor is tapped) */}
      <div className="absolute right-6 top-1/2 z-10 -translate-y-1/2">
        <AnimatePresence mode="wait">
          {zoneId && zs ? (
            <motion.div key={zoneId} initial={{ opacity: 0, x: 30, filter: "blur(6px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: 20, filter: "blur(6px)" }} transition={{ type: "spring", stiffness: 160, damping: 20 }} className="gx gx-bento w-[320px] p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[.14em] text-white/35">Zone</div>
                  <h3 className="mt-1 text-[19px] font-semibold tracking-[-.02em] text-white">{zoneLabel(zoneId)}</h3>{spec ? (<div className="mt-1.5 text-[12px] leading-snug text-white/45">{spec.use}</div>) : null}
                </div>
                <button onClick={() => setZoneId(null)} className="gx-ghost grid size-8 cursor-pointer place-items-center rounded-full text-white/60 hover:text-white"><X className="size-3.5" /></button>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-white/55">{zs.situation}</p>
              {zs.recommendations.length ? (
                <div className="mt-4 space-y-2.5">
                  {zs.recommendations.slice(0, 2).map((rec) => (
                    <div key={rec.id} className="rounded-2xl border p-3.5" style={{ borderColor: SEV_COLOR[rec.severity] + "40", background: SEV_COLOR[rec.severity] + "0d" }}>
                      <div className="flex items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: SEV_COLOR[rec.severity], boxShadow: `0 0 8px ${SEV_COLOR[rec.severity]}` }} /><span className="text-[13px] font-semibold text-white">{rec.title}</span></div>
                      <p className="mt-1.5 pl-[16px] text-[12px] leading-relaxed text-white/55">{rec.detail}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {spec ? (<div className="mt-4 border-t border-white/[.06] pt-3 text-[11px] leading-relaxed text-white/40"><span className="text-white/30">Scope &mdash; </span>{spec.scope}</div>) : null}
              <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-4 border-t border-white/[.06] pt-4">
                {zs.stats.slice(0, 3).map((st) => (
                  <div key={st.label}><div className="text-[10px] text-white/40">{st.label}</div><div className="mt-0.5 text-[14px] font-semibold tabular-nums" style={{ color: st.accent ?? "#fff" }}>{st.value}</div></div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="gx gx-bento w-[244px] p-6 text-center">
              <Layers className="mx-auto size-5 text-cyan-300/70" />
              <div className="mt-3 text-[13px] leading-relaxed text-white/55">Tap a floor to inspect a zone &mdash; tables, supplies, staff, and what to do now.</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* bottom telemetry stream */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <div className="gx gx-bento flex items-center gap-3 px-6 py-3.5">
          <span className="size-1.5 shrink-0 rounded-full bg-cyan-300" style={{ animation: "twinPulse 1.6s ease-in-out infinite" }} />
          <span className="font-mono text-[12px] tracking-tight text-white/70">{telemetry}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
