"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { LogOut, User, Settings, Bell, MapPin, Package, Plug, Database, Gem, CreditCard } from "lucide-react";
import { getSession, signOut, type Session } from "@/lib/auth";
import { ROLES } from "@/lib/ops";
import CoastalCommandCenter from "./CoastalCommandCenter";
import StaffFeed from "./StaffFeed";
import RevenueCommand from "./RevenueCommand";
import OperationsCommand from "./OperationsCommand";
import AuthGate from "./AuthGate";
import { Toaster } from "./Toast";
import { toast } from "@/lib/toast";
import { AetherMenu, type AetherMenuSection } from "@/components/ui/menu";
import SettingsPanel, { type SettingsSection } from "./SettingsPanel";
import { loadPrefs, applyReduceMotion } from "@/lib/prefs";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import SecurityCard from "@/components/ui/security-card";

const EntranceSplash = dynamic(() => import("./EntranceSplash"), { ssr: false });

export default function Entry() {
  const [splashGone, setSplashGone] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [ctaShown, setCtaShown] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [appView, setAppView] = useState<"map" | "revenue" | "operations">("map");
  const [settings, setSettings] = useState<{ open: boolean; section: SettingsSection }>({ open: false, section: "profile" });
  const openSettings = (section: SettingsSection) => setSettings({ open: true, section });

  useEffect(() => { setSession(getSession()); setHydrated(true); }, []);
  useEffect(() => { applyReduceMotion(loadPrefs().reduceMotion); }, []);

  useEffect(() => {
    if (revealed && hydrated && !session) {
      const t = setTimeout(() => setCtaShown(true), 2300);
      return () => clearTimeout(t);
    }
  }, [revealed, hydrated, session]);

  useEffect(() => {
    if (!verifying) return;
    const t = setTimeout(() => setVerifying(false), 3400);
    return () => clearTimeout(t);
  }, [verifying]);

  const role = session?.role;
  const isStaff = !!role && role !== "owner" && role !== "manager";

  const onAuthed = (s: Session) => { setSession(s); setAuthOpen(false); setCtaShown(false); setVerifying(true); };
  const onSignOut = () => { signOut(); setSession(null); setAuthOpen(false); setCtaShown(false); };

  const soon = (label: string) => toast(label + " - coming soon");
  const sections: AetherMenuSection[] = [
    { title: "Account", defaultOpen: true, items: [
      { label: "Profile", icon: <User className="size-4" />, onClick: () => openSettings("profile") },
      { label: "Account settings", icon: <Settings className="size-4" />, onClick: () => openSettings("profile") },
      { label: "Notifications", icon: <Bell className="size-4" />, onClick: () => openSettings("notifications") },
    ]},
    { title: "Workspace", items: [
      { label: "Locations", icon: <MapPin className="size-4" />, onClick: () => soon("Locations") },
      { label: "Products", icon: <Package className="size-4" />, onClick: () => soon("Products") },
      { label: "Integrations", icon: <Plug className="size-4" />, onClick: () => soon("Integrations") },
    ]},
    { title: "Preferences", items: [
      { label: "Data preferences", icon: <Database className="size-4" />, onClick: () => openSettings("data") },
    ]},
    { title: "Billing & plan", items: [
      { label: "Plan", icon: <Gem className="size-4" />, badge: "Pilot", onClick: () => openSettings("plan") },
      { label: "Billing & invoices", icon: <CreditCard className="size-4" />, onClick: () => openSettings("plan") },
    ]},
  ];
  const menuUser = session ? { name: session.name, email: session.email, role: ROLES.find((r) => r.id === session.role)?.label } : null;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      {hydrated && isStaff ? (
        <StaffFeed role={role!} />
      ) : hydrated && session && appView === "revenue" ? (
        <RevenueCommand onOpenMap={() => setAppView("map")} />
      ) : hydrated && session && appView === "operations" ? (
        <OperationsCommand onOpenMap={() => setAppView("map")} />
      ) : (
        <CoastalCommandCenter cinematic start={revealed} locked={!session} />
      )}

      {hydrated && session && !isStaff ? (
        <div className="gx gx-bento fixed left-1/2 top-4 z-[82] flex -translate-x-1/2 items-center gap-1 rounded-full p-1">
          <button onClick={() => setAppView("map")} className={"cursor-pointer rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors " + (appView === "map" ? "gx-metal" : "text-white/55 hover:text-white")}>Map</button>
          <button onClick={() => setAppView("revenue")} className={"cursor-pointer rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors " + (appView === "revenue" ? "gx-metal" : "text-white/55 hover:text-white")}>Revenue</button>
          <button onClick={() => setAppView("operations")} className={"cursor-pointer rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors " + (appView === "operations" ? "gx-metal" : "text-white/55 hover:text-white")}>Operations</button>
        </div>
      ) : null}

      {/* Owner/Manager: the Aether logo menu replaces the old status bar (top-left) */}
      {hydrated && session && !isStaff && menuUser ? (
        <div className="fixed left-4 top-4 z-[85]">
          <AetherMenu user={menuUser} sections={sections} onSignOut={onSignOut} featured={{ title: "Hotel Terra Neptun", subtitle: "Pilot plan - Black Sea coast", icon: <MapPin className="size-5" />, onClick: () => soon("Workspace") }} />
        </div>
      ) : null}

      {/* Staff keep a simple sign-out (their feed has its own header) */}
      {hydrated && session && isStaff ? (
        <button onClick={onSignOut} className="gx gx-bento fixed bottom-4 left-4 z-[80] flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium text-white/70 transition-colors hover:text-white">
          <LogOut className="size-3.5" /> Sign out
        </button>
      ) : null}

      {hydrated && !session && !authOpen && ctaShown ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="fixed bottom-[14%] left-1/2 z-[80] -translate-x-1/2 text-center">
          <LiquidMetalButton label="Sign in" width={180} onClick={() => setAuthOpen(true)} />
          <div className="mt-3 text-[12px] text-white/45">Sign in to your command center</div>
        </motion.div>
      ) : null}

      {hydrated && !session && authOpen ? (
        <AuthGate onAuthed={onAuthed} onClose={() => setAuthOpen(false)} />
      ) : null}

      {verifying && session ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[98] grid place-items-center px-5" style={{ background: "rgba(2,3,5,.86)", backdropFilter: "blur(6px)" }}>
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 22 }}>
            <SecurityCard name={session.name || session.email.split("@")[0]} email={session.email} />
          </motion.div>
        </motion.div>
      ) : null}

      {menuUser ? (
        <SettingsPanel user={menuUser} open={settings.open} section={settings.section} onClose={() => setSettings((s) => ({ ...s, open: false }))} onProfileChange={(s) => setSession(s)} />
      ) : null}

      <Toaster />

      {!splashGone ? (
        <EntranceSplash onReveal={() => setRevealed(true)} onDone={() => setSplashGone(true)} />
      ) : null}
    </div>
  );
}
