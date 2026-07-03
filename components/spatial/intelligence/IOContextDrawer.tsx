"use client";
// Premium IO context drawer - opens from IntelligencePanel and renders the full
// world-model record for one Intelligence Object: causality, evidence chain,
// provenance, confidence, freshness, severity, recommended actions, anchor, and the
// raw IO for traceability. NIGHT HARBOR: command-theme accents only (cyan = live,
// amber = money/action, neutral = idle), gx-bento glass, the one framer spring.

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { C, confidenceColor } from "@/lib/command-theme";
import { useIntelligence } from "./SpatialIntelligenceProvider";
import { toast } from "@/lib/toast";
import { SPRING, TRANSITION } from "@/lib/motion";
import { ioFreshness, evidenceCount, type IntelligenceObject, type Freshness } from "@/lib/intelligence-map";

const FRESH_COLOR: Record<Freshness, string> = {
  fresh: C.live,
  cooling: C.warn,
  stale: C.down,
  dead: C.idle,
};

function severityColor(sev: IntelligenceObject["severity"]): string {
  if (sev === "critical") return C.crit;
  if (sev === "high") return C.down;
  if (sev === "medium") return C.warn;
  return C.idle;
}

function fmtTs(ts?: string | null): string {
  return ts ? ts.slice(0, 16).replace("T", " ") : "-";
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/40">{children}</div>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-[11px] uppercase tracking-[.1em] text-white/35">{label}</span>
      <span className="text-right text-[12px] tabular-nums text-white/70">{children}</span>
    </div>
  );
}

