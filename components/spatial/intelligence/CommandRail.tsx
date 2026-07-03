"use client";
// CommandRail - the map's operating rail, now altitude-aware. ONE surface whose
// content morphs with the camera band (no boxes-in-boxes, no extra screens):
//   globe/country/region -> macro outlook (weather IO + honest collector status)
//   market   -> action slot / 7-night pressure strip / competitor evidence
//   property -> the focused hotel: position vs market + its signals
//   twin     -> interior digital twin (floors/departments/inventory - DEMO until PMS)
// Reads ONLY the one provider. Harbor = action; cyan = live; SAMPLE/DEMO = neutral.

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

function ddmm(d?: string): string {
  return d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : "-";
}
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
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-2">{children}</div>;
}

export default function CommandRail({ band, onFlyTo, focusId }: { band: AltitudeBand; onFlyTo?: (zoom: number) => void; focusId?: string | null }) {
  const { source, objects, loading, decisions, nodes } = useIntelligence();
  // The focused entity: the building you clicked, or the home property.
  const focus = (focusId ? nodes.find((n) => n.id === focusId) : null)
    ?? nodes.find((n) => n.name?.includes("Terra")) ?? nodes[0];
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<IntelligenceObject | null>(null);

  const market = useMemo(() => {
    return objects
      .filter((io) => io.signal_type === "market_rate_pressure" && ioFreshness(io) !== "dead")
      .sort((a, b) => String(a.raw_jsonb?.stay_date).localeCompare(String(b.raw_jsonb?.stay_date)))
      .slice(0, 7);
  }, [objects]);

  const weather = useMemo(
    () => objects.find((io) => io.signal_type === "weather_demand_outlook" && ioFreshness(io) !== "dead") ?? null,
    [objects],
  );

  const topRec = useMemo(() => {
    const withRec = market.filter((io) => (io.recommended_actions ?? []).length > 0 && !decisions[io.id]);
    if (withRec.length === 0) return null;
    return withRec.sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0))[0];
  }, [market, decisions]);

  const comps = useMemo(() => ((market[0]?.raw_jsonb?.comps as CompRow[] | undefined) ?? []).slice(0, 5), [market]);
  const latestRaw = market[0]?.raw_jsonb as Record<string, unknown> | undefined;
  const coverage = latestRaw ? `${latestRaw.observed ?? "-"}/${latestRaw.urlset_size ?? "-"}` : "-";
  const lastObs = market[0]?.evidence?.[0]?.observed_at ?? market[0]?.observed_at;
  const meta = bandMeta(band);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Deschide panoul de comanda"
        className="gx gx-bento fixed left-4 top-20 z-[80] hidden items-center gap-2 rounded-full px-3 py-2 lg:flex"
      >
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
        className="gx gx-glass fixed left-4 top-20 z-[80] hidden max-h-[calc(100dvh-6rem)] w-[340px] flex-col gap-3 overflow-y-auto rounded-[26px] p-4 lg:flex"
        aria-label="Panou de comanda"
      >
        {/* Breadcrumb header - the altitude trail IS the navigation context */}
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-[.14em] text-white/40" title={meta.trail}>
            {meta.trail}
          </span>
          <button onClick={() => setOpen(false)} aria-label="Restrange" className="shrink-0 rounded-md p-1 text-white/35 transition-colors hover:text-white/70">
            <ChevronLeft className="size-3.5" />
          </button>
        </div>

        {/* ============ MACRO BANDS: globe / country / region ============ */}
        {(band === "globe" || band === "country" || band === "region") ? (
          <>
            {weather ? (
              <button onClick={() => setSelected(weather)} className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-3 text-left transition-colors duration-200 hover:bg-white/[.04]" aria-label="Perspectiva meteo">
                <div className="text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: C.live }}>Perspectiva cererii - meteo</div>
                <div className="mt-1 text-[12.5px] leading-snug text-white/80">{weather.causal_hypothesis}</div>
              </button>
            ) : (
              <Card><div className="px-1 py-1 text-[12px] text-white/45">Fara semnal meteo in fereastra curenta.</div></Card>
            )}
            <Card>
              <SectionTitle>Semnale macro</SectionTitle>
              <div className="flex flex-col gap-1 px-1 pb-1 text-[11.5px] text-white/55">
                <div className="flex justify-between"><span>Curs BNR (EUR/RON)</span><span className="tabular-nums text-white/75">colectat zilnic</span></div>
                <div className="flex justify-between"><span>Sarbatori / evenimente</span><span className="text-white/35">in plan</span></div>
                <div className="flex justify-between"><span>Trafic / combustibil</span><span className="text-white/35">in plan</span></div>
                <div className="flex justify-between"><span>Viralitate / tendinte</span><span className="text-white/35">in plan</span></div>
              </div>
            </Card>
            <button onClick={() => onFlyTo?.(12)} className="rounded-[14px] border px-3 py-2 text-left text-[12.5px] text-white/85 transition-opacity duration-200 hover:opacity-90" style={{ borderColor: C.moneySoft, background: C.moneySoft }}>
              Coboara la piata Neptun-Olimp {topRec ? "- 1 actiune in asteptare" : ""}
            </button>
          </>
        ) : null}

        {/* ============ MARKET BAND ============ */}
        {band === "market" ? (
          <>
            {loading ? (
              <div className="flex flex-col gap-2 rounded-[14px] border border-white/[.06] bg-white/[.02] p-3">
                <Skeleton w="w-3/4" /><Skeleton w="w-1/2" />
              </div>
            ) : topRec ? (
              <button
                onClick={() => setSelected(topRec)}
                className="rounded-[14px] border p-3 text-left transition-opacity duration-200 hover:opacity-90"
                style={{ borderColor: C.money, background: C.moneySoft }}
                aria-label="Deschide recomandarea"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: C.money }}>Actiune recomandata</div>
                <div className="mt-1 text-[13px] leading-snug text-white/90">{String(topRec.recommended_actions?.[0]?.label ?? "Deschide detaliile")}</div>
              </button>
            ) : (
              <div className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-3 text-[12.5px] text-white/55">
                {source === "live" ? "Nicio actiune azi - piata echilibrata sau decizii deja inregistrate." : "Date demonstrative - fara actiuni."}
              </div>
            )}

            <Card>
              <SectionTitle>Presiune 7 nopti</SectionTitle>
              {loading ? (
                <div className="flex flex-col gap-1.5 p-1">{[0, 1, 2].map((i) => <Skeleton key={i} w="w-full" />)}</div>
              ) : market.length === 0 ? (
                <div className="px-1 pb-1 text-[11.5px] text-white/40">
                  {source === "live" ? "Fara semnale de piata in fereastra curenta." : "DEMO - fara date de piata."}
                </div>
              ) : (
                market.map((io) => {
                  const raw = io.raw_jsonb as Record<string, unknown>;
                  const hasRec = (io.recommended_actions ?? []).length > 0;
                  const decided = !!decisions[io.id];
                  const cmp = raw?.compression != null ? Math.round(Number(raw.compression) * 100) : null;
                  return (
                    <button
                      key={io.id}
                      onClick={() => setSelected(io)}
                      className="flex w-full items-center gap-2 rounded-[4px] px-1.5 py-1 text-left transition-colors duration-200 hover:bg-white/[.04]"
                      style={hasRec && !decided ? { background: C.moneySoft } : undefined}
                      aria-label={`Detalii ${String(raw?.stay_date ?? "")}`}
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: hasRec && !decided ? C.money : C.idle }} />
                      <span className="w-11 text-[11.5px] tabular-nums text-white/70">{ddmm(String(raw?.stay_date ?? ""))}</span>
                      <span className="flex-1 text-right text-[11.5px] tabular-nums text-white/80">
                        {raw?.median_adr_ron != null ? `${ron.format(Number(raw.median_adr_ron))} RON` : "epuizat"}
                      </span>
                      <span className="w-14 text-right text-[11px] tabular-nums" style={{ color: cmp != null && cmp >= 50 ? C.money : "rgba(255,255,255,0.45)" }}>
                        {cmp != null ? `${cmp}% full` : "-"}
                      </span>
                    </button>
                  );
                })
              )}
            </Card>

            {comps.length > 0 ? (
              <Card>
                <SectionTitle>Concurenta - {ddmm(String(latestRaw?.stay_date ?? ""))}</SectionTitle>
                {comps.map((cp, i) => (
                  <div key={i} className="flex items-center gap-2 px-1.5 py-1">
                    <span className="flex-1 truncate text-[11.5px] text-white/70" title={cp.name ?? undefined}>{cp.name ?? "hotel"}</span>
                    {cp.availability_state === "sold_out" ? (
                      <span className="text-[10.5px] font-medium uppercase tracking-[.08em] text-white/45">epuizat</span>
                    ) : (
                      <span className="text-[11.5px] tabular-nums text-white/80">
                        {cp.rate_ron != null ? `${ron.format(cp.rate_ron)} RON` : "-"}
                        {cp.rooms_remaining != null ? <span className="text-white/35"> - {cp.rooms_remaining} cam.</span> : null}
                      </span>
                    )}
                  </div>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}

        {/* ============ PROPERTY BAND ============ */}
        {band === "property" ? (
          <>
            <Card>
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
                  <span className="tabular-nums text-white/85">
                    {latestRaw?.median_adr_ron != null ? `${ron.format(Number(latestRaw.median_adr_ron))} RON` : "-"}
                  </span>
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

        {/* ============ TWIN BAND (DEMO until PMS/OTB) ============ */}
        {band === "twin" ? (
          <>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/[.1] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[.12em] text-white/45">DEMO</span>
              <span className="text-[11px] text-white/40">twin real dupa conectarea OTB/PMS</span>
            </div>
            <Card>
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
              <Card key={d.id}>
                <SectionTitle>{d.label}</SectionTitle>
                <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                  {d.roles.map((r, i) => (
                    <span key={i} className="rounded-full border border-white/[.08] px-2 py-0.5 text-[10.5px] text-white/60">
                      {r.role} - {r.state}
                    </span>
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

        {/* Provenance footer - constant across altitudes */}
        <div className="flex items-center gap-2 border-t border-white/[.06] px-1 pt-2 text-[10.5px] text-white/40">
          {loading ? (
            <Skeleton w="w-24" />
          ) : (
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