"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Layers, Lock } from "lucide-react";
import { ROLES, ZONES, zonesForRole, ZONE_STATE, flagsForRole, type Role, type ZoneId } from "@/lib/ops";

const SEV_COLOR: Record<string, string> = { info: "#5fd0a0", warn: "#e6b566", critical: "#ef8b7a" };
const zoneLabel = (id: ZoneId) => ZONES.find((z) => z.id === id)?.label ?? id;

export default function OperationsConsole({ propertyName, onClose }: { propertyName: string; onClose: () => void }) {
  const [role, setRole] = useState<Role>("owner");
  const [zoneId, setZoneId] = useState<ZoneId>("terrace");
  const accessible = zonesForRole(role);
  const zone = accessible.includes(zoneId) ? zoneId : accessible[0];
  const zs = ZONE_STATE[zone];
  const flags = flagsForRole(role);

  const selectRole = (r: Role) => { setRole(r); setZoneId(zonesForRole(r)[0]); };

  const sortedZones = [...ZONES].sort((a, b) => b.level - a.level);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="fixed inset-0 z-[60] overflow-hidden" style={{ background: "radial-gradient(130% 95% at 50% 28%, #0b0e14 0%, #05070b 60%, #000 100%)" }}>
      {/* top bar */}
      <div className="absolute left-6 right-6 top-6 z-20 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.22em] text-cyan-300/70"><Layers className="size-3.5" /> Operations</div>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-.02em] text-white">{propertyName}</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <button key={r.id} onClick={() => selectRole(r.id)} className={"cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors " + (role === r.id ? "bg-white text-[#0b0b0d]" : "gx-ghost text-white/70 hover:text-white")}>{r.label}</button>
            ))}
          </div>
          <div className="mt-2 text-[12px] text-white/40">{ROLES.find((r) => r.id === role)?.scope} &middot; {accessible.length} zones in scope</div>
        </div>
        <button onClick={onClose} aria-label="Close operations" className="gx-ghost flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full px-5 text-[13px] font-medium text-white/80 transition-colors hover:text-white">Close <X className="size-4" /></button>
      </div>

      {/* exploded floor stack (left) */}
      <div className="absolute bottom-6 left-6 top-[168px] flex w-[40%] items-center justify-center">
        <div className="flex flex-col gap-3.5" style={{ perspective: "1000px" }}>
          {sortedZones.map((z, idx) => {
            const locked = !accessible.includes(z.id);
            const active = z.id === zone;
            const st = ZONE_STATE[z.id];
            return (
              <motion.button
                key={z.id}
                initial={{ opacity: 0, x: -24 }} animate={{ opacity: locked ? 0.28 : 1, x: 0 }} transition={{ delay: 0.05 + idx * 0.04, type: "spring", stiffness: 140, damping: 20 }}
                onClick={() => !locked && setZoneId(z.id)}
                disabled={locked}
                className="group relative"
                style={{ transform: "skewX(-19deg)", cursor: locked ? "not-allowed" : "pointer" }}
              >
                <div
                  className="flex w-[300px] items-center justify-between px-5 py-3.5"
                  style={{
                    borderRadius: 10,
                    border: active ? "1px solid rgba(34,211,238,.6)" : "1px solid rgba(255,255,255,.08)",
                    background: active ? "linear-gradient(180deg,rgba(34,211,238,.16),rgba(34,211,238,.04))" : "rgba(255,255,255,.035)",
                    boxShadow: active ? "0 0 30px rgba(34,211,238,.25),inset 0 1px 0 rgba(255,255,255,.12)" : "inset 0 1px 0 rgba(255,255,255,.06)",
                  }}
                >
                  <span style={{ transform: "skewX(19deg)" }} className={"text-[13.5px] font-medium " + (active ? "text-cyan-100" : "text-white/80")}>{z.label}</span>
                  <span style={{ transform: "skewX(19deg)" }} className="flex items-center gap-2">
                    {locked ? <Lock className="size-3.5 text-white/40" /> : <span className="font-mono text-[12px] tabular-nums text-white/55">{st.occupancy ? st.occupancy + "%" : st.staffOnShift + " staff"}</span>}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* right column: surgical zone intelligence + routed flags */}
      <div className="absolute bottom-6 right-6 top-[168px] flex w-[50%] max-w-[600px] flex-col gap-5 overflow-y-auto no-scrollbar pr-1">
        <div className="gx gx-bento shrink-0 p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[.14em] text-white/35">Zone</div>
              <h3 className="mt-1.5 text-[22px] font-semibold tracking-[-.02em] text-white">{zoneLabel(zone)}</h3>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-white/35">{zs.occupancy ? "Occupancy" : "On shift"}</div>
              <div className="text-[22px] font-semibold tabular-nums text-white">{zs.occupancy ? zs.occupancy + "%" : zs.staffOnShift}</div>
            </div>
          </div>

          <p className="mt-4 text-[13.5px] leading-relaxed text-white/55">{zs.situation}</p>

          {zs.recommendations.length ? (
            <div className="mt-6 space-y-2.5">
              <div className="text-[11px] font-medium uppercase tracking-[.12em] text-white/35">AI recommendations</div>
              {zs.recommendations.map((rec) => (
                <div key={rec.id} className="rounded-2xl border p-4" style={{ borderColor: SEV_COLOR[rec.severity] + "40", background: SEV_COLOR[rec.severity] + "0d" }}>
                  <div className="flex items-center gap-2.5">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: SEV_COLOR[rec.severity], boxShadow: `0 0 8px ${SEV_COLOR[rec.severity]}` }} />
                    <span className="text-[13.5px] font-semibold text-white">{rec.title}</span>
                  </div>
                  <p className="mt-2 pl-[18px] text-[12.5px] leading-relaxed text-white/55">{rec.detail}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            {zs.stats.map((st) => (
              <div key={st.label}>
                <div className="text-[11px] text-white/40">{st.label}</div>
                <div className="mt-1 text-[16px] font-semibold tabular-nums" style={{ color: st.accent ?? "#ffffff" }}>{st.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-white/[.06] pt-5">
            <div className="text-[11px] font-medium uppercase tracking-[.12em] text-white/35">On shift now</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {zs.shift.map((m) => (
                <span key={m.name + m.role} className="flex items-center gap-2 rounded-full bg-white/[.04] py-1.5 pl-1.5 pr-3.5">
                  <span className="grid size-6 place-items-center rounded-full bg-white/10 text-[10px] font-semibold text-white/80">{m.name.slice(0, 1)}</span>
                  <span className="text-[12.5px] text-white/80">{m.name}</span>
                  <span className="text-[11px] text-white/35">{m.role}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-white/[.06] pt-5">
            <div className="text-[11px] font-medium uppercase tracking-[.12em] text-white/35">Tools</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {zs.modules.map((m) => <span key={m} className="gx-ghost rounded-full px-3.5 py-1.5 text-[12px] font-medium text-white/70">{m}</span>)}
            </div>
          </div>
        </div>

        <div className="gx gx-bento shrink-0 p-7">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[15px] font-semibold tracking-tight text-white">Flags routed to you</span>
            <span className="text-[12px] text-white/35">{flags.length} active</span>
          </div>
          <div className="flex flex-col gap-3">
            {flags.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-white/30">No flags in your lane. All clear.</div>
            ) : flags.map((f) => (
              <div key={f.id} className="flex items-start gap-3 rounded-2xl bg-white/[.025] px-4 py-3.5">
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: SEV_COLOR[f.severity], boxShadow: `0 0 8px ${SEV_COLOR[f.severity]}` }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] leading-snug text-white/85">{f.message}</div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/35">
                    <span className="uppercase tracking-wide">{zoneLabel(f.zone)}</span><span className="text-white/20">&middot;</span>
                    <span>{ROLES.find((r) => r.id === f.byRole)?.label} <span className="text-white/25">→</span> {ROLES.find((r) => r.id === f.notifyRole)?.label}</span>
                    <span className="ml-auto tabular-nums">{f.ago}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
