"use client";
// BriefMode - the morning brief, in-app. Left: the brief ledger (date + delivery
// truth: generat / trimis / deschis). Right: the exact rendered_html the owner
// receives by email, isolated in a sandboxed iframe so email CSS and app CSS
// never touch. Same artifact in inbox and in the world - one truth.

import { useEffect, useState } from "react";
import { C } from "@/lib/command-theme";
import { useBriefList, fetchBriefHtml, roDate, type BriefMeta } from "@/lib/mode-data";
import ModePane, { PaneEmpty, PaneSkeleton } from "./ModePane";

function deliveryChip(b: BriefMeta): { label: string; color: string } {
  if (b.opened_at) return { label: "deschis", color: C.up };
  if (b.sent_at) return { label: "trimis " + b.sent_at.slice(11, 16), color: C.live };
  return { label: "netrimis", color: C.idle };
}

export default function BriefMode({ onClose }: { onClose: () => void }) {
  const { loading, error, data } = useBriefList();
  const [sel, setSel] = useState<string | null>(null);
  const [html, setHtml] = useState<Record<string, string | null>>({});
  const selId = sel ?? data[0]?.id ?? null;

  useEffect(() => {
    if (!selId || html[selId] !== undefined) return;
    let alive = true;
    fetchBriefHtml(selId)
      .then((h) => { if (alive) setHtml((m) => ({ ...m, [selId]: h })); })
      .catch(() => { if (alive) setHtml((m) => ({ ...m, [selId]: null })); });
    return () => { alive = false; };
  }, [selId, html]);

  const body = selId ? html[selId] : undefined;

  return (
    <ModePane title="Brief" subtitle="acelasi brief care ajunge pe email, la 07:00" wide onClose={onClose}>
      {loading ? <PaneSkeleton /> : error ? (
        <PaneEmpty>Nu am putut citi brief-urile: {error}</PaneEmpty>
      ) : data.length === 0 ? (
        <PaneEmpty>Niciun brief generat inca - pipeline-ul de dimineata il va scrie aici.</PaneEmpty>
      ) : (
        <div className="flex h-full min-h-0 gap-3">
          <div className="flex w-[218px] shrink-0 flex-col gap-1.5 overflow-y-auto">
            {data.map((b) => {
              const chip = deliveryChip(b);
              const active = b.id === selId;
              return (
                <button key={b.id} onClick={() => setSel(b.id)}
                  className={"rounded-[10px] border px-3 py-2 text-left transition-colors duration-200 " +
                    (active ? "border-white/[.14] bg-white/[.05]" : "border-white/[.06] bg-white/[.02] hover:bg-white/[.04]")}>
                  <div className="text-[12px] text-white/85">{roDate(b.brief_date)}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px]" style={{ color: chip.color }}>
                    <span className="size-1 rounded-full" style={{ background: chip.color }} />
                    <span className="tabular-nums">{chip.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="min-h-0 min-w-0 flex-1">
            {body === undefined ? (
              <div className="h-full animate-pulse rounded-[14px] bg-white/[.04]" />
            ) : body === null ? (
              <PaneEmpty>Brief-ul din aceasta zi nu are continut redat.</PaneEmpty>
            ) : (
              <iframe sandbox="" srcDoc={body} title="Morning brief"
                className="h-full min-h-[420px] w-full rounded-[14px] border border-white/[.06] bg-white" />
            )}
          </div>
        </div>
      )}
    </ModePane>
  );
}