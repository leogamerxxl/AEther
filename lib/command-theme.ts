// Aether command-center semantic theme.
//
// One accent system, used by every command primitive:
//   live    = cyan    -> "now / selected / real-time" (the primary accent)
//   money   = amber   -> "revenue / pricing"
//   risk    = red     -> "loss / critical"
//   up      = emerald -> "positive / opportunity"
//   warn    = amber   -> "watch"
// Cyan-primary, amber-for-money per the command-center direction.

export const C = {
  live: "#22D3EE",
  liveSoft: "rgba(34,211,238,0.12)",
  money: "#e6b566",
  moneySoft: "rgba(230,181,102,0.12)",
  up: "#5fd0a0",
  upSoft: "rgba(95,208,160,0.12)",
  down: "#ef8b7a",
  downSoft: "rgba(239,139,122,0.12)",
  crit: "#ef6a55",
  critSoft: "rgba(239,106,85,0.16)",
  warn: "#e6b566",
  warnSoft: "rgba(230,181,102,0.12)",
  idle: "rgba(255,255,255,0.42)",
  idleSoft: "rgba(255,255,255,0.08)",
} as const;

export type IntelKind = "opportunity" | "risk" | "recommendation";

export interface KindMeta {
  label: string;
  color: string;
  tint: string;
}

export const KIND: Record<IntelKind, KindMeta> = {
  opportunity:    { label: "Opportunity",    color: C.up,   tint: C.upSoft },
  risk:           { label: "Risk",           color: C.down, tint: C.downSoft },
  recommendation: { label: "Recommendation", color: C.live, tint: C.liveSoft },
};

export type Severity = "info" | "warn" | "critical";

export const SEVERITY: Record<Severity, { color: string; tint: string; label: string }> = {
  info:     { color: C.live, tint: C.liveSoft, label: "Info" },
  warn:     { color: C.warn, tint: C.warnSoft, label: "Watch" },
  critical: { color: C.crit, tint: C.critSoft, label: "Critical" },
};

export type StatusLevel = "live" | "ok" | "warn" | "critical" | "idle";

export const STATUS: Record<StatusLevel, { color: string; pulse: boolean }> = {
  live:     { color: C.live, pulse: true },
  ok:       { color: C.up,   pulse: false },
  warn:     { color: C.warn, pulse: true },
  critical: { color: C.crit, pulse: true },
  idle:     { color: C.idle, pulse: false },
};

/** Confidence -> color band (reassuring high, cautioning low). */
export function confidenceColor(pct: number): string {
  if (pct >= 75) return C.up;
  if (pct >= 50) return C.live;
  if (pct >= 30) return C.warn;
  return C.down;
}

/** RON formatter shared across command surfaces. */
export function ron(n: number): string {
  return n.toLocaleString("en-US");
}
