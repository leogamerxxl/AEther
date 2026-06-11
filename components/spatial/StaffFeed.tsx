"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, Check, Clock } from "lucide-react";
import { ROLES, ZONES, zonesForRole, ZONE_STATE, SEV_COLOR, zoneLabel, type Role, type ZoneId } from "@/lib/ops";

export default function StaffFeed({ role }: { role: Role }) {
  const zones = zonesForRole(role);
  const [zone, setZone] = useState<ZoneId>(zones[0]);
  const [sent, setSent] = useState(false);
  const zs = ZONE_STATE[zone];
  const roleMeta = ROLES.find((r) => r.id === role)!;
  const me = zs.shift[0]?.name ?? "You";

  const raise = () => { setSent(true); setTimeout(() => setSent(false), 2600); };

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[440px] flex-col" style={{ background: "radial-gradient(120% 80% at 50% 0%, #0c0f15 0%, #05070b 60%, #000 100%)" }}>
      {/* header */}
      <div className="shrink-0 px-5 pb-3 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[.18em] text-cyan-300/70">{roleMeta.label} &middot; on shift</div>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-.02em] text-white">{me}</h1>
          </div>
          <div className="grid size-11 place-items-center rounded-full bg-white/10 text-[16px] font-semibold text-white/85">{me.slice(0, 1)}</div>
        </div>
        {zones.length > 1 ? (
          <div className="mt-4 flex gap-1.5 overflow-x-auto no-scrollbar">
            {zones.map((z) => (
              <button key={z} onClick={() => setZone(z)} className={"shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors " + (z === zone ? "bg-white text-[#0b0b0d]" : "gx-ghost text-white/70")}>{zoneLabel(z)}</button>
            ))}
          </div>
        ) : null}
      </div>

      {/* body */}
      <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar px-5 pb-28 pt-2">
        <div className="gx gx-bento p-5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold tracking-tight text-white">{zoneLabel(zone)}</span>
            <span className="text-[13px] tabular-nums text-white/55">{zs.occupancy ? zs.occupancy + "% full" : zs.staffOnShift + " on"}</span>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/55">{zs.situation}</p>
        </div>

        {zs.recommendations.length ? (
          <div className="space-y-2.5">
            <div className="px-1 text-[11px] font-medium uppercase tracking-[.12em] text-white/35">What to do now</div>
            {zs.recommendations.map((rec) => (
              <div key={rec.id} className="rounded-2xl border p-4" style={{ borderColor: SEV_COLOR[rec.severity] + "40", background: SEV_COLOR[rec.severity] + "0d" }}>
                <div className="flex items-center gap-2.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: SEV_COLOR[rec.severity], boxShadow: `0 0 8px ${SEV_COLOR[rec.severity]}` }} />
                  <span className="text-[14px] font-semibold text-white">{rec.title}</span>
                </div>
                <p className="mt-2 pl-[18px] text-[13px] leading-relaxed text-white/55">{rec.detail}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="gx gx-bento grid grid-cols-2 gap-x-5 gap-y-5 p-5">
          {zs.stats.map((st) => (
            <div key={st.label}>
              <div className="text-[11px] text-white/40">{st.label}</div>
              <div className="mt-1 text-[19px] font-semibold tabular-nums" style={{ color: st.accent ?? "#ffffff" }}>{st.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* bottom action bar */}
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[440px] px-5 pb-6">
        <motion.button whileTap={{ scale: 0.97 }} onClick={raise} className="gx-metal flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl text-[15px] font-semibold">
          <Flag className="size-5" /> Raise a flag
        </motion.button>
        <div className="mt-2 text-center text-[11px] text-white/30">Routes straight to the {role === "waiter" || role === "chef" || role === "bartender" || role === "reception" ? "manager" : "right lane"} <Clock className="mb-0.5 inline size-3" /></div>
      </div>

      <AnimatePresence>
        {sent ? (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
            <div className="gx gx-bento flex items-center gap-2.5 px-5 py-3">
              <Check className="size-4 text-emerald-300" />
              <span className="text-[13px] text-white/85">Flag sent to the manager</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
