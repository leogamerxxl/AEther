"use client";
// Renders live intelligence_objects (canonical world-model signals) in the spatial
// UI, or a clearly-labeled SAMPLE / DEMO state when no live rows exist.
//
// NIGHT HARBOR compliance: all accents come from lib/command-theme (cyan = live,
// neutral idle = sample - never harbor amber, which is reserved for money/action).
// No intelligence and no color literals are introduced here.

import { useState } from "react";
import { Card } from "@/components/ui/heroui-card";
import { C, confidenceColor } from "@/lib/command-theme";
import { useIntelligence } from "./SpatialIntelligenceProvider";
import {
  ioFreshness,
  evidenceCount,
  type Freshness,
  type IntelligenceObject,
} from "@/lib/intelligence-map";
import IOContextDrawer from "./IOContextDrawer";

// IO severity -> command-theme accent (signal cools / warms by role; no literals).
function severityColor(sev: IntelligenceObject["severity"]): string {
  if (sev === "critical") return C.crit;
  if (sev === "high") return C.down;
  if (sev === "medium") return C.warn;
  return C.idle; // info / low
}

// Freshness -> accent: live signal cools as it ages (NIGHT HARBOR Section 5).
const FRESH_COLOR: Record<Freshness, string> = {
  fresh: C.live,
  cooling: C.warn,
  stale: C.down,
  dead: C.idle,
};

export default function IntelligencePanel() {
  const { source, objects } = useIntelligence();
  const live = source === "live";
  const [selected, setSelected] = useState<IntelligenceObject | null>(null);

  return (
    <>
    <Card className="col-span-12 gap-3 p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/45">
          Intelligence objects
        </div>
        {live ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium tabular-nums"
            style={{ color: C.live, borderColor: C.live + "55", background: C.liveSoft }}
          >
            <span className="size-1.5 rounded-full" style={{ background: C.live, boxShadow: `0 0 8px ${C.live}` }} />
            LIVE / {objects.length} {objects.length === 1 ? "signal" : "signals"}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide"
            style={{ color: C.idle, borderColor: C.idleSoft, background: C.idleSoft }}
          >
            Sample / Demo
          </span>
        )}
      </div>

      {!live ? (
        <p className="text-[12.5px] leading-relaxed text-white/45">
          No live intelligence for your tenant yet - showing the sample scaffold. Signals appear
          here once the engine writes to{" "}
          <span className="font-mono text-white/60">intelligence_objects</span>.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {objects.slice(0, 6).map((io) => {
            const fresh = ioFreshness(io);
            const sev = severityColor(io.severity);
            const pct = Math.round(io.confidence * 100);
            const recs = io.recommended_actions?.length ?? 0;
            return (
              <li key={io.id}>
                <button type="button" onClick={() => setSelected(io)} className="w-full rounded-[10px] border border-white/[.06] bg-white/[.02] px-3 py-2.5 text-left transition-colors hover:bg-white/[.04]">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: sev, boxShadow: `0 0 6px ${sev}` }} />
                  <span className="text-[14px] font-semibold text-white">{io.signal_type}</span>
                  <span className="text-[11px] text-white/40">
                    {io.altitude_level} / {io.entity_type}
                  </span>
                  <span className="ml-auto text-[11px] tabular-nums" style={{ color: confidenceColor(pct) }}>
                    {pct}%
                  </span>
                  <span className="text-[11px] tabular-nums" style={{ color: FRESH_COLOR[fresh] }}>
                    {fresh}
                  </span>
                </div>
                {io.causal_hypothesis ? (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">{io.causal_hypothesis}</p>
                ) : null}
                <div className="mt-1.5 flex items-center gap-3 text-[11px] tabular-nums text-white/35">
                  <span>{evidenceCount(io)} observations</span>
                  <span>
                    {recs > 0 ? `${recs} recommended ${recs === 1 ? "action" : "actions"}` : "no recommendation"}
                  </span>
                  {io.visual_anchor?.label ? <span className="ml-auto">{io.visual_anchor.label}</span> : null}
                </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
    <IOContextDrawer io={selected} onClose={() => setSelected(null)} />
    </>
  );
}