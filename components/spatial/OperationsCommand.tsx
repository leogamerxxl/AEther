"use client";

import { Map, BedDouble, UtensilsCrossed, ChefHat, Wine, Camera, Users, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/heroui-card";
import { NODES } from "@/lib/spatial-data";
import { ZONE_STATE, FLAGS, SEV_COLOR, ROLES, type ZoneId } from "@/lib/ops";
import type { LucideIcon } from "lucide-react";

function ZoneCard({ zone, label, icon: Icon, span }: { zone: ZoneId; label: string; icon: LucideIcon; span: string }) {
  const z = ZONE_STATE[zone];
  const top = z.recommendations[0];
  return (
    <Card className={span + " gap-3"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Icon className="size-4 text-white/40" /><span className="text-[13px] font-semibold text-white">{label}</span></div>
        <span className="text-[11px] tabular-nums text-white/40">{z.staffOnShift} on shift</span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-white/50">{z.situation}</p>
      <div className="grid grid-cols-3 gap-2 border-t border-white/[.06] pt-3">
        {z.stats.slice(0, 3).map((s) => (
          <div key={s.label}><div className="text-[10px] text-white/40">{s.label}</div><div className="mt-0.5 text-[14px] font-semibold tabular-nums" style={{ color: s.accent ?? "#fff" }}>{s.value}</div></div>
        ))}
      </div>
      {top ? (
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: SEV_COLOR[top.severity] + "33", background: SEV_COLOR[top.severity] + "0d" }}>
          <div className="flex items-center gap-2"><span className="size-1.5 shrink-0 rounded-full" style={{ background: SEV_COLOR[top.severity], boxShadow: `0 0 6px ${SEV_COLOR[top.severity]}` }} /><span className="text-[12px] font-medium text-white">{top.title}</span></div>
        </div>
      ) : null}
    </Card>
  );
}

export default function OperationsCommand({ onOpenMap }: { onOpenMap?: () => void }) {
  const home = NODES.find((n) => n.isOwn) ?? NODES[0];
  const totalStaff = Object.values(ZONE_STATE).reduce((a, z) => a + z.staffOnShift, 0);
  const staffZones: { zone: ZoneId; label: string }[] = [
    { zone: "rooms", label: "Housekeeping" }, { zone: "restaurant", label: "Restaurant" }, { zone: "kitchen", label: "Kitchen" },
    { zone: "bar", label: "Bar" }, { zone: "lobby", label: "Front desk" }, { zone: "terrace", label: "Terrace" },
  ];
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="h-[100dvh] w-full overflow-y-auto bg-[#08090b] px-4 pb-24 pt-20 no-scrollbar sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[.16em] text-amber-300/70">{greeting} &middot; {dateStr}</div>
            <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.02em] text-white">Operations Command</h1>
            <div className="text-[13px] text-white/45">{home.name} &middot; live floor</div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[11px] font-medium text-white/60"><Users className="size-3.5" /> {totalStaff} on shift</span>
            {onOpenMap ? <button onClick={onOpenMap} className="gx-ghost flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[11px] font-medium text-white/70 hover:text-white"><Map className="size-3.5" /> Map</button> : null}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3">
          <ZoneCard zone="rooms" label="Housekeeping" icon={BedDouble} span="col-span-12 sm:col-span-6 lg:col-span-4" />
          <ZoneCard zone="kitchen" label="Kitchen" icon={ChefHat} span="col-span-12 sm:col-span-6 lg:col-span-4" />
          <ZoneCard zone="restaurant" label="Restaurant" icon={UtensilsCrossed} span="col-span-12 sm:col-span-6 lg:col-span-4" />
          <ZoneCard zone="bar" label="Bar & inventory" icon={Wine} span="col-span-12 sm:col-span-6 lg:col-span-4" />
          <ZoneCard zone="lobby" label="Front desk & maintenance" icon={Camera} span="col-span-12 sm:col-span-6 lg:col-span-4" />

          {/* Staff on shift */}
          <Card className="col-span-12 gap-3 sm:col-span-6 lg:col-span-4">
            <div className="flex items-center gap-2"><Users className="size-4 text-white/40" /><span className="text-[13px] font-semibold text-white">Staff on shift</span><span className="ml-auto text-[11px] tabular-nums text-white/40">{totalStaff} total</span></div>
            <div className="flex flex-col gap-2 border-t border-white/[.06] pt-3">
              {staffZones.map((s) => (
                <div key={s.zone} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12.5px] text-white/55">{s.label}</span>
                  <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-white/30" style={{ width: `${Math.min(100, ZONE_STATE[s.zone].staffOnShift * 14)}%` }} /></div>
                  <span className="w-5 shrink-0 text-right text-[12.5px] tabular-nums text-white/65">{ZONE_STATE[s.zone].staffOnShift}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Flags feed - everything routed */}
          <Card className="col-span-12 gap-3 lg:col-span-12">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><AlertTriangle className="size-4 text-[#ef8b7a]" /><span className="text-[13px] font-semibold text-white">Open flags</span></div>
              <span className="text-[11px] font-medium tabular-nums text-[#ef8b7a]">{FLAGS.length} active</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {FLAGS.map((f) => (
                <div key={f.id} className="flex items-start gap-2.5 rounded-xl border border-white/[.06] bg-white/[.02] px-3 py-2.5">
                  <span className="mt-[5px] size-2 shrink-0 rounded-full" style={{ background: SEV_COLOR[f.severity], boxShadow: `0 0 8px ${SEV_COLOR[f.severity]}` }} />
                  <div className="flex-1">
                    <div className="text-[12.5px] leading-snug text-white/80">{f.message}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-white/35"><span className="capitalize">{ROLES.find((r) => r.id === f.byRole)?.label ?? f.byRole}</span><span>&rarr; {ROLES.find((r) => r.id === f.notifyRole)?.label ?? f.notifyRole}</span><span className="ml-auto tabular-nums">{f.ago}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
