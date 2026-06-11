"use client";

/**
 * Aether — Micro-Widget Subcomponents (Context Integration Layer)
 *
 * Three dense telemetry widgets for AssetIntelligenceSheet:
 *   1. WeatherMatrix   — temp · wind · maritime alert
 *   2. TrafficTracker  — DN39 / rail congestion & flow velocity
 *   3. OODAEngine      — executive prose + snap-action execution buttons
 *
 * All wrapped in WidgetReveal: header always visible, body tap-to-reveal.
 * Spring physics: stiffness 200, damping 26 for body; 240/22 for chevron.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wind, Thermometer, Waves, TriangleAlert, Route,
  Sparkles, ChevronDown, ArrowRight, Activity,
  Zap, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import type { EnvironmentalTelemetry, TacticalOODAInsight } from "@/types/spatial";

// ─── Design tokens ──────────────────────────────────────────────────────────
const CY = "#06b6d4";   // electric cyan  — active tracking
const EM = "#10b981";   // emerald        — positive delta
const AM = "#f59e0b";   // warning amber  — systemic risk
const SL = "#64748b";   // slate muted    — stable/neutral

// ─── Primitives ─────────────────────────────────────────────────────────────

function MonoStat({
  icon: Icon, label, value, unit, color = "#e2e8f0",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="gx gx-inset flex flex-col gap-1.5 p-2.5">
      <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[.12em] text-slate-400">
        <Icon className="size-3" />{label}
      </div>
      <div
        className="font-mono text-[19px] font-semibold tracking-tight tabular-nums"
        style={{ color }}
      >
        {value}
        {unit ? <span className="ml-0.5 text-[10px] text-slate-500">{unit}</span> : null}
      </div>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[.12em]"
      style={{ color, borderColor: `${color}44`, background: `${color}11` }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      {label}
    </span>
  );
}

// ─── WidgetReveal — the tap-to-reveal accordion shell ────────────────────────

interface WidgetRevealProps {
  icon: React.ReactNode;
  title: string;
  tag?: string;
  summary: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function WidgetReveal({
  icon, title, tag, summary, defaultOpen = false, children,
}: WidgetRevealProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="gx gx-raised overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full cursor-pointer px-3.5 py-3 text-left outline-none focus-visible:ring-1 focus-visible:ring-white/20"
        aria-expanded={open}
      >
        {/* Widget title row */}
        <div className="flex items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center text-slate-400">
            {icon}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[.16em] text-slate-300">
            {title}
          </span>
          {tag && (
            <span className="ml-auto rounded-full border border-white/[.08] bg-white/[.03] px-1.5 py-px font-mono text-[8px] uppercase tracking-wider text-slate-500">
              {tag}
            </span>
          )}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className={tag ? "" : "ml-auto"}
          >
            <ChevronDown className="size-3.5 text-slate-600" />
          </motion.span>
        </div>

        {/* Always-visible summary line */}
        <div className="mt-1.5 font-mono text-[11px] leading-snug text-slate-400">
          {summary}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[.05] px-3.5 pb-4 pt-3.5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 1. WeatherMatrix ────────────────────────────────────────────────────────

