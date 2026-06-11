"use client";

// Aether Settings - a real, persisted settings surface replacing the menu's
// "coming soon" toasts. Matte-glass modal, section rail, working controls.
// Persists to localStorage via lib/prefs; reduce-motion and profile name take
// effect immediately.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Bell, Palette, Database, Gem, Check } from "lucide-react";
import { updateProfile, type Session } from "@/lib/auth";
import {
  DEFAULT_PREFS as DEFAULT_FALLBACK,
  loadPrefs,
  savePrefs,
  applyReduceMotion,
  type Prefs,
  type Currency,
  type Cadence,
} from "@/lib/prefs";

export type SettingsSection = "profile" | "notifications" | "display" | "data" | "plan";

const NAV: { key: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { key: "profile", label: "Profile", icon: <User className="size-4" /> },
  { key: "notifications", label: "Notifications", icon: <Bell className="size-4" /> },
  { key: "display", label: "Display", icon: <Palette className="size-4" /> },
  { key: "data", label: "Data", icon: <Database className="size-4" /> },
  { key: "plan", label: "Plan & billing", icon: <Gem className="size-4" /> },
];

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full cursor-pointer items-center justify-between gap-4 py-2.5 text-left">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-white/80">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11.5px] text-white/40">{hint}</span> : null}
      </span>
      <span className={"relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors " + (on ? "bg-[#5fd0a0]/80" : "bg-white/15")}>
        <span className={"absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-all " + (on ? "left-[19px]" : "left-[3px]")} />
      </span>
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/[.03] p-0.5">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={"cursor-pointer rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors " + (value === o.v ? "gx-metal text-white" : "text-white/55 hover:text-white")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-white/80">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11.5px] text-white/40">{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

