"use client";

/**
 * Aether — AssetIntelligenceSheet (Progressive Disclosure Panel)
 *
 * Slides in from the left margin using realistic spring physics:
 *   type: "spring", stiffness: 100, damping: 18
 *
 * Structure:
 *   ┌──────────────────────────────────────┐
 *   │ Header: node category · name · close │  always visible
 *   ├──────────────────────────────────────┤
 *   │ KPI strip: Occ · ADR · RevPAR · Rank │  always visible
 *   ├──────────────────────────────────────┤
 *   │ ▾ Weather & Maritime                 │  tap-to-reveal
 *   ├──────────────────────────────────────┤
 *   │ ▾ Logistics & Traffic Flow           │  tap-to-reveal
 *   ├──────────────────────────────────────┤
 *   │ ▾ Competitive Set                    │  tap-to-reveal
 *   ├──────────────────────────────────────┤
 *   │ ▾ OODA Action Engine  [default open] │  tap-to-reveal
 *   └──────────────────────────────────────┘
 *   │ Data provenance footnote             │
 *
 * Glassmorphism spec (exact from brief):
 *   backdrop-filter: blur(20px) saturate(160%)
 *   background: rgba(13, 17, 21, 0.75)
 *   border: 1px solid rgba(255, 255, 255, 0.08)
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, Building2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { PropertyIntelligenceNode } from "@/types/spatial";
import { deriveIntel } from "@/lib/spatial-intel";
import { Sparkline, RateLadder } from "./charts";
import { WeatherMatrix, TrafficTracker, OODAEngine, Reveal } from "./widgets";

// ─── Design tokens ──────────────────────────────────────────────────────────
const CY = "#06b6d4";
const EM = "#10b981";
const AM = "#f59e0b";

const PACE_COLOR: Record<string, string> = {
  tight:    EM,
  balanced: CY,
  soft:     AM,
};
const PACE_LABEL: Record<string, string> = {
  tight:    "Demand tight",
  balanced: "Balanced pace",
  soft:     "Demand soft",
};
const VEL_COLOR: Record<string, string> = {
  accelerating: EM,
  decelerating: AM,
  stable:       "#64748b",
};

// ─── Spring config (spec-exact) ──────────────────────────────────────────────
const PANEL_SPRING = { type: "spring" as const, stiffness: 100, damping: 18 };

// ─── KPI tile ────────────────────────────────────────────────────────────────
function KpiTile({
  label, value, unit, color = "#f8fafc", delta,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  delta?: { text: string; up: boolean };
}) {
  return (
    <div className="gx gx-inset flex flex-col gap-1 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">{label}</div>
      <div className="flex items-baseline gap-1">
        <span
          className="font-mono text-[20px] font-semibold leading-none tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-[10px] text-slate-500">{unit}</span>
        )}
      </div>
      {delta && (
        <span
          className="font-mono text-[10px] tabular-nums"
          style={{ color: delta.up ? EM : AM }}
        >
          {delta.up ? "▲" : "▼"} {delta.text}
        </span>
      )}
    </div>
  );
}

// ─── Competitive set table ───────────────────────────────────────────────────
function CompetitorTable({ node }: { node: PropertyIntelligenceNode }) {
  const ladderRows = [
    { name: node.name + " (you)", value: node.adrRon, own: true },
    ...node.competitors.map(c => ({ name: c.name, value: c.currentAdrRon })),
  ].sort((a, b) => b.value - a.value);

  return (
    <Reveal summary={`Competitive set · ${node.competitors.length} tracked`}>
      <div className="space-y-4">
        <RateLadder rows={ladderRows} />
        <div className="space-y-1.5 border-t border-white/[.06] pt-3">
          {node.competitors.map(c => (
            <div key={c.propertyId} className="flex items-center justify-between gap-3">
              <span className="truncate text-[12px] text-slate-300">{c.name}</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="tabular-nums text-slate-200">{c.currentAdrRon}</span>
                <span
                  className="text-[9px] uppercase tracking-wider"
                  style={{ color: VEL_COLOR[c.bookingVelocityTrend] }}
                >
                  {c.bookingVelocityTrend.slice(0, 4)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

// ─── AssetIntelligenceSheet ──────────────────────────────────────────────────

interface Props {
  node: PropertyIntelligenceNode | null;
  onClose: () => void;
  onAction?: (id: string, payload: unknown) => void;
  live?: { narrative: string; delta: number; alert: string } | null;
}

export default function AssetIntelligenceSheet({
  node, onClose, onAction, live,
}: Props) {
  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          key={node.id}
          initial={{ x: "-100%", opacity: 0, filter: "blur(8px)" }}
          animate={{ x: 0,       opacity: 1, filter: "blur(0px)" }}
          exit={{   x: "-100%", opacity: 0, filter: "blur(8px)" }}
          transition={PANEL_SPRING}
          className="absolute bottom-4 left-4 top-4 z-30 flex w-[420px] max-w-[92%] flex-col overflow-hidden rounded-2xl"
          style={{
            backdropFilter:         "blur(20px) saturate(160%)",
            WebkitBackdropFilter:   "blur(20px) saturate(160%)",
            background:             "rgba(13, 17, 21, 0.85)",
            border:                 "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow:              "0 24px 64px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* ── Header ──────────────────────────────────────────── */}
          <div
            className="flex items-start justify-between gap-3 px-5 pb-4 pt-5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.18em]" style={{ color: CY }}>
                <Building2 className="size-3 shrink-0" />
                {node.environmentCategory} · {node.stars}★
              </div>
              <h2 className="mt-1.5 text-[20px] font-semibold tracking-tight text-slate-50 leading-tight">
                {node.name}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                {(() => {
                  const i = deriveIntel(node);
                  const pc = PACE_COLOR[i.pace];
                  const Dir = i.headline.direction === "up"
                    ? TrendingUp
                    : i.headline.direction === "down"
                    ? TrendingDown
                    : Minus;
                  return (
                    <>
                      <span
                        className="flex items-center gap-1.5 font-mono text-[11px]"
                        style={{ color: pc }}
                      >
                        <Dir className="size-3" />
                        {PACE_LABEL[i.pace]}
                      </span>
                      {live && (
                        <span className="flex items-center gap-1 font-mono text-[10px]" style={{ color: CY }}>
                          <span className="size-1.5 animate-pulse rounded-full" style={{ background: CY }} />
                          Live
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close intelligence sheet"
              className="gx gx-raised gx-press -mr-1 -mt-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-[11px] text-slate-400 outline-none hover:text-white focus-visible:ring-1 focus-visible:ring-white/30"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* ── KPI strip ───────────────────────────────────────── */}
          {(() => {
            const i = deriveIntel(node);
            const pc = PACE_COLOR[i.pace];
            return (
              <div className="shrink-0 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="grid grid-cols-4 gap-2">
                  <KpiTile
                    label="Occupancy"
                    value={`${i.occupancy}`}
                    unit="%"
                    color={pc}
                  />
                  <KpiTile
                    label="ADR"
                    value={`${i.adr}`}
                    unit="RON"
                    delta={{ text: `${Math.abs(i.gapPct)}%`, up: i.gapRon >= 0 }}
                  />
                  <KpiTile
                    label="RevPAR"
                    value={`${i.revparEst}`}
                    unit="RON"
                    color={EM}
                  />
                  <KpiTile
                    label="Rank"
                    value={`${i.rank}/${i.total}`}
                    color={CY}
                  />
                </div>

                {/* ADR trajectory sparkline */}
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[.12em] text-slate-600">
                    14-day ADR trajectory
                  </span>
                  <Sparkline data={i.trajectory} w={180} h={24} stroke={pc} />
                </div>
              </div>
            );
          })()}

          {/* ── Scrollable accordion widgets ────────────────────── */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-3">
            <WeatherMatrix t={node.telemetry} />
            <TrafficTracker t={node.telemetry} />
            <CompetitorTable node={node} />
            <OODAEngine
              insight={
                live
                  ? { ...node.insight, observedContext: live.narrative, computedImpactDeltaRon: live.delta }
                  : node.insight
              }
              live={!!live}
              onAction={onAction}
            />

            {/* Provenance footnote */}
            <p className="flex items-start gap-2 border-t pt-3 font-mono text-[9.5px] leading-relaxed text-slate-600"
              style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              Coordinates and ADR are real market data.
              Telemetry and OODA insights are deterministic sample until
              OpenWeather, DN39 traffic feed, and OODA edge function connect.
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
