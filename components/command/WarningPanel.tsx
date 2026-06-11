"use client";

// WarningPanel - glass, collapsible, grouped, expandable alerts in the spirit of
// the reference. Each alert expands to reveal affected items + a recommendation.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Sparkles, type LucideIcon } from "lucide-react";
import { SEVERITY, type Severity } from "@/lib/command-theme";
import { cn } from "@/lib/utils";

export interface AffectedItem { label: string; detail?: string }
export interface ExpandableAlert {
  id: string;
  count?: number;
  severity: Severity;
  title: string;
  ago: string;
  affectedLabel?: string;
  affected?: AffectedItem[];
  recommend?: string;
}
export interface AlertGroup { label: string; sub?: string; icon?: LucideIcon; items: ExpandableAlert[] }

function AlertRow({ a }: { a: ExpandableAlert }) {
  const [open, setOpen] = useState(false);
  const s = SEVERITY[a.severity];
  const expandable = !!(a.affected?.length || a.recommend);
  return (
    <div className="overflow-hidden rounded-xl border border-white/[.06]" style={{ background: open ? s.tint : "rgba(255,255,255,.02)" }}>
      <button onClick={() => expandable && setOpen((o) => !o)} className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left", expandable && "cursor-pointer")}>
        {a.count !== undefined ? (
          <span className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: s.color }}>{a.count}</span>
        ) : <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white">{a.title}</div>
          <div className="text-[11px] text-white/40">{a.ago}</div>
        </div>
        {expandable ? (open ? <ChevronUp className="size-4 shrink-0 text-white/40" /> : <ChevronDown className="size-4 shrink-0 text-white/40" />) : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} className="overflow-hidden">
            <div className="px-3 pb-3">
              {a.affectedLabel ? <div className="mb-2 text-[11px] text-white/40">{a.affectedLabel}</div> : null}
              <div className="flex flex-col gap-2">
                {a.affected?.map((it) => (
                  <div key={it.label} className="border-l-2 pl-2.5" style={{ borderColor: s.color }}>
                    <div className="text-[12.5px] text-white/80">{it.label}</div>
                    {it.detail ? <div className="text-[11px] text-white/45">{it.detail}</div> : null}
                  </div>
                ))}
              </div>
              {a.recommend ? (
                <div className="mt-2.5 flex items-center gap-2 text-[12px]">
                  <Sparkles className="size-3.5" style={{ color: s.color }} />
                  <span className="text-white/45">Recommend</span>
                  <span className="text-white/80">{a.recommend}</span>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function WarningPanel({ groups, title = "Warning" }: { groups: AlertGroup[]; title?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="gx gx-bento overflow-hidden">
      <button onClick={() => setCollapsed((c) => !c)} className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5">
        <span className="text-[16px] font-semibold text-white">{title}</span>
        {collapsed ? <ChevronDown className="size-4.5 text-white/50" /> : <ChevronUp className="size-4.5 text-white/50" />}
      </button>
      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeOut" }} className="overflow-hidden">
            <div className="flex flex-col gap-4 px-4 pb-4">
              {groups.map((g) => {
                const Icon = g.icon;
                return (
                  <div key={g.label}>
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-white/85">
                      {Icon ? <Icon className="size-4 text-white/55" /> : null}
                      {g.label} {g.sub ? <span className="text-white/40">({g.sub})</span> : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      {g.items.map((a) => <AlertRow key={a.id} a={a} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