export function WeatherMatrix({ t }: { t: EnvironmentalTelemetry }) {
  const warn = t.maritimeAlertStatus !== "clear";
  const critical = t.maritimeAlertStatus === "critical";
  const alertColor = critical ? "#ef4444" : AM;
  const windColor = t.windSpeedKmH > 30 ? "#ef4444" : t.windSpeedKmH > 22 ? AM : CY;

  const summary = (
    <span>
      <span style={{ color: CY }}>{t.temperatureCelsius}°C</span>
      {" "}·{" "}
      <span style={{ color: windColor }}>Wind {t.windSpeedKmH} km/h</span>
      {" "}·{" "}
      <span style={{ color: warn ? alertColor : EM }}>
        {t.maritimeAlertStatus.toUpperCase()}
      </span>
    </span>
  );

  return (
    <WidgetReveal
      icon={<Waves className="size-3.5" />}
      title="Weather & Maritime"
      tag="sample"
      summary={summary}
    >
      {/* Telemetry grid */}
      <div className="grid grid-cols-3 gap-2">
        <MonoStat icon={Thermometer} label="Temp" value={`${t.temperatureCelsius}`} unit="°C" color={CY} />
        <MonoStat
          icon={Wind}
          label="Wind"
          value={`${t.windSpeedKmH}`}
          unit="km/h"
          color={windColor}
        />
        <MonoStat icon={Activity} label="Events" value={`${t.activeRegionalEventsCount}`} color="#e2e8f0" />
      </div>

      {/* Wind vector bar */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
          <span>Wind intensity</span>
          <span style={{ color: windColor }}>{t.windSpeedKmH > 30 ? "CRITICAL" : t.windSpeedKmH > 22 ? "ELEVATED" : "NOMINAL"}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (t.windSpeedKmH / 50) * 100)}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 18 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${CY}, ${windColor})`,
              boxShadow: `0 0 8px ${windColor}66`,
            }}
          />
        </div>
      </div>

      {/* Maritime alert card */}
      <AnimatePresence>
        {warn && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
            className="gx gx-tint-amber mt-3 flex items-start gap-2.5 rounded-xl px-3 py-3"
          >
            <TriangleAlert className="mt-px size-3.5 shrink-0" style={{ color: alertColor }} />
            <div>
              <div
                className="font-mono text-[10px] uppercase tracking-[.12em]"
                style={{ color: alertColor }}
              >
                {critical ? "Maritime Front — Critical" : "Coastal Wind Advisory"}
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: "#fcd9a0" }}>
                Beach occupancy migrating inland toward pool and spa domains.
                Lead with indoor-leisure premium packages — avoid room discounting.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusPill
          label={`Maritime ${t.maritimeAlertStatus}`}
          color={warn ? alertColor : EM}
        />
        {t.activeRegionalEventsCount > 0 && (
          <StatusPill
            label={`${t.activeRegionalEventsCount} event${t.activeRegionalEventsCount > 1 ? "s" : ""} active`}
            color={CY}
          />
        )}
      </div>
    </WidgetReveal>
  );
}

// ─── 2. TrafficTracker ───────────────────────────────────────────────────────

const FLOW_SEGMENTS = [
  { label: "DN39 Arterial",  key: "dn39" },
  { label: "Rail Corridor",  key: "rail" },
  { label: "Coastal Access", key: "coast" },
] as const;

export function TrafficTracker({ t }: { t: EnvironmentalTelemetry }) {
  const heavy = t.trafficDecelerationMinutes > 10;
  const moderate = t.trafficDecelerationMinutes > 4;
  const flowColor = heavy ? AM : moderate ? CY : EM;

  // Synthetic flow pct per segment derived from delay
  const delay = t.trafficDecelerationMinutes;
  const segments = [
    { ...FLOW_SEGMENTS[0], congestion: Math.min(100, delay * 5.5) },
    { ...FLOW_SEGMENTS[1], congestion: Math.min(100, delay * 3.2) },
    { ...FLOW_SEGMENTS[2], congestion: Math.min(100, delay * 4.1) },
  ];

  const summary = (
    <span>
      <span style={{ color: flowColor }}>
        DN39 {heavy ? `+${delay} min` : delay > 0 ? `+${delay} min` : "nominal"}
      </span>
      {" // "}
      <span style={{ color: heavy ? AM : EM }}>
        {heavy ? "Scarcity risk observed" : "Flow stable"}
      </span>
    </span>
  );

  return (
    <WidgetReveal
      icon={<Route className="size-3.5" />}
      title="Logistics & Traffic Flow"
      tag="sample"
      summary={summary}
    >
      {/* Hero delay metric */}
      <div className="gx gx-inset mb-3 flex items-center gap-4 px-3.5 py-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
            Inbound delay
          </div>
          <div
            className="mt-0.5 font-mono text-[28px] font-semibold leading-none tabular-nums"
            style={{ color: flowColor }}
          >
            +{delay}
            <span className="ml-1 text-[12px] text-slate-500">min</span>
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
            Flow status
          </div>
          <div
            className="mt-0.5 font-mono text-[13px] font-semibold uppercase tracking-wide"
            style={{ color: flowColor }}
          >
            {heavy ? "SLOWING" : moderate ? "REDUCED" : "NOMINAL"}
          </div>
        </div>
      </div>

      {/* Corridor congestion bars */}
      <div className="space-y-2.5">
        {segments.map((seg) => {
          const segColor = seg.congestion > 65 ? AM : seg.congestion > 35 ? CY : EM;
          return (
            <div key={seg.key}>
              <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
                <span>{seg.label}</span>
                <span style={{ color: segColor }}>{Math.round(seg.congestion)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[.05]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(4, seg.congestion)}%` }}
                  transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.05 }}
                  className="h-full rounded-full"
                  style={{
                    background: segColor,
                    boxShadow: seg.congestion > 50 ? `0 0 8px ${segColor}55` : "none",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* System message */}
      <div
        className="gx gx-inset mt-3 px-3 py-2.5 font-mono text-[10.5px] leading-relaxed"
        style={{ color: heavy ? "#fcd9a0" : SL }}
      >
        {heavy
          ? `Inbound Traffic Delays +${delay} mins // Potential Short-Stay Booking Scarcity Observed`
          : `Arterial flow nominal // Inbound velocity stable across DN39 and rail corridor`}
      </div>

      {heavy && (
        <StatusPill label="Short-stay scarcity risk" color={AM} />
      )}
    </WidgetReveal>
  );
}

