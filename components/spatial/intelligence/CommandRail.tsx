"use client";
// CommandRail - the map's left operating rail (UXP-density, NIGHT HARBOR law).
// Reads ONLY the one provider. Hierarchy for a 7am owner: (1) action slot -
// the highest-severity recommendation or an honest "no action today"; (2) market
// pressure strip (7 stay-dates); (3) competitor cards from the IO's comps evidence;
// (4) provenance footer (LIVE/SAMPLE, coverage, last observed). Harbor tint keys on
// has-recommendation ONLY; severity renders as a dot; live state is cyan; SAMPLE and
// loading are neutral (skeletons, never a SAMPLE flash). Desktop-only (hidden < lg).

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C } from "@/lib/command-theme";
import { TRANSITION } from "@/lib/motion";
import { ioFreshness, type IntelligenceObject } from "@/lib/intelligence-map";
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

export default function CommandRail() {
  const { source, objects, loading, decisions } = useIntelligence();
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<IntelligenceObject | null>(null);

  const market = useMemo(() => {
    const rows = objects
      .filter((io) => io.signal_type === "market_rate_pressure" && ioFreshness(io) !== "dead")
      .sort((a, b) => String(a.raw_jsonb?.stay_date).localeCompare(String(b.raw_jsonb?.stay_date)));
    return rows.slice(0, 7);
  }, [objects]);

  const topRec = useMemo(() => {
    const withRec = market.filter((io) => (io.recommended_actions ?? []).length > 0 && !decisions[io.id]);
    if (withRec.length === 0) return null;
    return withRec.sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0))[0];
  }, [market, decisions]);

  const comps = useMemo(() => {
    const latest = market[0];
    const list = (latest?.raw_jsonb?.comps as CompRow[] | undefined) ?? [];
    return list.slice(0, 5);
  }, [market]);

  const latestRaw = market[0]?.raw_jsonb as Record<string, unknown> | undefined;
  const coverage = latestRaw ? `${latestRaw.observed ?? "-"}/${latestRaw.urlset_size ?? "-"}` : "-";
  const lastObs = market[0]?.evidence?.[0]?.observed_at ?? market[0]?.observed_at;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Deschide panoul de comanda"
        className="gx gx-bento fixed left-4 top-20 z-[80] hidden items-center gap-2 rounded-full px-3 py-2 lg:flex"
      >
        {source === "live" ? (
          <span className="size-2 animate-pulse rounded-full" style={{ background: C.live }} />
        ) : (
          <span className="size-2 rounded-full" style={{ background: C.idle }} />
        )}
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
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/40">Comanda pietei</span>
          <button onClick={() => setOpen(false)} aria-label="Restrange" className="rounded-md p-1 text-white/35 transition-colors hover:text-white/70">
            <ChevronLeft className="size-3.5" />
          </button>
        </div>

        {/* 1 - ACTION SLOT: the owner's 7am answer, or an honest empty */}
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
            <div className="text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: C.money }}>
              Actiune recomandata
            </div>
            <div className="mt-1 text-[13px] leading-snug text-white/90">
              {String(topRec.recommended_actions?.[0]?.label ?? "Deschide detaliile")}
            </div>
          </button>
        ) : (
          <div className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-3 text-[12.5px] text-white/55">
            {source === "live" ? "Nicio actiune azi - piata echilibrata sau decizii deja inregistrate." : "Date demonstrative - fara actiuni."}
          </div>
        )}

        {/* 2 - PRESSURE STRIP: 7 stay-dates, tabular data, drawer on tap */}
        <div className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-2">
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-white/35">Presiune 7 nopti</div>
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
        </div>

        {/* 3 - COMP CARDS: evidence, sold-out first */}
        {comps.length > 0 ? (
          <div className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-2">
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[.12em] text-white/35">
              Concurenta - {ddmm(String(latestRaw?.stay_date ?? ""))}
            </div>
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
          </div>
        ) : null}

        {/* 4 - PROVENANCE FOOTER: trust garnish, not the lede */}
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