export default function SettingsPanel({
  user, open, section = "profile", onClose, onProfileChange,
}: {
  user: { email: string; name?: string; role?: string };
  open: boolean;
  section?: SettingsSection;
  onClose: () => void;
  onProfileChange?: (s: Session) => void;
}) {
  const [active, setActive] = useState<SettingsSection>(section);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_FALLBACK);
  const [name, setName] = useState(user.name ?? "");
  const [savedName, setSavedName] = useState(false);

  useEffect(() => { if (open) { setPrefs(loadPrefs()); setActive(section); setName(user.name ?? ""); } }, [open, section, user.name]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const patch = (p: Partial<Prefs>) => setPrefs((cur) => { const next = { ...cur, ...p }; savePrefs(next); if (p.reduceMotion !== undefined) applyReduceMotion(p.reduceMotion); return next; });

  const saveName = () => {
    const s = updateProfile({ name: name.trim() || undefined });
    if (s) { onProfileChange?.(s); setSavedName(true); setTimeout(() => setSavedName(false), 1600); }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[95] grid place-items-center px-4" style={{ background: "rgba(2,3,5,.7)", backdropFilter: "blur(8px)" }} onMouseDown={onClose}>
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="gx gx-bento flex max-h-[82vh] w-full max-w-[720px] overflow-hidden"
          >
            {/* Nav rail */}
            <div className="hidden w-[188px] shrink-0 flex-col gap-0.5 border-r border-white/[.07] p-3 sm:flex">
              <div className="px-2 pb-2 pt-1 text-[15px] font-semibold text-white">Settings</div>
              {NAV.map((n) => (
                <button key={n.key} type="button" onClick={() => setActive(n.key)}
                  className={"flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors " + (active === n.key ? "bg-white/[.08] text-white" : "text-white/55 hover:bg-white/[.04] hover:text-white/90")}>
                  <span className={active === n.key ? "text-white/90" : "text-white/40"}>{n.icon}</span>{n.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-3.5">
                <div className="text-[14px] font-semibold capitalize text-white">{NAV.find((n) => n.key === active)?.label}</div>
                <button type="button" onClick={onClose} aria-label="Close settings" className="grid size-7 cursor-pointer place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/[.06] hover:text-white"><X className="size-4" /></button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
                {active === "profile" ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 pb-1">
                      <div className="grid size-12 place-items-center rounded-full bg-white/10 text-[18px] font-semibold text-white/90">{(name || user.email).trim().slice(0, 1).toUpperCase()}</div>
                      <div className="min-w-0"><div className="truncate text-[14px] font-semibold text-white">{name || "Account"}</div><div className="truncate text-[12px] text-white/45">{user.email}</div></div>
                      {user.role ? <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[.1em] text-white/60">{user.role}</span> : null}
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-medium text-white/55">Display name</span>
                      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                        className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-white/25" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-medium text-white/55">Email</span>
                      <input value={user.email} disabled className="w-full rounded-lg border border-white/10 bg-white/[.02] px-3 py-2 text-[13px] text-white/45 outline-none" />
                    </label>
                    <button type="button" onClick={saveName} className="mt-1 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/15">
                      {savedName ? <><Check className="size-4 text-[#5fd0a0]" /> Saved</> : "Save changes"}
                    </button>
                  </div>
                ) : null}

                {active === "notifications" ? (
                  <div className="flex flex-col divide-y divide-white/[.05]">
                    <Toggle on={prefs.notifyMorningBrief} onChange={(v) => patch({ notifyMorningBrief: v })} label="Morning brief email" hint="Daily pricing brief at your delivery time" />
                    <Toggle on={prefs.notifyPriceAlerts} onChange={(v) => patch({ notifyPriceAlerts: v })} label="Price alerts" hint="When a recommended ADR move exceeds 5%" />
                    <Toggle on={prefs.notifyCompetitorMoves} onChange={(v) => patch({ notifyCompetitorMoves: v })} label="Competitor movements" hint="Sell-outs and rate changes in your set" />
                    <Toggle on={prefs.notifyWeeklyDigest} onChange={(v) => patch({ notifyWeeklyDigest: v })} label="Weekly digest" hint="Sunday summary of corridor pressure" />
                  </div>
                ) : null}

                {active === "display" ? (
                  <div className="flex flex-col divide-y divide-white/[.05]">
                    <Row label="Display currency" hint="How rates are shown across the dashboard">
                      <Segmented<Currency> value={prefs.currency} onChange={(v) => patch({ currency: v })} options={[{ v: "RON", label: "RON" }, { v: "EUR", label: "EUR" }]} />
                    </Row>
                    <Toggle on={prefs.reduceMotion} onChange={(v) => patch({ reduceMotion: v })} label="Reduce motion" hint="Calms transitions and animated effects" />
                  </div>
                ) : null}

                {active === "data" ? (
                  <div className="flex flex-col divide-y divide-white/[.05]">
                    <Row label="Brief delivery time" hint="Local time the morning brief is sent">
                      <input type="time" value={prefs.briefTime} onChange={(e) => patch({ briefTime: e.target.value })}
                        className="rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-[13px] tabular-nums text-white outline-none focus:border-white/25" />
                    </Row>
                    <Row label="Refresh cadence" hint="How often competitor rates are re-scraped">
                      <Segmented<Cadence> value={prefs.refreshCadence} onChange={(v) => patch({ refreshCadence: v })} options={[{ v: "hourly", label: "Hourly" }, { v: "6h", label: "6h" }, { v: "daily", label: "Daily" }]} />
                    </Row>
                  </div>
                ) : null}

                {active === "plan" ? (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-xl border border-[#C8A165]/25 bg-[#C8A165]/[.07] p-4">
                      <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-white">Pilot plan</span><span className="rounded-full bg-[#C8A165]/15 px-2 py-0.5 text-[10px] font-medium text-[#d8b277]">Active</span></div>
                      <div className="mt-1.5 text-[12px] text-white/55">Hotel Terra Neptun &middot; founder pricing locked</div>
                      <div className="mt-3 flex items-end gap-1"><span className="text-[26px] font-semibold leading-none tabular-nums text-white">&euro;0</span><span className="pb-0.5 text-[12px] text-white/40">/ month &middot; 60-day trial</span></div>
                    </div>
                    <Row label="Next invoice" hint="First charge after the trial ends"><span className="text-[13px] font-medium tabular-nums text-white/80">&euro;150.00</span></Row>
                    <Row label="Billing email"><span className="text-[13px] text-white/60">{user.email}</span></Row>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