export default function IOContextDrawer({ io, onClose }: { io: IntelligenceObject | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {io ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION.quick}
            onClick={onClose}
          />
          <motion.aside
            className="gx-bento fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-[440px] flex-col gap-4 overflow-y-auto p-5"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={SPRING}
            role="dialog"
            aria-label="Intelligence object detail"
          >
            <Drawer io={io} onClose={onClose} />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function Drawer({ io, onClose }: { io: IntelligenceObject; onClose: () => void }) {
  const fresh = ioFreshness(io);
  const pct = Math.round(io.confidence * 100);
  const recs = io.recommended_actions ?? [];
  // Kind-aware severity: a rec-bearing signal is an OPPORTUNITY - it must never paint
  // verdict-red at the peak trust moment. Harbor = action; severity text stays visible.
  const sev = recs.length > 0 ? C.money : severityColor(io.severity);
  const { source, decisions, decide } = useIntelligence();
  const decision = decisions[io.id];
  const [pending, setPending] = useState<"accepted" | "dismissed" | null>(null);
  const act = async (d: "accepted" | "dismissed") => {
    if (pending || decision) return;
    setPending(d);
    const res = await decide(io, d);
    setPending(null);
    if (!res.ok) toast(`Nu s-a putut inregistra decizia: ${res.error ?? "eroare"}`);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: sev, boxShadow: `0 0 8px ${sev}` }} />
            <span className="text-[16px] font-semibold text-white">{io.signal_type}</span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[.1em] text-white/40">
            {io.altitude_level} / {io.entity_type} / {io.severity}
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-white/40 transition-colors hover:text-white/80" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[10px] border border-white/[.06] bg-white/[.02] px-3 py-2.5">
          <Eyebrow>Confidence</Eyebrow>
          <div className="mt-1 text-[20px] font-semibold tabular-nums" style={{ color: confidenceColor(pct) }}>{pct}%</div>
        </div>
        <div className="rounded-[10px] border border-white/[.06] bg-white/[.02] px-3 py-2.5">
          <Eyebrow>Freshness</Eyebrow>
          <div className="mt-1 text-[20px] font-semibold tabular-nums" style={{ color: FRESH_COLOR[fresh] }}>{fresh}</div>
        </div>
      </div>

      {io.causal_hypothesis ? (
        <div>
          <Eyebrow>Causal hypothesis</Eyebrow>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/75">{io.causal_hypothesis}</p>
        </div>
      ) : null}

      <div>
        <Eyebrow>Recommended actions</Eyebrow>
        {recs.length > 0 ? (
          <>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {recs.map((a, i) => (
                <li
                  key={i}
                  className="rounded-md border px-3 py-2 text-[12.5px] text-white/85"
                  style={{ borderColor: C.moneySoft, background: C.moneySoft }}
                >
                  {String(a.label ?? a.type ?? "action")}
                </li>
              ))}
            </ul>
            {decision ? (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-white/[.08] bg-white/[.03] px-3 py-2 text-[12px]">
                <span className="size-1.5 rounded-full" style={{ background: decision.decision === "accepted" ? C.money : C.idle }} />
                <span className="text-white/75">
                  {decision.decision === "accepted" ? "Decizie inregistrata: acceptata" : "Decizie inregistrata: respinsa"}
                </span>
                <span className="ml-auto tabular-nums text-white/40">{fmtTs(decision.decided_at)}</span>
              </div>
            ) : source === "live" ? (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => act("accepted")}
                  disabled={pending !== null}
                  aria-label="Accepta recomandarea"
                  className="flex-1 rounded-[10px] border px-3 py-2 text-[12.5px] font-medium text-white/90 transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{ borderColor: C.money, background: C.moneySoft }}
                >
                  {pending === "accepted" ? "Se inregistreaza..." : "Accepta"}
                </button>
                <button
                  onClick={() => act("dismissed")}
                  disabled={pending !== null}
                  aria-label="Respinge recomandarea"
                  className="flex-1 rounded-[10px] border border-white/[.12] px-3 py-2 text-[12.5px] font-medium text-white/60 transition-opacity duration-200 hover:text-white/85 disabled:opacity-50"
                >
                  {pending === "dismissed" ? "Se inregistreaza..." : "Respinge"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-1.5 text-[12.5px] text-white/45">No recommendation - data below the action threshold (Truth Doctrine).</p>
        )}
      </div>

      <div>
        <Eyebrow>Evidence chain ({evidenceCount(io)} observations)</Eyebrow>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {(io.evidence ?? []).map((e, i) => (
            <div key={i} className="rounded-[10px] border border-white/[.06] bg-white/[.02] px-3 py-2">
              <div className="flex items-center justify-between text-[11px] text-white/55">
                <span className="font-mono">{e.source_id ?? "source"}</span>
                <span className="tabular-nums">{fmtTs(e.observed_at)}</span>
              </div>
              <div className="mt-1 text-[11px] tabular-nums text-white/35">
                {(e.observation_ids?.length ?? 0)} obs{e.coverage != null ? ` / coverage ${e.coverage}` : ""}
              </div>
              {e.observation_ids && e.observation_ids.length > 0 ? (
                <div className="mt-1 break-all font-mono text-[10px] text-white/30">
                  {e.observation_ids.slice(0, 6).join(", ")}
                  {e.observation_ids.length > 6 ? " ..." : ""}
                </div>
              ) : null}
            </div>
          ))}
          {(io.evidence ?? []).length === 0 ? <p className="text-[12px] text-white/40">No evidence attached.</p> : null}
        </div>
      </div>

      <div className="border-t border-white/[.06] pt-3">
        <Eyebrow>Provenance &amp; traceability</Eyebrow>
        <div className="mt-1">
          <Row label="IO id"><span className="font-mono">{io.id}</span></Row>
          <Row label="Status">{io.status}</Row>
          <Row label="Observed">{fmtTs(io.observed_at)}</Row>
          <Row label="Expires">{fmtTs(io.expires_at)}</Row>
          <Row label="Anchor">{io.visual_anchor?.label ?? io.visual_anchor?.property_id ?? "-"}</Row>
          <Row label="Entity">{io.entity_id ?? "-"}</Row>
        </div>
      </div>

      {io.raw_jsonb ? (
        <details>
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[.14em] text-white/40">Raw IO payload</summary>
          <pre className="mt-2 overflow-x-auto rounded-[10px] border border-white/[.06] bg-black/40 p-3 font-mono text-[10.5px] leading-relaxed text-white/55">
{JSON.stringify(io.raw_jsonb, null, 2)}
          </pre>
        </details>
      ) : null}
    </>
  );
}