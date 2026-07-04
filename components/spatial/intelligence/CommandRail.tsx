"use client";
// CommandRail - the dense left intelligence stack (reference anatomy, AETHER skin):
// count chips -> availability split -> action slot -> market-pressure chart card
// (big thin numeral + 7-night sparkline against the action threshold) -> 2-column
// entity cards -> provenance footer. Content morphs per altitude band. One provider,
// real observations only; SAMPLE/DEMO stays neutral; harbor = action, cyan = live.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C } from "@/lib/command-theme";
import { TRANSITION } from "@/lib/motion";
import { ioFreshness, type IntelligenceObject } from "@/lib/intelligence-map";
import { bandMeta, type AltitudeBand } from "@/lib/altitude";
import { TERRA_TWIN } from "@/lib/twin-sample";
import { useIntelligence } from "./SpatialIntelligenceProvider";
import IOContextDrawer from "./IOContextDrawer";

type CompRow = {
  name?: string | null; rate_ron?: number | null; availability_state?: string | null;
  rooms_remaining?: number | null; observed_at?: string | null;
};

const ron = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function ddmm(d?: string): string { return d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : "-"; }
function relTime(iso?: string | null): string {
  if (!iso) return "-";
  const h = (Date.now() - Date.parse(iso)) / 3.6e6;
  if (h < 1) return "acum " + Math.max(1, Math.round(h * 60)) + " min";
  return "acum " + Math.round(h) + " h";
}
function Skeleton({ w }: { w: string }) {
  return <div className={`h-3 ${w} animate-pulse rounded-[4px] bg-white/[.06]`} />;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-white/35">{children}</div>;
}
function Card({ children, pad = "p-3" }: { children: React.ReactNode; pad?: string }) {
  return <div className={`rounded-[14px] border border-white/[.06] bg-white/[.02] ${pad}`}>{children}</div>;
}
function CountChip({ n, label, active }: { n: string | number; label: string; active?: boolean }) {
  return (
    <div className={"flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 " +
      (active ? "border-white/[.14] bg-white/[.06]" : "border-white/[.06] bg-white/[.02]")}>
      <span className="num text-[15px] font-light text-white/90">{n}</span>
      <span className="text-[10.5px] text-white/45">{label}</span>
    </div>
  );
}

