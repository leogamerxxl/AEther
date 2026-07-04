"use client";
// ModePane - the shared shell for the world's non-map modes. One matte pane over
// the dimmed world (the map stays alive beneath - modes are lenses, not pages).
// Chrome (z-82) stays above the scrim so mode switching is always one click away.

import { useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { TRANSITION } from "@/lib/motion";

export default function ModePane({ title, subtitle, wide, onClose, children }: {
  title: string; subtitle?: string; wide?: boolean; onClose: () => void; children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] hidden items-start justify-center pb-6 pt-20 lg:flex"
         style={{ background: "rgba(2,3,5,.55)" }} onClick={onClose}>
      <motion.section
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={TRANSITION.standard}
        onClick={(e) => e.stopPropagation()}
        className={"gx gx-matte flex max-h-[calc(100dvh-104px)] w-full flex-col overflow-hidden rounded-[26px] p-5 " +
          (wide ? "max-w-[1080px]" : "max-w-[880px]")}
        role="region" aria-label={title}
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[22px] font-light tracking-tight text-white/95">{title}</h2>
          <div className="flex items-center gap-3">
            {subtitle ? <span className="text-[11px] text-white/40">{subtitle}</span> : null}
            <button onClick={onClose} aria-label="Inapoi la harta"
                    className="rounded-md p-1.5 text-white/40 transition-colors duration-200 hover:text-white/80">
              <X className="size-4" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      </motion.section>
    </div>
  );
}

export function PaneLabel({ children }: { children: ReactNode }) {
  return <div className="text-[9px] font-semibold uppercase tracking-[.12em] text-white/40">{children}</div>;
}

export function PaneCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[14px] border border-white/[.06] bg-white/[.02] p-3 ${className}`}>{children}</div>;
}

export function PaneEmpty({ children }: { children: ReactNode }) {
  return <div className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-4 text-[12px] text-white/45">{children}</div>;
}

export function PaneSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[14px] border border-white/[.06] bg-white/[.02] p-4">
          <div className="h-3 w-2/3 animate-pulse rounded-[4px] bg-white/[.06]" />
        </div>
      ))}
    </div>
  );
}