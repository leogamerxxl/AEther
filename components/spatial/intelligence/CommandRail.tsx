"use client";
// CommandRail v4 - the narrow left column: SMALL stacked cards, each one reading
// with a micro-visualization. Grammar: locality header card -> market pulse card
// (big % + 7-night sparkline) -> counts card -> weather card -> competitor rows.
// Band-aware (macro/property/twin swap the stack). One drawer lives in Entry;
// this column only reports picks upward.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C } from "@/lib/command-theme";
import { TRANSITION } from "@/lib/motion";
import { ioFreshness, type IntelligenceObject } from "@/lib/intelligence-map";
import { bandMeta, type AltitudeBand } from "@/lib/altitude";
import { TERRA_TWIN } from "@/lib/twin-sample";
import { useIntelligence } from "./SpatialIntelligenceProvider";

type CompRow = {
  name?: string | null; rate_ron?: number | null; availability_state?: string | null;
  rooms_remaining?: number | null; observed_at?: string | null;
};

const ron = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const ddmm = (d?: string) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : "-");
const TITLES: Record<AltitudeBand, string> = {
  globe: "Piete globale", country: "Romania", region: "Litoralul",
  market: "Neptun-Olimp", property: "Hotel Terra Neptun", twin: "Interior - Terra",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`gx gx-matte rounded-[14px] p-2.5 ${className}`}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] font-semibold uppercase tracking-[.12em] text-white/40">{children}</div>;
}

// 7-night compression sparkline with the 50% action threshold.
function Spark({ market, decisions }: { market: IntelligenceObject[]; decisions: Record<string, unknown> }) {
  const W = 196, H = 44, X0 = 4, X1 = W - 4, Y0 = H - 6, SPAN = H - 14;
  const pts = market.map((io, i) => {
    const cmp = Math.min(100, Math.round(Number((io.raw_jsonb as Record<string, unknown>)?.compression ?? 0) * 100));
    const x = market.length > 1 ? X0 + (i * (X1 - X0)) / (market.length - 1) : (X0 + X1) / 2;
    return { io, cmp, x, y: Y0 - (cmp / 100) * SPAN };
  });
  const yThr = Y0 - 0.5 * SPAN;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 w-full">
      <line x1={X0} y1={yThr} x2={X1} y2={yThr} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 3" strokeWidth="1" />
      {pts.length > 1 ? <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={C.live} strokeOpacity="0.8" strokeWidth="1.5" /> : null}
      {pts.map((p) => {
        const rec = (p.io.recommended_actions ?? []).length > 0 && !decisions[p.io.id];
        return <circle key={p.io.id} cx={p.x} cy={p.y} r={rec ? 2.5 : 1.5} fill={rec ? C.money : C.live} />;
      })}
    </svg>
  );
}