// ─── 3. OODAEngine ───────────────────────────────────────────────────────────

export function OODAEngine({
  insight, onAction, live,
}: {
  insight: TacticalOODAInsight;
  onAction?: (id: string, payload: unknown) => void;
  live?: boolean;
}) {
  const positive = insight.computedImpactDeltaRon >= 0;
  const impactColor = positive ? EM : AM;
  const confPct = Math.round(insight.confidenceScore * 100);
  const confColor = confPct >= 80 ? EM : confPct >= 60 ? CY : AM;

  const DirIcon = positive ? TrendingUp : insight.computedImpactDeltaRon < -5 ? TrendingDown : Minus;

  const summary = (
    <span>
      <span style={{ color: impactColor }}>
        Impact {positive ? "+" : ""}{insight.computedImpactDeltaRon} RON
      </span>
      {" // "}
      <span style={{ color: confColor }}>Conf {confPct}%</span>
      {live && (
        <span className="ml-2 inline-flex items-center gap-1" style={{ color: CY }}>
          <span
            className="inline-block size-1.5 animate-pulse rounded-full"
            style={{ background: CY }}
          />
          LIVE
        </span>
      )}
    </span>
  );

  return (
    <WidgetReveal
      icon={<Sparkles className="size-3.5" style={{ color: CY }} />}
      title="OODA Action Engine"
      summary={summary}
      defaultOpen
    >
      {/* Executive narrative */}
      <p className="text-[12.5px] leading-[1.65] text-slate-300">
        {insight.observedContext}
      </p>

      {/* Impact + confidence */}
      <div className="mt-4 flex items-end gap-4">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
            Revenue impact
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <DirIcon className="size-4 shrink-0" style={{ color: impactColor }} />
            <span
              className="font-mono text-[22px] font-semibold tabular-nums"
              style={{ color: impactColor }}
            >
              {positive ? "+" : ""}{insight.computedImpactDeltaRon}
            </span>
            <span className="font-mono text-[11px] text-slate-500">RON / nt</span>
          </div>
        </div>

        <div className="ml-auto text-right">
          <div className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
            Confidence
          </div>
          <div
            className="mt-0.5 font-mono text-[22px] font-semibold tabular-nums"
            style={{ color: confColor }}
          >
            {confPct}
            <span className="text-[11px] text-slate-500">%</span>
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-2">
        <div className="h-1 overflow-hidden rounded-full bg-white/[.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confPct}%` }}
            transition={{ type: "spring", stiffness: 70, damping: 20 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${confColor}88, ${confColor})`,
              boxShadow: `0 0 8px ${confColor}44`,
            }}
          />
        </div>
      </div>

      {/* Action buttons */}
      {insight.actionableTriggers.length > 0 && (
        <div className="mt-4 space-y-2.5">
          <div className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
            Execute
          </div>
          {insight.actionableTriggers.map((a) => (
            <motion.button
              key={a.id}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
              onClick={() => onAction?.(a.id, a.targetPayload)}
              className="gx gx-tint-cyan gx-press flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/40"
            >
              <div className="flex items-center gap-2.5">
                <Zap className="size-3.5 shrink-0" style={{ color: CY }} />
                <span className="text-[12.5px] font-medium text-slate-100">{a.label}</span>
              </div>
              <ArrowRight className="size-3.5 shrink-0" style={{ color: CY }} />
            </motion.button>
          ))}
        </div>
      )}
    </WidgetReveal>
  );
}

// ─── Legacy Reveal (kept for backwards compat) ───────────────────────────────

export function Reveal({
  summary, children,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="gx gx-raised overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-3 text-left outline-none focus-visible:ring-1 focus-visible:ring-white/20"
      >
        <span className="text-[12px] text-slate-300">{summary}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
        >
          <ChevronDown className="size-3.5 text-slate-500" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[.06] px-3.5 pb-3.5 pt-3 text-[12px] leading-relaxed text-slate-400">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
