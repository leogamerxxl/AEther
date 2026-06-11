"use client";

// Aether command-center primitives.
//
// The reusable intelligence kit: panels, intel cards (opportunity / risk /
// recommendation), alerts, status + confidence indicators, signal chips, metric
// readouts and the map layer selector. Built on the existing matte-glass
// (gx-bento) language and the command-theme color system. Every intel surface
// answers: what is happening, why, what happens next, and what to do.

import * as React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, AlertTriangle, Sparkles, ArrowRight, X,
  Activity, Radio, type LucideIcon,
} from "lucide-react";
import { CountUp, LiveSparkline } from "./live-charts";
import { CardBackdrop, type MotifName } from "./motifs";
import { cn } from "@/lib/utils";
import {
  C, KIND, SEVERITY, STATUS, confidenceColor, ron,
  type IntelKind, type Severity, type StatusLevel,
} from "@/lib/command-theme";

// ── StatusDot ───────────────────────────────────────────────────────────────
export function StatusDot({ level = "live", label, size = 7 }: { level?: StatusLevel; label?: string; size?: number }) {
  const s = STATUS[level];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
        {s.pulse ? (
          <span className="absolute inset-0 rounded-full" style={{ background: s.color, opacity: 0.5, animation: "gxping 2.2s ease-out infinite" }} />
        ) : null}
        <span className="rounded-full" style={{ width: size, height: size, background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
      </span>
      {label ? <span className="text-[11px] font-medium" style={{ color: s.color }}>{label}</span> : null}
    </span>
  );
}

// ── Delta ───────────────────────────────────────────────────────────────────
export function Delta({ v, suffix = "%", money = false }: { v: number; suffix?: string; money?: boolean }) {
  const up = v >= 0;
  const color = money ? C.money : up ? C.up : C.down;
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums" style={{ color }}>
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {up ? "+" : ""}{v}{suffix}
    </span>
  );
}

// ── ConfidenceMeter (segmented signal-strength bar) ───────────────────────────
export function ConfidenceMeter({ pct, label = "Confidence", segments = 10 }: { pct: number; label?: string; segments?: number }) {
  const color = confidenceColor(pct);
  const filled = Math.round((pct / 100) * segments);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[.12em] text-white/35">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>{pct}%</span>
      </div>
      <div className="flex items-center gap-[3px]">
        {Array.from({ length: segments }).map((_, i) => (
          <span key={i} className="h-[6px] flex-1 rounded-[2px] transition-colors" style={{ background: i < filled ? color : "rgba(255,255,255,0.08)" }} />
        ))}
      </div>
    </div>
  );
}

// ── SignalChip ────────────────────────────────────────────────────────────────
export function SignalChip({ icon: Icon = Radio, label, value, delta, tone = "live" }: { icon?: LucideIcon; label: string; value?: string; delta?: number; tone?: "live" | "money" | "up" | "down" | "idle" }) {
  const color = tone === "money" ? C.money : tone === "up" ? C.up : tone === "down" ? C.down : tone === "idle" ? C.idle : C.live;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-white/[.03] px-3 py-1.5">
      <Icon className="size-3.5" style={{ color }} />
      <span className="text-[12px] text-white/65">{label}</span>
      {value ? <span className="text-[12px] font-semibold tabular-nums text-white">{value}</span> : null}
      {delta !== undefined ? <Delta v={delta} /> : null}
    </span>
  );
}

