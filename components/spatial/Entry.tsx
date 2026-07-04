"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { LogOut, User, Settings, Bell, MapPin, Package, Plug, Database, Gem, CreditCard } from "lucide-react";
import { getSession, signOut, type Session } from "@/lib/auth";
import { ROLES } from "@/lib/ops";
import CoastalCommandCenter from "./CoastalCommandCenter";
import StaffFeed from "./StaffFeed";
import { SpatialIntelligenceProvider } from "./intelligence/SpatialIntelligenceProvider";
import CommandRail from "./intelligence/CommandRail";
import WorldChrome from "./intelligence/WorldChrome";
import WorldControls from "./intelligence/WorldControls";
import VarianceBoard from "./intelligence/VarianceBoard";
import MapPulseChip from "./intelligence/MapPulseChip";
import { NODE_BY_ID } from "@/lib/spatial-data";
import { bandForZoom } from "@/lib/altitude";
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
  const [focusId, setFocusId] = useState<string | null>(null);
  const camRef = useRef<{ zoomBy: (d: number) => void; home: () => void } | null>(null);
  const [settings, setSettings] = useState<{ open: boolean; section: SettingsSection }>({ open: false, section: "profile" });
  const [zoom, setZoom] = useState(14.2);
  const flyRef = useRef<((zoom: number) => void) | null>(null);
  const band = bandForZoom(zoom);
  const flyTo = (z: number) => flyRef.current?.(z);
  const openSettings = (section: SettingsSection) => setSettings({ open: true, section });

  useEffect(() => {
    const s = getSession();
    setSession(s); setHydrated(true);
    // Returning session: zero theater at 7am - world appears immediately.
    if (s) { setSplashGone(true); setRevealed(true); }
  }, []);
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
    <SpatialIntelligenceProvider>
      {hydrated && isStaff ? (
        <StaffFeed role={role!} />
      ) : (
        <CoastalCommandCenter cinematic start={revealed} locked={!session} onCamera={setZoom} registerFlyTo={(fn) => { flyRef.current = fn; }} registerCamera={(ops) => { camRef.current = ops; }} onFocus={setFocusId} />
      )}

      {/* The map's operating rail - authenticated command surface (desktop) */}
      {hydrated && session && !isStaff ? (
        <>
          <CommandRail band={band} onFlyTo={flyTo} focusId={focusId} />
          <WorldChrome band={band} focusName={focusId ? NODE_BY_ID.get(focusId)?.name : null} onFlyTo={flyTo} />
          <WorldControls zoomBy={(d) => camRef.current?.zoomBy(d)} home={() => camRef.current?.home()} />
          <div className="fixed bottom-4 right-16 z-[78] hidden flex-col items-end gap-2 lg:flex">
            {band === "market" ? <MapPulseChip /> : null}
            {band === "market" || band === "region" ? <VarianceBoard /> : null}
          </div>
        </>
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
    </SpatialIntelligenceProvider>
    </div>
  );
}