export default function CommandRail({ band, onFlyTo, focusId, onPick }: {
  band: AltitudeBand; onFlyTo?: (zoom: number) => void; focusId?: string | null;
  onPick: (io: IntelligenceObject) => void;
}) {
  const { source, objects, loading, decisions, nodes } = useIntelligence();
  const [open, setOpen] = useState(true);
  const focus = (focusId ? nodes.find((n) => n.id === focusId) : null)
    ?? nodes.find((n) => n.name?.includes("Terra")) ?? nodes[0];

  const market = useMemo(() => objects
    .filter((io) => io.signal_type === "market_rate_pressure" && ioFreshness(io) !== "dead")
    .sort((a, b) => String(a.raw_jsonb?.stay_date).localeCompare(String(b.raw_jsonb?.stay_date)))
    .slice(0, 7), [objects]);
  const weather = useMemo(() => objects.find((io) => io.signal_type === "weather_demand_outlook" && ioFreshness(io) !== "dead") ?? null, [objects]);

  const latest = market[0];
  const raw = latest?.raw_jsonb as Record<string, unknown> | undefined;
  const comps = useMemo(() => ((raw?.comps as CompRow[] | undefined) ?? []).slice(0, 6), [raw]);
  const median = raw?.median_adr_ron != null ? Number(raw.median_adr_ron) : null;
  const soldout = Number(raw?.soldout_count ?? 0);
  const observed = Number(raw?.observed ?? 0);
  const cmp = raw?.compression != null ? Math.round(Number(raw.compression) * 100) : null;
  const meta = bandMeta(band);
  const title = band === "property" && focus?.name ? focus.name : TITLES[band];

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Deschide panoul"
        className="gx gx-matte fixed left-4 top-16 z-[80] hidden items-center gap-2 rounded-full px-3 py-2 lg:flex">
        <span className={source === "live" ? "size-2 animate-pulse rounded-full" : "size-2 rounded-full"}
              style={{ background: source === "live" ? C.live : C.idle }} />
        <ChevronRight className="size-3.5 text-white/50" />
      </button>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={TRANSITION.standard}
      className="fixed left-4 top-16 z-[80] hidden max-h-[calc(100dvh-9.5rem)] w-[236px] flex-col gap-2 overflow-y-auto lg:flex">

      {/* locality header card - the title lives IN the column, not over the map */}
      <Card>
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <div className="large-title truncate text-white/95" style={{ fontSize: 21 }}>{title}</div>
            <div className="mt-0.5 truncate text-[8.5px] uppercase tracking-[.14em] text-white/35">{meta.trail}</div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Restrange" className="shrink-0 rounded-md p-0.5 text-white/35 hover:text-white/70">
            <ChevronLeft className="size-3.5" />
          </button>
        </div>
      </Card>

      {(band === "globe" || band === "country" || band === "region") ? (
        <>
          {weather ? (
            <button onClick={() => onPick(weather)} className="gx gx-matte rounded-[14px] p-2.5 text-left transition-colors hover:bg-white/[.04]">
              <Label>Meteo - cerere</Label>
              <div className="mt-1 line-clamp-3 text-[11px] leading-snug text-white/75">{weather.causal_hypothesis}</div>
            </button>
          ) : null}
          <Card>
            <Label>Semnale macro</Label>
            <div className="mt-1 flex flex-col gap-0.5 text-[10.5px] text-white/55">
              <div className="flex justify-between"><span>Curs BNR</span><span className="text-white/70">zilnic</span></div>
              <div className="flex justify-between"><span>Sarbatori</span><span className="text-white/30">in plan</span></div>
              <div className="flex justify-between"><span>Trafic</span><span className="text-white/30">in plan</span></div>
            </div>
          </Card>
          <button onClick={() => onFlyTo?.(12)} className="gx gx-matte rounded-[14px] p-2.5 text-left text-[11px] text-white/85 transition-opacity hover:opacity-90" style={{ background: C.moneySoft }}>
            Coboara la piata -&gt;
          </button>
        </>
      ) : null}

      {band === "market" ? (
        <>
          {/* market pulse: big % + sparkline */}
          <Card>
            <div className="flex items-baseline justify-between">
              <Label>Presiune diseara</Label>
              <span className="text-[8.5px] text-white/30">prag 50%</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="num text-[26px] font-light leading-none text-white/95">{loading ? "-" : cmp ?? "-"}</span>
              <span className="text-[11px]" style={{ color: cmp != null && cmp >= 50 ? C.money : C.live }}>%</span>
              <span className="ml-auto text-[9px] tabular-nums text-white/40">{soldout}/{String(raw?.urlset_size ?? "-")} pline</span>
            </div>
            {market.length > 1 ? <Spark market={market} decisions={decisions} /> : null}
          </Card>

          {/* counts */}
          <Card>
            <div className="flex items-center justify-around">
              {[{ n: observed || "-", l: "observate" }, { n: observed ? observed - soldout : "-", l: "disponibile" }, { n: soldout || "-", l: "epuizate" }].map((s, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="num text-[17px] font-light text-white/90">{s.n}</span>
                  <span className="text-[8.5px] text-white/40">{s.l}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* median */}
          <Card>
            <Label>Median piata - {ddmm(String(raw?.stay_date ?? ""))}</Label>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="num text-[20px] font-light leading-none text-white/95">{median != null ? ron.format(median) : "epuizat"}</span>
              {median != null ? <span className="text-[9px] text-white/35">RON</span> : null}
            </div>
          </Card>

          {weather ? (
            <button onClick={() => onPick(weather)} className="gx gx-matte rounded-[14px] p-2.5 text-left transition-colors hover:bg-white/[.04]">
              <Label>Meteo - cerere</Label>
              <div className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-white/70">{weather.causal_hypothesis}</div>
            </button>
          ) : null}

          {/* competitors: compact rows */}
          {comps.length > 0 ? (
            <Card>
              <Label>Concurenta</Label>
              <div className="mt-1 flex flex-col">
                {comps.map((cp, i) => {
                  const sold = cp.availability_state === "sold_out";
                  return (
                    <button key={i} onClick={() => latest && onPick(latest)}
                      className="flex items-center gap-1.5 rounded-[6px] px-1 py-[3px] text-left transition-colors hover:bg-white/[.05]">
                      <span className="size-1 shrink-0 rounded-full" style={{ background: sold ? C.idle : C.live }} />
                      <span className="min-w-0 flex-1 truncate text-[10.5px] text-white/70" title={cp.name ?? undefined}>{cp.name ?? "hotel"}</span>
                      <span className="num shrink-0 text-[10.5px] text-white/80">
                        {sold ? <span className="text-[8.5px] uppercase tracking-[.06em] text-white/35">epuizat</span> : cp.rate_ron != null ? `${ron.format(cp.rate_ron)}` : "-"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {band === "property" ? (
        <>
          <Card>
            <Label>Pozitie</Label>
            <div className="mt-1 flex flex-col gap-0.5 text-[10.5px] text-white/60">
              {focus?.adrRon ? <div className="flex justify-between"><span>Tarif afisat</span><span className="num text-white/85">{ron.format(focus.adrRon)} RON</span></div> : null}
              <div className="flex justify-between"><span>Median piata</span><span className="num text-white/85">{median != null ? `${ron.format(median)} RON` : "-"}</span></div>
              <div className="flex justify-between"><span>Epuizati azi</span><span className="num text-white/85">{soldout}/{String(raw?.urlset_size ?? "-")}</span></div>
            </div>
            {focus?.insight?.observedContext ? <div className="mt-1.5 line-clamp-3 text-[10px] leading-snug text-white/40">{focus.insight.observedContext}</div> : null}
          </Card>
          <button onClick={() => onFlyTo?.(17.4)} className="gx gx-matte rounded-[14px] p-2.5 text-left text-[11px] text-white/65 transition-colors hover:bg-white/[.04]">
            Coboara in interior (twin) -&gt;
          </button>
        </>
      ) : null}

      {band === "twin" ? (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <Label>Ocupare - {TERRA_TWIN.occupancyPct}%</Label>
              <span className="rounded-full border border-white/[.1] px-1.5 py-px text-[8px] font-semibold uppercase tracking-[.1em] text-white/40">DEMO</span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              {TERRA_TWIN.floors.map((f) => (
                <div key={f.id} className="flex items-center gap-1.5">
                  <span className="w-11 text-[10px] text-white/60">{f.label}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-[2px] bg-white/[.07]">
                    <div className="h-full rounded-[2px]" style={{ width: `${Math.round((f.occupied / f.rooms) * 100)}%`, background: C.live, opacity: 0.7 }} />
                  </div>
                  <span className="num w-9 text-right text-[9.5px] text-white/55">{f.occupied}/{f.rooms}</span>
                </div>
              ))}
            </div>
          </Card>
          {TERRA_TWIN.departments.map((d) => (
            <Card key={d.id}>
              <Label>{d.label}</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {d.roles.map((r, i) => (
                  <span key={i} className="rounded-full border border-white/[.08] px-1.5 py-px text-[9px] text-white/55">{r.role} - {r.state}</span>
                ))}
              </div>
              {d.inventory.map((it, i) => (
                <div key={i} className="mt-0.5 flex items-center gap-1.5">
                  <span className="size-1 rounded-full" style={{ background: it.low ? C.money : C.idle }} />
                  <span className="min-w-0 flex-1 truncate text-[10px] text-white/60">{it.name}</span>
                  <span className="num text-[9.5px]" style={{ color: it.low ? C.money : "rgba(255,255,255,0.5)" }}>{it.qty} {it.unit}</span>
                </div>
              ))}
            </Card>
          ))}
        </>
      ) : null}

      {/* provenance footer */}
      <div className="flex items-center gap-1.5 px-1 text-[9px] text-white/35">
        <span className={source === "live" ? "size-1 animate-pulse rounded-full" : "size-1 rounded-full"}
              style={{ background: source === "live" ? C.live : C.idle }} />
        {source === "live" ? "LIVE" : "DEMO"}
        <span className="text-white/20">|</span>
        <span className="tabular-nums">acoperire {raw ? `${raw.observed}/${raw.urlset_size}` : "-"}</span>
      </div>
    </motion.div>
  );
}