// ── CommandPanel ──────────────────────────────────────────────────────────────
export function CommandPanel({
  title, eyebrow, status, actions, className, children, motif,
}: {
  title: React.ReactNode; eyebrow?: string; status?: { level: StatusLevel; label?: string };
  actions?: React.ReactNode; className?: string; children: React.ReactNode; motif?: MotifName;
}) {
  return (
    <section className={cn("group gx gx-bento relative overflow-hidden", className)}>
      {motif ? <CardBackdrop name={motif} className="text-white" /> : null}
      <header className="flex items-center justify-between gap-3 border-b border-white/[.07] px-4 py-3">
        <div className="min-w-0">
          {eyebrow ? <div className="text-[10px] font-medium uppercase tracking-[.16em] text-white/35">{eyebrow}</div> : null}
          <div className="truncate text-[14px] font-semibold text-white">{title}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {status ? <StatusDot level={status.level} label={status.label} /> : null}
          {actions}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

// ── IntelCard (opportunity / risk / recommendation) ───────────────────────────
const KIND_ICON: Record<IntelKind, LucideIcon> = {
  opportunity: TrendingUp,
  risk: AlertTriangle,
  recommendation: Sparkles,
};

function KindGlyph({ kind, color }: { kind: IntelKind; color: string }) {
  return (
    <span className="pointer-events-none absolute -right-2 -top-2 z-[1] h-20 w-24 opacity-[.08] transition-all duration-500 group-hover:-translate-y-0.5 group-hover:opacity-[.18]" style={{ color }} aria-hidden>
      {kind === "opportunity" ? (
        <svg viewBox="0 0 96 80" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6,60 26,44 42,52 62,24 78,32 92,10" /><path d="M78 10 H92 V24" />
        </svg>
      ) : kind === "risk" ? (
        <svg viewBox="0 0 96 80" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 24 Q20 10 36 28 T68 32 T96 20" /><path d="M48 44 V70 M40 62 L48 72 L56 62" />
        </svg>
      ) : (
        <svg viewBox="0 0 96 80" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="52" cy="36" r="20" opacity="0.7" /><circle cx="52" cy="36" r="30" opacity="0.4" /><path d="M52 6 v8 M52 58 v8 M22 36 h8 M74 36 h8" />
        </svg>
      )}
    </span>
  );
}

function IntelRow({ tag, color, children }: { tag: string; color: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex gap-2.5">
      <span className="mt-[2px] w-[58px] shrink-0 text-[9.5px] font-semibold uppercase tracking-[.12em]" style={{ color }}>{tag}</span>
      <span className="flex-1 text-[12.5px] leading-relaxed text-white/70">{children}</span>
    </div>
  );
}

export interface IntelCardProps {
  kind: IntelKind;
  title: string;
  signal: string;
  context?: string;
  forecast?: string;
  action?: string;
  impact?: { label: string; valueRon?: number; deltaPct?: number };
  confidencePct?: number;
  when?: string;
  source?: string;
  onAct?: () => void;
  actLabel?: string;
}

export function IntelCard({
  kind, title, signal, context, forecast, action, impact, confidencePct, when, source, onAct, actLabel = "Apply",
}: IntelCardProps) {
  const meta = KIND[kind];
  const Icon = KIND_ICON[kind];
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}
      className="group gx gx-bento relative overflow-hidden p-4"
      style={{ borderLeft: `2px solid ${meta.color}` }}
    >
      <KindGlyph kind={kind} color={meta.color} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md" style={{ background: meta.tint, color: meta.color }}><Icon className="size-3.5" /></span>
          <span className="text-[10px] font-semibold uppercase tracking-[.14em]" style={{ color: meta.color }}>{meta.label}</span>
        </div>
        {when ? <span className="rounded-md bg-white/[.06] px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/55">{when}</span> : null}
      </div>

      <h3 className="mt-2.5 text-[15px] font-semibold leading-snug text-white">{title}</h3>

      <div className="mt-3 flex flex-col gap-2">
        <IntelRow tag="Signal" color={meta.color}>{signal}</IntelRow>
        {context ? <IntelRow tag="Context" color="rgba(255,255,255,0.35)">{context}</IntelRow> : null}
        {forecast ? <IntelRow tag="Forecast" color="rgba(255,255,255,0.35)">{forecast}</IntelRow> : null}
        {action ? <IntelRow tag="Action" color={C.money}>{action}</IntelRow> : null}
      </div>

      {(impact || confidencePct !== undefined) ? (
        <div className="mt-3.5 flex items-end justify-between gap-4 border-t border-white/[.06] pt-3">
          {impact ? (
            <div>
              <div className="text-[10px] uppercase tracking-[.12em] text-white/35">{impact.label}</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                {impact.valueRon !== undefined ? <span className="text-[20px] font-semibold leading-none tabular-nums" style={{ color: C.money }}>+{ron(impact.valueRon)}<span className="ml-1 text-[11px] font-normal text-white/35">RON</span></span> : null}
                {impact.deltaPct !== undefined ? <Delta v={impact.deltaPct} /> : null}
              </div>
            </div>
          ) : <span />}
          {confidencePct !== undefined ? <div className="w-[130px] shrink-0"><ConfidenceMeter pct={confidencePct} /></div> : null}
        </div>
      ) : null}

      <div className="mt-3.5 flex items-center justify-between gap-3">
        {source ? <span className="inline-flex items-center gap-1.5 text-[10.5px] text-white/30"><Activity className="size-3" /> {source}</span> : <span />}
        {onAct ? (
          <button onClick={onAct} className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors" style={{ background: meta.tint, color: meta.color }}>
            {actLabel} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : null}
      </div>
    </motion.article>
  );
}

// ── AlertBanner ───────────────────────────────────────────────────────────────
export function AlertBanner({
  severity = "warn", title, message, when, actionLabel, onAction, onDismiss,
}: {
  severity?: Severity; title: string; message?: string; when?: string;
  actionLabel?: string; onAction?: () => void; onDismiss?: () => void;
}) {
  const s = SEVERITY[severity];
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="gx gx-bento flex items-center gap-3 overflow-hidden py-2.5 pl-3 pr-2.5"
      style={{ borderLeft: `2px solid ${s.color}` }}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: s.tint, color: s.color }}>
        <AlertTriangle className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-white">{title}</span>
          {when ? <span className="shrink-0 text-[10px] tabular-nums text-white/40">{when}</span> : null}
        </div>
        {message ? <div className="truncate text-[11.5px] text-white/50">{message}</div> : null}
      </div>
      {actionLabel && onAction ? (
        <button onClick={onAction} className="shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors" style={{ background: s.tint, color: s.color }}>{actionLabel}</button>
      ) : null}
      {onDismiss ? (
        <button onClick={onDismiss} aria-label="Dismiss" className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/[.06] hover:text-white"><X className="size-4" /></button>
      ) : null}
    </motion.div>
  );
}

