"use client";

import { Map, ArrowRight, ArrowUp, ArrowDown, TrendingUp, Gauge, Search, CloudLightning, Swords, Zap } from "lucide-react";
import { Card } from "@/components/ui/heroui-card";
import { LiquidMetalChip } from "@/components/ui/liquid-metal-surface";
import { Sparkline } from "./charts";
import { NODES } from "@/lib/spatial-data";
import IntelligencePanel from "./IntelligencePanel";
import { deriveRevenueIntel } from "@/lib/revenue-intel";
import CorridorPressure from "./CorridorPressure";
import { MetricReadout } from "@/components/command/primitives";
import { CardBackdrop } from "@/components/command/motifs";
import { CountUp } from "@/components/command/live-charts";
import { cn } from "@/lib/utils";

const RON = (n: number) => n.toLocaleString("en-US");
function Delta({ v, suffix = "%" }: { v: number; suffix?: string }) {
  const up = v >= 0;
  return <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums", up ? "text-[#5fd0a0]" : "text-[#e6b566]")}>{up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}{up ? "+" : ""}{v}{suffix}</span>;
}

export default function RevenueCommand({ onOpenMap }: { onOpenMap?: () => void }) {
  const home = NODES.find((n) => n.isOwn) ?? NODES[0];
  const r = deriveRevenueIntel(home);
  const occSpark = r.trajectory.map((v) => Math.round(Math.min(99, Math.max(40, v / 8 + r.occupancy - 12))));
  const revparSpark = r.trajectory.map((v) => Math.round((v * r.occupancy) / 100));

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="h-[100dvh] w-full overflow-y-auto bg-[#08090b] px-4 pb-24 pt-20 no-scrollbar sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[.16em] text-cyan-300/70">{greeting} &middot; {dateStr}</div>
            <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.02em] text-white">Revenue Command</h1>
            <div className="text-[13px] text-white/45">{home.name} &middot; {home.city}</div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[11px] font-medium text-white/60"><span className="size-1.5 rounded-full bg-[#5fd0a0]" style={{ boxShadow: "0 0 8px #5fd0a0" }} /> Live demand</span>
        </div>

        <div className="grid grid-cols-12 gap-3">
          <IntelligencePanel />
          {/* PRIMARY ACTION - answers both questions */}
          <Card className="col-span-12 gap-4 p-5 lg:col-span-8">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.14em] text-cyan-300/70"><Zap className="size-3.5" /> Primary action</div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[24px] font-semibold leading-tight tracking-[-.02em] text-white">{r.action.title}</div>
                <div className="mt-2 flex items-center gap-2 text-[14px] text-white/55">
                  <span className="tabular-nums">{r.action.currentAdr} RON</span>
                  <ArrowRight className="size-4 text-white/30" />
                  <span className="font-semibold tabular-nums text-white">{r.action.suggestedAdr} RON</span>
                  <span className="text-[12px] text-white/35">&middot; {r.action.lever}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[.12em] text-white/35">Expected gain</div>
                <div className="text-[30px] font-semibold leading-none tabular-nums text-[#5fd0a0]">+<CountUp value={r.action.expectedGainRon} /></div>
                <div className="mt-1 text-[10px] text-white/35">RON &middot; {r.action.confidencePct}% confidence</div>
              </div>
            </div>
            <div className="rounded-xl border border-[#e6b566]/25 bg-[#e6b566]/[.07] px-4 py-3 text-[12.5px] text-[#e6c28f]">
              If you hold rates, you leave <span className="font-semibold tabular-nums">~{RON(r.doNothingLossRon)} RON</span> on the table this weekend.
            </div>
            <Card.Footer className="mt-auto gap-2.5">
              <LiquidMetalChip className="h-10 rounded-xl px-5 text-[13px] font-semibold">Apply this move <ArrowRight className="size-4" /></LiquidMetalChip>
              {onOpenMap ? <button onClick={onOpenMap} className="gx-ghost flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-[13px] font-medium text-white/80 transition-colors hover:text-white"><Map className="size-4" /> Open command map</button> : null}
            </Card.Footer>
          </Card>

          {/* Revenue forecast */}
          <Card className="col-span-12 gap-2 lg:col-span-4">
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/40">Revenue forecast &middot; next 7 days</span>
            <div className="mt-1 text-[30px] font-semibold leading-none tabular-nums text-white"><CountUp value={r.revenueForecast.expectedRon} /><span className="text-[14px] font-normal text-white/35"> RON</span></div>
            <div className="mt-3 flex items-center gap-4 text-[12.5px]">
              <span className="text-white/50">Confidence <span className="font-medium tabular-nums text-white">{r.revenueForecast.confidencePct}%</span></span>
              <span className="text-white/50">vs last year <Delta v={r.revenueForecast.vsLastYearPct} /></span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-[#5fd0a0]/70" style={{ width: `${r.revenueForecast.confidencePct}%` }} /></div>
          </Card>

          {/* Occupancy forecast */}
          <Card className="col-span-6 gap-3 lg:col-span-3">
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/40">Occupancy forecast</span>
            {[["Tomorrow", r.occForecast.tomorrow], ["Weekend", r.occForecast.weekend], ["14 days", r.occForecast.next14]].map(([l, v]) => (
              <div key={l as string} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[12px] text-white/50">{l}</span>
                <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-white/35" style={{ width: `${v}%` }} /></div>
                <span className="w-9 shrink-0 text-right text-[13px] font-medium tabular-nums text-white">{v as number}%</span>
              </div>
            ))}
          </Card>

          {/* Booking pace */}
          <Card className="col-span-6 gap-2 lg:col-span-3">
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/40">Booking pace</span>
            <div className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-white">{r.pace.current >= 0 ? "+" : ""}{r.pace.current}%</div>
            <div className="text-[11px]" style={{ color: r.pace.current >= 0 ? "#5fd0a0" : "#e6b566" }}>{r.pace.label}</div>
            <div className="mt-2 space-y-1.5 border-t border-white/[.06] pt-2 text-[12px] text-white/50">
              <div className="flex justify-between">vs last year <Delta v={r.pace.vsLastYear} /></div>
              <div className="flex justify-between">vs competitors <Delta v={r.pace.vsCompetitors} /></div>
            </div>
          </Card>

          {/* Pickup */}
          <Card className="col-span-6 gap-2 lg:col-span-3">
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/40">Pickup &middot; new bookings</span>
            <div className="mt-1 flex items-end gap-4">
              <div><div className="text-[28px] font-semibold leading-none tabular-nums text-white">+{r.pickup.today}</div><div className="text-[10px] text-white/35">today</div></div>
              <div><div className="text-[18px] font-semibold leading-none tabular-nums text-white/55">+{r.pickup.yesterday}</div><div className="text-[10px] text-white/35">yesterday</div></div>
            </div>
            <div className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-[#5fd0a0]/15 px-2 py-0.5 text-[11px] font-medium text-[#5fd0a0]"><TrendingUp className="size-3" /> {r.pickup.trend}</div>
          </Card>

          {/* Market demand index */}
          <Card className="col-span-6 gap-2 lg:col-span-3">
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/40">Market demand index</span>
            <div className="mt-1 flex items-baseline gap-1"><span className="text-[30px] font-semibold leading-none tabular-nums text-white">{r.demand.index}</span><span className="text-[14px] text-white/35">/ 100</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full" style={{ width: `${r.demand.index}%`, background: "linear-gradient(90deg,#e6b566,#5fd0a0)" }} /></div>
            <div className="flex items-center gap-1.5 text-[11px] text-white/40"><Gauge className="size-3" /> {r.demand.index >= 70 ? "High demand window" : r.demand.index >= 45 ? "Steady demand" : "Soft demand"}</div>
          </Card>

          {/* KPIs */}
          <MetricReadout className="col-span-6 lg:col-span-3" label="Occupancy" value={String(r.occupancy)} unit="%" delta={{ v: 2.4 }} spark={occSpark} tone="up" motif="occupancy" />
          <MetricReadout className="col-span-6 lg:col-span-3" label="ADR" value={String(r.adr)} unit=" RON" delta={{ v: r.marketPosition.ratePct, money: true }} spark={r.trajectory} tone="money" motif="trend" />
          <MetricReadout className="col-span-6 lg:col-span-3" label="RevPAR" value={String(r.revpar)} unit=" RON" delta={{ v: 6.1 }} spark={revparSpark} tone="live" motif="building" />
          <Card className="col-span-6 gap-2.5 lg:col-span-3">
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/40">Market position</span>
            <div className="space-y-2 pt-0.5">
              {[["Rate", r.marketPosition.ratePct], ["Occupancy", r.marketPosition.occPct], ["RevPAR", r.marketPosition.revparPct]].map(([l, v]) => (
                <div key={l as string} className="flex items-center justify-between"><span className="text-[12.5px] text-white/55">{l as string}</span><Delta v={v as number} /></div>
              ))}
            </div>
            <div className="text-[10.5px] text-white/30">vs competitive set</div>
          </Card>

          {/* Corridor pressure - the migration-risk engine, surfaced */}
          <CorridorPressure />

          {/* Demand drivers - the moat */}
          <Card className="group relative col-span-12 gap-3 lg:col-span-4">
            <CardBackdrop name="radar" className="text-white" />
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.12em] text-white/40"><Search className="size-3.5" /> Demand drivers</div>
            <div className="flex flex-col gap-2.5">
              {r.demand.drivers.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-white/55">{d.label}</span>
                  <Delta v={d.deltaPct} />
                </div>
              ))}
            </div>
          </Card>

          {/* Competitor movements - the battlefield */}
          <Card className="group relative col-span-12 gap-3 lg:col-span-4">
            <CardBackdrop name="skyline" className="text-white" />
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.12em] text-white/40"><Swords className="size-3.5" /> Competitor movements</div>
            <div className="flex flex-col gap-2.5">
              {r.competitors.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <span className="truncate text-[13px] text-white/65">{c.name}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", c.dir === "up" ? "bg-[#ef8b7a]/15 text-[#f2a594]" : c.dir === "soldout" ? "bg-white/10 text-white/80" : "bg-cyan-400/15 text-cyan-300")}>{c.change}</span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between border-t border-white/[.06] pt-2.5"><span className="text-[12.5px] font-medium text-white/70">Market ADR</span><Delta v={r.marketAdrPct} /></div>
            </div>
          </Card>

          {/* Risks - if you do nothing */}
          <Card className="group relative col-span-12 gap-3 lg:col-span-4">
            <CardBackdrop name="waves" className="text-white" />
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.12em] text-white/40"><CloudLightning className="size-3.5" /> Risks ahead</div>
            <div className="flex flex-col gap-2.5">
              {r.risks.map((rk) => (
                <div key={rk.label} className="flex items-start gap-3 rounded-xl border border-[#e6b566]/20 bg-[#e6b566]/[.06] px-3 py-2.5">
                  <span className="mt-[3px] shrink-0 rounded-md bg-[#e6b566]/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[#e6c28f]">{rk.when}</span>
                  <div className="flex-1"><div className="text-[13px] text-white/75">{rk.label}</div><div className="text-[11.5px] text-white/45">Expected demand impact <span className="font-medium text-[#e6b566]">{rk.impactPct}%</span></div></div>
                </div>
              ))}
            </div>
          </Card>

          {/* ADR trajectory */}
          <Card className="col-span-12 gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/40">ADR trajectory &middot; 14 nights</span>
            <div className="h-[110px] w-full"><Sparkline data={r.trajectory} h={110} stroke="rgba(255,255,255,0.55)" /></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
