"use client";

// Corridor Pressure - surfaces the migration-risk engine (correlationEngine) as
// a strategic panel inside Revenue Command. Answers "if I hold my rate, do my
// guests defect to Bulgaria / Greece?" using the real, tested computation.

import { ShieldAlert, ArrowRight, Waves } from "lucide-react";
import { Card } from "@/components/ui/heroui-card";
import type { RiskFactor, RiskLevel } from "@/lib/analytics/types";
import { deriveMigrationRisk, eurToRon } from "@/lib/migration-intel";
import { cn } from "@/lib/utils";

const RISK_META: Record<RiskLevel, { label: string; color: string; tint: string }> = {
  safe:     { label: "Stable",   color: "#5fd0a0", tint: "rgba(95,208,160,0.12)" },
  watch:    { label: "Watch",    color: "#e6b566", tint: "rgba(230,181,102,0.12)" },
  alert:    { label: "Alert",    color: "#ef8b7a", tint: "rgba(239,139,122,0.12)" },
  critical: { label: "Critical", color: "#ef6a55", tint: "rgba(239,106,85,0.16)" },
};

const SEVERITY_COLOR: Record<RiskFactor["severity"], string> = {
  info:     "rgba(255,255,255,0.45)",
  low:      "#5fd0a0",
  medium:   "#e6b566",
  high:     "#e6b566",
  critical: "#ef8b7a",
};

export default function CorridorPressure() {
  const m = deriveMigrationRisk();
  const meta = RISK_META[m.riskLevel];
  const pct = Math.round(m.migrationProbability * 100);
  const adjPct = Math.round(m.recommendedAdrAdjustmentPct * 1000) / 10;
  const suggestedRon = m.suggestedAdrEur ? eurToRon(m.suggestedAdrEur) : null;
  const currentRon = eurToRon(m.inputVector.romanianBaseAdrEur);
  const topFactors = m.riskFactors.filter((f) => f.contribution > 0).slice(0, 4);
  const maxContribution = Math.max(...topFactors.map((f) => f.contribution), 0.0001);

  return (
    <>
      {/* Migration pressure - the strategic read */}
      <Card className="col-span-12 gap-4 p-5 lg:col-span-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.14em] text-cyan-300/70">
            <Waves className="size-3.5" /> Corridor pressure &middot; Bulgaria / Greece
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ color: meta.color, background: meta.tint }}
          >
            <ShieldAlert className="size-3" /> {meta.label}
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-[10px] uppercase tracking-[.12em] text-white/35">Guest defection probability</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[44px] font-semibold leading-none tabular-nums" style={{ color: meta.color }}>{pct}%</span>
              <span className="text-[12px] text-white/40">{m.confidence ? Math.round(m.confidence * 100) : 0}% confidence</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[.12em] text-white/35">Recommended ADR move</div>
            <div className="mt-1 flex items-center justify-end gap-2 text-[14px] text-white/55">
              <span className="tabular-nums">{currentRon} RON</span>
              <ArrowRight className="size-4 text-white/30" />
              <span className="font-semibold tabular-nums text-white">{suggestedRon ?? currentRon} RON</span>
            </div>
            <div className="mt-1 text-[11px] tabular-nums" style={{ color: adjPct >= 0 ? "#5fd0a0" : "#e6b566" }}>
              {adjPct >= 0 ? "+" : ""}{adjPct}% &middot; {m.inputVector.competitorDestination.replace(/_/g, " ")}
            </div>
          </div>
        </div>

        <div
          className="rounded-xl border px-4 py-3 text-[12.5px] leading-relaxed"
          style={{ borderColor: meta.tint, background: meta.tint, color: "rgba(245,242,238,0.82)" }}
        >
          {m.recommendation}
        </div>
      </Card>

      {/* Defection drivers - the weighted factors */}
      <Card className="col-span-12 gap-3 lg:col-span-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.12em] text-white/40">
          <ShieldAlert className="size-3.5" /> Defection drivers
        </div>
        <div className="flex flex-col gap-3 pt-0.5">
          {topFactors.map((f) => {
            const color = SEVERITY_COLOR[f.severity];
            const w = Math.round((f.contribution / maxContribution) * 100);
            return (
              <div key={f.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[12.5px] text-white/65">{f.label}</span>
                  <span className="shrink-0 text-[11px] font-medium tabular-nums" style={{ color }}>
                    {Math.round(f.contribution * 100)}%
                  </span>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full bg-white/[.06]">
                  <div className="h-full rounded-full" style={{ width: w + "%", background: color }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className={cn("mt-auto pt-1 text-[10.5px] text-white/30")}>
          Weighted macro model &middot; Neptun-Bulgaria corridor
        </div>
      </Card>
    </>
  );
}
