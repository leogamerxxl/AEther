"use client";

// Aether app menu - adapted from the 21st.dev "UserProfileSidebar" + the GridCard
// hover components. Retailored for Aether: a liquid-metal logo trigger revealing a
// collapsible, matte-glass menu with a featured GridCard and arrow-slide item hovers.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, ArrowRight, LogOut } from "lucide-react";
import { GridCard } from "./grid-card";
import { LiquidMetalChip } from "./liquid-metal-surface";

export interface AetherMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  badge?: string;
}
export interface AetherMenuSection {
  title: string;
  items: AetherMenuItem[];
  defaultOpen?: boolean;
}
export interface AetherMenuUser {
  name?: string;
  email: string;
  role?: string;
}
export interface AetherFeatured {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const panelV = {
  hidden: { opacity: 0, y: -8, scale: 0.98, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { type: "spring" as const, stiffness: 300, damping: 26, staggerChildren: 0.04, delayChildren: 0.05 } },
  out: { opacity: 0, y: -8, scale: 0.98, filter: "blur(6px)", transition: { duration: 0.15 } },
};
const rowV = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 200, damping: 18 } },
};

function ItemRow({ it, onPick }: { it: AetherMenuItem; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => { it.onClick?.(); onPick(); }}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[.06] hover:text-white"
    >
      <span className="grid size-4 shrink-0 place-items-center text-white/40 transition-colors group-hover:text-white/80">{it.icon}</span>
      <span className="truncate">{it.label}</span>
      {it.badge ? (
        <span className="ml-auto rounded-full bg-[#C8A165]/15 px-2 py-0.5 text-[10px] font-medium text-[#d8b277]">{it.badge}</span>
      ) : (
        <ArrowRight className="ml-auto size-3.5 -translate-x-1.5 text-white/35 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
      )}
    </button>
  );
}

function Section({ section, onPick }: { section: AetherMenuSection; onPick: () => void }) {
  const [open, setOpen] = useState(section.defaultOpen ?? false);
  return (
    <motion.div variants={rowV} className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-[11px] font-medium uppercase tracking-[.13em] text-white/40 transition-colors hover:text-white/75"
      >
        <span>{section.title}</span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="size-3.5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} className="overflow-hidden">
            <div className="space-y-0.5 pb-1.5">
              {section.items.map((it) => <ItemRow key={it.label} it={it} onPick={onPick} />)}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export function AetherMenu({ user, sections, onSignOut, featured }: { user: AetherMenuUser; sections: AetherMenuSection[]; onSignOut: () => void; featured?: AetherFeatured }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const initials = (user.name || user.email).trim().slice(0, 1).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <LiquidMetalChip
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Aether menu"
        aria-expanded={open}
        className="rounded-full py-2 pl-3.5 pr-3.5 text-[13px]"
      >
        <span className="text-[15px] font-light leading-none">&AElig;</span>
        <span className="font-light uppercase tracking-[0.22em] text-white/90">Aether</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="size-3.5 text-white/70" />
        </motion.span>
      </LiquidMetalChip>

      <AnimatePresence>
        {open ? (
          <motion.div variants={panelV} initial="hidden" animate="show" exit="out" className="gx gx-bento absolute left-0 top-[calc(100%+10px)] z-50 w-[312px] overflow-hidden p-2">
            <motion.div variants={rowV} className="flex items-center gap-3 p-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-[16px] font-semibold text-white/90">{initials}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-white">{user.name || "Account"}</div>
                <div className="truncate text-[12px] text-white/45">{user.email}</div>
              </div>
              {user.role ? <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[.1em] text-white/60">{user.role}</span> : null}
            </motion.div>

            {featured ? (
              <motion.div variants={rowV} className="px-1 pb-1.5">
                <GridCard onClick={featured.onClick} className="cursor-pointer">
                  <div className="relative flex items-center gap-3">
                    {featured.icon ? <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[.06] text-white/80">{featured.icon}</span> : null}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-white">{featured.title}</div>
                      {featured.subtitle ? <div className="truncate text-[11.5px] text-white/45">{featured.subtitle}</div> : null}
                    </div>
                    <ArrowRight className="size-4 -translate-x-1.5 text-white/35 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                </GridCard>
              </motion.div>
            ) : null}

            <motion.div variants={rowV} className="mx-2 my-1 h-px bg-white/[.07]" />

            <div className="max-h-[52vh] overflow-y-auto no-scrollbar px-1">
              {sections.map((s) => <Section key={s.title} section={s} onPick={() => setOpen(false)} />)}
            </div>

            <motion.div variants={rowV} className="mx-2 my-1 h-px bg-white/[.07]" />

            <motion.button
              variants={rowV}
              type="button"
              onClick={() => { setOpen(false); onSignOut(); }}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-[#ef8b7a] transition-colors hover:bg-[#ef8b7a]/10"
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
              <ArrowRight className="ml-auto size-3.5 -translate-x-1.5 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
            </motion.button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