// ── MetricReadout ─────────────────────────────────────────────────────────────
export function MetricReadout({
  label, value, unit, delta, spark, tone = "live", motif, className,
}: {
  label: string; value: string; unit?: string; delta?: { v: number; money?: boolean };
  spark?: number[]; tone?: "live" | "money" | "up"; motif?: MotifName; className?: string;
}) {
  const accent = tone === "money" ? C.money : tone === "up" ? C.up : C.live;
  const num = parseFloat(value.replace(/[^0-9.\-]/g, ""));
  const decimals = value.includes(".") ? (value.split(".")[1]?.length ?? 0) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={cn("group gx gx-bento relative flex flex-col gap-2 overflow-hidden p-4", className)}>
      {motif ? <CardBackdrop name={motif} className="text-white" /> : null}
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[.14em] text-white/40">{label}</span>
        {delta ? <Delta v={delta.v} money={delta.money} /> : null}
      </div>
      <div className="text-[26px] font-semibold leading-none tabular-nums text-white">
        {Number.isFinite(num) ? <CountUp value={num} decimals={decimals} /> : value}{unit ? <span className="text-[13px] font-normal text-white/35">{unit}</span> : null}
      </div>
      {spark ? <div className="mt-1 h-8"><LiveSparkline data={spark} stroke={accent} /></div> : null}
    </motion.div>
  );
}

// ── LayerSelector ─────────────────────────────────────────────────────────────
export interface MapLayer { id: string; label: string; color: string; count?: number; active: boolean }

export function LayerSelector({ layers, onToggle, title = "Layers" }: { layers: MapLayer[]; onToggle: (id: string) => void; title?: string }) {
  return (
    <div className="gx gx-bento overflow-hidden">
      <div className="border-b border-white/[.07] px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[.16em] text-white/40">{title}</div>
      <div className="flex flex-col p-1.5">
        {layers.map((l) => (
          <button key={l.id} onClick={() => onToggle(l.id)} className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[.05]">
            <span className="size-2.5 shrink-0 rounded-[3px] transition-all" style={{ background: l.active ? l.color : "transparent", border: `1.5px solid ${l.active ? l.color : "rgba(255,255,255,0.25)"}`, boxShadow: l.active ? `0 0 8px ${l.color}` : "none" }} />
            <span className={cn("flex-1 text-left text-[12.5px] font-medium transition-colors", l.active ? "text-white/85" : "text-white/45")}>{l.label}</span>
            {l.count !== undefined ? <span className="text-[11px] tabular-nums text-white/35">{l.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SmartSuggestion ───────────────────────────────────────────────────────────
export function SmartSuggestion({ text, confidencePct, accent = C.live, onApply }: { text: string; confidencePct?: number; accent?: string; onApply?: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2.5">
      <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ background: `${accent}22`, color: accent }}><Sparkles className="size-3.5" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[9.5px] font-semibold uppercase tracking-[.14em] text-white/35">Smart suggestion</div>
        <div className="truncate text-[12.5px] text-white/80">{text}</div>
      </div>
      {confidencePct !== undefined ? <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: accent }}>{confidencePct}%</span> : null}
      {onApply ? <button onClick={onApply} className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-opacity hover:opacity-80" style={{ background: `${accent}22`, color: accent }}>Apply</button> : null}
    </div>
  );
}