// The pressure chart: 7 nights of sell-out compression vs the 50% action threshold.
function PressureChart({ market, decisions, onPick }: {
  market: IntelligenceObject[]; decisions: Record<string, unknown>; onPick: (io: IntelligenceObject) => void;
}) {
  const W = 288, H = 84, X0 = 10, X1 = W - 10, Y0 = 74, SPAN = 62;
  const pts = market.map((io, i) => {
    const cmp = Math.min(100, Math.round(Number((io.raw_jsonb as Record<string, unknown>)?.compression ?? 0) * 100));
    const x = market.length > 1 ? X0 + (i * (X1 - X0)) / (market.length - 1) : (X0 + X1) / 2;
    return { io, cmp, x, y: Y0 - (cmp / 100) * SPAN };
  });
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${X0},${Y0} ${line} ${X1},${Y0}`;
  const yThr = Y0 - 0.5 * SPAN;
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="mt-2 w-full" role="img" aria-label="Compresie pe 7 nopti">
      <line x1={X0} y1={yThr} x2={X1} y2={yThr} stroke="rgba(255,255,255,0.22)" strokeDasharray="3 4" strokeWidth="1" />
      <text x={X1} y={yThr - 4} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.3)">prag 50%</text>
      {pts.length > 1 ? <polygon points={area} fill={C.live} fillOpacity="0.07" /> : null}
      {pts.length > 1 ? <polyline points={line} fill="none" stroke={C.live} strokeOpacity="0.75" strokeWidth="1.5" /> : null}
      {pts.map((p) => {
        const rec = (p.io.recommended_actions ?? []).length > 0 && !decisions[p.io.id];
        return (
          <g key={p.io.id} onClick={() => onPick(p.io)} className="cursor-pointer">
            <circle cx={p.x} cy={p.y} r="7" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={rec ? 3 : 2} fill={rec ? C.money : C.live} fillOpacity={rec ? 1 : 0.8} />
            <text x={p.x} y={H + 10} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.35)">
              {ddmm(String((p.io.raw_jsonb as Record<string, unknown>)?.stay_date ?? ""))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function CommandRail({ band, onFlyTo, focusId }: {
  band: AltitudeBand; onFlyTo?: (zoom: number) => void; focusId?: string | null;
}) {
  const { source, objects, loading, decisions, nodes } = useIntelligence();
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<IntelligenceObject | null>(null);

  const focus = (focusId ? nodes.find((n) => n.id === focusId) : null)
    ?? nodes.find((n) => n.name?.includes("Terra")) ?? nodes[0];

  const market = useMemo(() => objects
    .filter((io) => io.signal_type === "market_rate_pressure" && ioFreshness(io) !== "dead")
    .sort((a, b) => String(a.raw_jsonb?.stay_date).localeCompare(String(b.raw_jsonb?.stay_date)))
    .slice(0, 7), [objects]);

  const weather = useMemo(
    () => objects.find((io) => io.signal_type === "weather_demand_outlook" && ioFreshness(io) !== "dead") ?? null,
    [objects],
  );

  const pendingRecs = useMemo(
    () => market.filter((io) => (io.recommended_actions ?? []).length > 0 && !decisions[io.id]),
    [market, decisions],
  );
  const topRec = useMemo(() => pendingRecs.length === 0 ? null
    : [...pendingRecs].sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0))[0],
    [pendingRecs]);

  const latest = market[0];
  const latestRaw = latest?.raw_jsonb as Record<string, unknown> | undefined;
  const comps = useMemo(() => ((latestRaw?.comps as CompRow[] | undefined) ?? []).slice(0, 10), [latestRaw]);
  const median = latestRaw?.median_adr_ron != null ? Number(latestRaw.median_adr_ron) : null;
  const soldout = Number(latestRaw?.soldout_count ?? 0);
  const observed = Number(latestRaw?.observed ?? 0);
  const coverage = latestRaw ? `${latestRaw.observed ?? "-"}/${latestRaw.urlset_size ?? "-"}` : "-";
  const lastObs = latest?.evidence?.[0]?.observed_at ?? latest?.observed_at;
  const tonightCmp = latestRaw?.compression != null ? Math.round(Number(latestRaw.compression) * 100) : null;
  const meta = bandMeta(band);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Deschide panoul de comanda"
        className="gx gx-matte fixed left-4 top-[124px] z-[80] hidden items-center gap-2 rounded-full px-3 py-2 lg:flex">
        <span className={source === "live" ? "size-2 animate-pulse rounded-full" : "size-2 rounded-full"}
              style={{ background: source === "live" ? C.live : C.idle }} />
        {topRec ? <span className="size-2 rounded-full" style={{ background: C.money }} /> : null}
        <ChevronRight className="size-3.5 text-white/50" />
      </button>
    );
  }

  return (
    <>
      <motion.aside
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={TRANSITION.standard}
        className="gx gx-matte fixed left-4 top-[124px] z-[80] hidden max-h-[calc(100dvh-8.75rem)] w-[380px] flex-col gap-3 overflow-y-auto rounded-[26px] p-4 lg:flex"
        aria-label="Panou de comanda"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-[.14em] text-white/40" title={meta.trail}>{meta.trail}</span>
          <button onClick={() => setOpen(false)} aria-label="Restrange" className="shrink-0 rounded-md p-1 text-white/35 transition-colors hover:text-white/70">
            <ChevronLeft className="size-3.5" />
          </button>
        </div>

        {/* ============ MACRO BANDS ============ */}
        {(band === "globe" || band === "country" || band === "region") ? (
          <>
            {weather ? (
              <button onClick={() => setSelected(weather)} className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-3 text-left transition-colors duration-200 hover:bg-white/[.04]">
                <div className="text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: C.live }}>Perspectiva cererii - meteo</div>
                <div className="mt-1 text-[12.5px] leading-snug text-white/80">{weather.causal_hypothesis}</div>
              </button>
            ) : (
              <Card><div className="text-[12px] text-white/45">Fara semnal meteo in fereastra curenta.</div></Card>
            )}
            <Card pad="p-2">
              <SectionTitle>Semnale macro</SectionTitle>
              <div className="flex flex-col gap-1 px-1 pb-1 text-[11.5px] text-white/55">
                <div className="flex justify-between"><span>Curs BNR (EUR/RON)</span><span className="tabular-nums text-white/75">colectat zilnic</span></div>
                <div className="flex justify-between"><span>Sarbatori / evenimente</span><span className="text-white/35">in plan</span></div>
                <div className="flex justify-between"><span>Trafic / combustibil</span><span className="text-white/35">in plan</span></div>
                <div className="flex justify-between"><span>Viralitate / tendinte</span><span className="text-white/35">in plan</span></div>
              </div>
            </Card>
            <button onClick={() => onFlyTo?.(12)} className="rounded-[14px] border px-3 py-2 text-left text-[12.5px] text-white/85 transition-opacity duration-200 hover:opacity-90" style={{ borderColor: C.moneySoft, background: C.moneySoft }}>
              Coboara la piata Neptun-Olimp{pendingRecs.length ? ` - ${pendingRecs.length} actiuni in asteptare` : ""}
            </button>
          </>
        ) : null}

        {/* ============ MARKET BAND: the dense stack ============ */}
        {band === "market" ? (
          <>
            {/* 1 - count chips */}
            <div className="flex flex-wrap gap-1.5">
              <CountChip n={observed || "-"} label="hoteluri" active />
              <CountChip n={market.length} label="nopti" />
              <CountChip n={market.length + (weather ? 1 : 0)} label="semnale" />
              <CountChip n={pendingRecs.length} label="actiuni" />
            </div>

            {/* 2 - availability split */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-2 rounded-[14px] border border-white/[.06] bg-white/[.02] px-3 py-2.5">
                <span className="size-1.5 rounded-full" style={{ background: C.live }} />
                <span className="text-[11px] text-white/55">Disponibile</span>
                <span className="num ml-auto text-[20px] font-light text-white/90">{observed ? observed - soldout : "-"}</span>
              </div>
              <div className="flex items-center gap-2 rounded-[14px] border border-white/[.06] bg-white/[.02] px-3 py-2.5">
                <span className="size-1.5 rounded-full" style={{ background: C.idle }} />
                <span className="text-[11px] text-white/55">Epuizate</span>
                <span className="num ml-auto text-[20px] font-light text-white/90">{soldout || "-"}</span>
              </div>
            </div>

            {/* 3 - action slot */}
            {loading ? (
              <Card><div className="flex flex-col gap-2"><Skeleton w="w-3/4" /><Skeleton w="w-1/2" /></div></Card>
            ) : topRec ? (
              <button onClick={() => setSelected(topRec)} className="rounded-[14px] border p-3 text-left transition-opacity duration-200 hover:opacity-90"
                      style={{ borderColor: C.money, background: C.moneySoft }} aria-label="Deschide recomandarea">
                <div className="text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: C.money }}>Actiune recomandata</div>
                <div className="mt-1 text-[13px] leading-snug text-white/90">{String(topRec.recommended_actions?.[0]?.label ?? "Deschide detaliile")}</div>
              </button>
            ) : (
              <Card><div className="text-[12.5px] text-white/55">
                {source === "live" ? "Nicio actiune azi - piata echilibrata sau decizii deja inregistrate." : "Date demonstrative - fara actiuni."}
              </div></Card>
            )}

            {/* 4 - pressure chart card (the efficiency-card analog, real compression) */}
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <SectionTitle>Presiune piata - diseara</SectionTitle>
                  <div className="flex items-baseline gap-1 px-1">
                    <span className="num text-[30px] font-light leading-none text-white/95">{tonightCmp != null ? tonightCmp : "-"}</span>
                    <span className="text-[13px] text-white/40">%</span>
                  </div>
                </div>
                <span className="pt-1 text-[10px] text-white/35">hoteluri pline / set</span>
              </div>
              {loading ? <div className="mt-3 flex flex-col gap-1.5">{[0, 1].map((i) => <Skeleton key={i} w="w-full" />)}</div>
                : market.length > 0 ? <PressureChart market={market} decisions={decisions} onPick={setSelected} />
                : <div className="mt-2 text-[11.5px] text-white/40">{source === "live" ? "Fara semnale in fereastra curenta." : "DEMO - fara date."}</div>}
            </Card>

            {/* 5 - entity cards, 2-col */}
            {comps.length > 0 ? (
              <div>
                <SectionTitle>Concurenta - {ddmm(String(latestRaw?.stay_date ?? ""))}</SectionTitle>
                <div className="grid grid-cols-2 gap-1.5">
                  {comps.map((cp, i) => {
                    const sold = cp.availability_state === "sold_out";
                    const delta = !sold && cp.rate_ron != null && median != null ? Math.round(cp.rate_ron - median) : null;
                    return (
                      <button key={i} onClick={() => latest && setSelected(latest)}
                        className="flex flex-col gap-1 rounded-[14px] border border-white/[.06] bg-white/[.02] p-2.5 text-left transition-colors duration-200 hover:bg-white/[.04]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[11px] text-white/75" title={cp.name ?? undefined}>{cp.name ?? "hotel"}</span>
                          <span className={"shrink-0 rounded-full border px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[.08em] " +
                            (sold ? "border-white/[.1] text-white/40" : "border-white/[.14] text-white/70")}
                            style={sold ? undefined : { color: C.live, borderColor: "rgba(255,255,255,0.14)" }}>
                            {sold ? "epuizat" : "disponibil"}
                          </span>
                        </div>
                        <div className="num text-[17px] font-light leading-none text-white/90">
                          {sold ? "—" : cp.rate_ron != null ? `${ron.format(cp.rate_ron)}` : "-"}
                          {!sold && cp.rate_ron != null ? <span className="ml-1 text-[10px] text-white/35">RON</span> : null}
                        </div>
                        <div className="flex items-center justify-between text-[9.5px] text-white/35">
                          <span className="tabular-nums">
                            {sold ? relTime(cp.observed_at) : delta != null
                              ? <span style={delta > 0 ? { color: C.money } : undefined}>{delta > 0 ? "+" : ""}{ron.format(delta)} vs median</span>
                              : relTime(cp.observed_at)}
                          </span>
                          {!sold && cp.rooms_remaining != null ? <span className="tabular-nums">{cp.rooms_remaining} cam.</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {/* ============ PROPERTY BAND ============ */}
        {band === "property" ? (
          <>
            <Card pad="p-2">
              <SectionTitle>{focus?.name ?? "Proprietate"}</SectionTitle>
              <div className="flex flex-col gap-1 px-1 pb-1 text-[11.5px]">
                {focus?.adrRon ? (
                  <div className="flex justify-between text-white/70">
                    <span>Tarif afisat</span>
                    <span className="tabular-nums text-white/85">{ron.format(focus.adrRon)} RON</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-white/70">
                  <span>Median piata (azi)</span>
                  <span className="tabular-nums text-white/85">{median != null ? `${ron.format(median)} RON` : "-"}</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Concurenti epuizati azi</span>
                  <span className="tabular-nums text-white/85">{String(latestRaw?.soldout_count ?? "-")}/{String(latestRaw?.urlset_size ?? "-")}</span>
                </div>
              </div>
              {focus?.insight?.observedContext ? (
                <div className="px-1 pb-1 text-[11px] leading-snug text-white/45">{focus.insight.observedContext}</div>
              ) : null}
            </Card>
            {topRec ? (
              <button onClick={() => setSelected(topRec)} className="rounded-[14px] border p-3 text-left transition-opacity duration-200 hover:opacity-90" style={{ borderColor: C.money, background: C.moneySoft }}>
                <div className="text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: C.money }}>Actiune in asteptare</div>
                <div className="mt-1 text-[12.5px] leading-snug text-white/90">{String(topRec.recommended_actions?.[0]?.label ?? "")}</div>
              </button>
            ) : null}
            {weather ? (
              <button onClick={() => setSelected(weather)} className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-3 text-left text-[12px] leading-snug text-white/70 transition-colors hover:bg-white/[.04]">
                {weather.causal_hypothesis}
              </button>
            ) : null}
            <button onClick={() => onFlyTo?.(17.4)} className="rounded-[14px] border border-white/[.08] px-3 py-2 text-left text-[12.5px] text-white/65 transition-colors duration-200 hover:bg-white/[.04]">
              Coboara in interior (twin)
            </button>
          </>
        ) : null}

        {/* ============ TWIN BAND ============ */}
        {band === "twin" ? (
          <>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/[.1] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[.12em] text-white/45">DEMO</span>
              <span className="text-[11px] text-white/40">twin real dupa conectarea OTB/PMS</span>
            </div>
            <Card pad="p-2">
              <SectionTitle>Ocupare - {TERRA_TWIN.occupancyPct}%</SectionTitle>
              {TERRA_TWIN.floors.map((f) => (
                <div key={f.id} className="flex items-center gap-2 px-1.5 py-1">
                  <span className="w-14 text-[11.5px] text-white/70">{f.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-white/[.06]">
                    <div className="h-full rounded-[3px]" style={{ width: `${Math.round((f.occupied / f.rooms) * 100)}%`, background: C.live, opacity: 0.7 }} />
                  </div>
                  <span className="w-12 text-right text-[11px] tabular-nums text-white/60">{f.occupied}/{f.rooms}</span>
                </div>
              ))}
            </Card>
            {TERRA_TWIN.departments.map((d) => (
              <Card key={d.id} pad="p-2">
                <SectionTitle>{d.label}</SectionTitle>
                <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                  {d.roles.map((r, i) => (
                    <span key={i} className="rounded-full border border-white/[.08] px-2 py-0.5 text-[10.5px] text-white/60">{r.role} - {r.state}</span>
                  ))}
                </div>
                {d.inventory.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 px-1.5 py-0.5">
                    <span className="size-1 rounded-full" style={{ background: it.low ? C.money : C.idle }} />
                    <span className="flex-1 text-[11.5px] text-white/65">{it.name}</span>
                    <span className="text-[11px] tabular-nums" style={{ color: it.low ? C.money : "rgba(255,255,255,0.55)" }}>
                      {it.qty} {it.unit}{it.low ? " - reaprovizionare" : ""}
                    </span>
                  </div>
                ))}
              </Card>
            ))}
          </>
        ) : null}

        {/* footer - provenance */}
        <div className="flex items-center gap-2 border-t border-white/[.06] px-1 pt-2 text-[10.5px] text-white/40">
          {loading ? <Skeleton w="w-24" /> : (
            <>
              <span className="flex items-center gap-1.5">
                <span className={source === "live" ? "size-1.5 animate-pulse rounded-full" : "size-1.5 rounded-full"}
                      style={{ background: source === "live" ? C.live : C.idle }} />
                {source === "live" ? "LIVE" : "DEMO"}
              </span>
              <span className="text-white/25">|</span>
              <span className="tabular-nums">acoperire {coverage}</span>
              <span className="text-white/25">|</span>
              <span className="tabular-nums">{relTime(lastObs)}</span>
            </>
          )}
        </div>
      </motion.aside>

      <IOContextDrawer io={selected} onClose={() => setSelected(null)} />
    </>
  );
}