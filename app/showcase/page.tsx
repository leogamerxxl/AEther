"use client";

// /showcase - design review surface for the Aether command-center primitive kit.
// Hidden route; not linked in nav. Renders every primitive with realistic
// hospitality-intelligence sample data on the command background.

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Thermometer, Car, Search, MessageSquare, Waves, Building2, TrendingDown } from "lucide-react";
import {
  CommandPanel, IntelCard, AlertBanner, StatusDot, ConfidenceMeter, Delta,
  SignalChip, MetricReadout, LayerSelector, SmartSuggestion, type MapLayer,
} from "@/components/command/primitives";
import { AssetGallery } from "@/components/command/AssetGallery";
import { WarningPanel, type AlertGroup } from "@/components/command/WarningPanel";
import { CoastalSectorView } from "@/components/command/CoastalSectorView";
import { C } from "@/lib/command-theme";

const TRAJ = [575, 568, 572, 580, 576, 590, 585, 596, 588, 601, 597, 609, 604, 612];
const OCC = [70, 72, 71, 74, 73, 81, 78, 84, 80, 86, 83, 88, 85, 90];

const WARN_GROUPS: AlertGroup[] = [
  { label: "Demand Issues", sub: "2 segments", icon: Building2, items: [
    { id: "d1", count: 2, severity: "critical", title: "~38 rooms unsold this weekend", ago: "4m ago",
      affectedLabel: "Affected nights:", affected: [
        { label: "Saturday", detail: "22 rooms still available" },
        { label: "Sunday", detail: "16 rooms still available" },
      ], recommend: "Open a 2-night weekend package" },
    { id: "d2", count: 1, severity: "warn", title: "Midweek pace 3% behind last year", ago: "20m ago",
      affectedLabel: "Detail:", affected: [{ label: "Tue-Wed", detail: "Soft corporate demand" }], recommend: "Promote spa inventory midweek" },
  ] },
  { label: "Rate Deviations", sub: "comp set", icon: TrendingDown, items: [
    { id: "r1", count: 1, severity: "warn", title: "Mera Onyx dropped ADR 8%", ago: "12m ago",
      affectedLabel: "Detail:", affected: [{ label: "Neptun comp set", detail: "Now 8% below your rate" }], recommend: "Hold rate; counter with a value bundle" },
  ] },
];

export default function ShowcasePage() {
  const [layers, setLayers] = useState<MapLayer[]>([
    { id: "hotels", label: "Hotels", color: C.live, count: 1, active: true },
    { id: "competitors", label: "Competitors", color: "#5b7fa6", count: 11, active: true },
    { id: "events", label: "Events", color: C.money, count: 4, active: true },
    { id: "weather", label: "Weather", color: "#7dd3fc", active: false },
    { id: "traffic", label: "Traffic (DN39)", color: "#f59e0b", active: false },
    { id: "demand", label: "Tourism demand", color: C.up, active: true },
    { id: "sentiment", label: "Social sentiment", color: "#c084fc", active: false },
    { id: "booking", label: "Booking activity", color: C.live, count: 38, active: false },
  ]);
  const toggle = (id: string) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, active: !l.active } : l)));

  const [alerts, setAlerts] = useState({ crit: true, warn: true, info: true });

  return (
    <div className="min-h-screen w-full bg-[#08090b] px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-8">
          <div className="text-[11px] font-medium uppercase tracking-[.18em] text-cyan-300/70">Design system &middot; Phase 1</div>
          <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-.02em] text-white">Aether Command System</h1>
          <p className="mt-1 max-w-[640px] text-[13px] text-white/45">
            The reusable intelligence primitives. Every surface answers what is happening, why, what happens next, and what to do.
          </p>
        </header>

        {/* Coastal sector monitor */}
        <Section label="Coastal sector monitor">
          <CoastalSectorView />
        </Section>

        {/* Asset gallery - true glass over atmosphere */}
        <Section label="Asset gallery - true glass">
          <div className="atmos rounded-3xl p-5 sm:p-7">
            <AssetGallery />
          </div>
        </Section>

        {/* Alerts and warnings */}
        <Section label="Alerts and warnings">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <WarningPanel groups={WARN_GROUPS} />
            <div className="flex flex-col gap-2.5">
            <AnimatePresence>
              {alerts.crit ? <AlertBanner key="c" severity="critical" title="Storm front building offshore" message="Beach occupancy migrating inland toward pool & spa." when="Fri 14:00" actionLabel="View" onAction={() => {}} onDismiss={() => setAlerts((a) => ({ ...a, crit: false }))} /> : null}
              {alerts.warn ? <AlertBanner key="w" severity="warn" title="Booking pace softening midweek" message="Tuesday-Wednesday tracking -3% vs last year." when="Tue-Wed" onDismiss={() => setAlerts((a) => ({ ...a, warn: false }))} /> : null}
              {alerts.info ? <AlertBanner key="i" severity="info" title="Neversea 2026 in 26 days" message="Major demand anchor approaching the corridor." onDismiss={() => setAlerts((a) => ({ ...a, info: false }))} /> : null}
            </AnimatePresence>
            </div>
          </div>
        </Section>

        {/* Intelligence cards */}
        <Section label="Intelligence cards">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <IntelCard
              kind="opportunity"
              title="Mera Onyx sold out this weekend"
              signal="Mera Onyx (4-star, 0.4km) is sold out Fri-Sun while you hold 24 rooms."
              context="Corridor demand is firm and your set sits near the market ADR."
              forecast="Spillover lifts your weekend booking pace ~12% if priced to capture."
              action="Lift weekend ADR +8% and set a 2-night minimum."
              impact={{ label: "Expected gain", valueRon: 9400 }}
              confidencePct={82}
              when="Fri-Sun"
              source="Booking.com pace model"
              onAct={() => {}}
            />
            <IntelCard
              kind="risk"
              title="Guest defection to Bulgaria"
              signal="Sunny Beach 4-star sits ~17% cheaper in EUR terms."
              context="Fuel +1.6% MoM and Romanian-coast sentiment is softening."
              forecast="52% defection probability over the next 10 days if you hold."
              action="Hold rate; push a direct-mobile value bundle, not a discount."
              impact={{ label: "Demand impact", deltaPct: -5 }}
              confidencePct={85}
              when="Next 10d"
              source="Corridor migration model"
              actLabel="Plan response"
              onAct={() => {}}
            />
            <IntelCard
              kind="recommendation"
              title="Promote spa inventory midweek"
              signal="Midweek occupancy is soft and a storm pushes demand indoors."
              context="Pool & spa capacity is underused Tue-Wed."
              forecast="Bundled spa capture lifts midweek RevPAR without cutting room rate."
              action="Launch a spa-premium bundle and raise weekend minimum stay."
              impact={{ label: "Expected gain", valueRon: 3200 }}
              confidencePct={71}
              when="Tue-Wed"
              source="Weather + OTB"
              onAct={() => {}}
            />
          </div>
        </Section>

        {/* Command panel + metrics */}
        <Section label="Command panel & metrics">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <CommandPanel className="lg:col-span-2" title="Hotel Terra Neptun" eyebrow="Revenue command" status={{ level: "live", label: "Live" }} motif="radar">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricReadout label="Occupancy" value="76" unit="%" delta={{ v: 2.4 }} spark={OCC} tone="up" motif="occupancy" />
                <MetricReadout label="ADR" value="575" unit=" RON" delta={{ v: 4.2, money: true }} spark={TRAJ} tone="money" motif="trend" />
                <MetricReadout label="RevPAR" value="313" unit=" RON" delta={{ v: 6.1 }} spark={OCC} tone="live" motif="building" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SignalChip icon={Thermometer} label="Sea air" value="27 C" tone="live" />
                <SignalChip icon={Car} label="DN39" value="moderate" tone="money" />
                <SignalChip icon={Search} label="RO searches" delta={14} tone="up" />
                <SignalChip icon={MessageSquare} label="Sentiment" value="-0.08" tone="down" />
                <SignalChip icon={Waves} label="Bulgaria pull" delta={-6} tone="down" />
              </div>
              <div className="mt-3">
                <SmartSuggestion text="Lift weekend ADR +8% - Mera Onyx is sold out Fri-Sun" confidencePct={82} accent="#5fd0a0" onApply={() => {}} />
              </div>
            </CommandPanel>

            <LayerSelector layers={layers} onToggle={toggle} />
          </div>
        </Section>

        {/* Indicators */}
        <Section label="Indicators">
          <div className="gx gx-bento flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-center gap-5">
              <StatusDot level="live" label="Live" />
              <StatusDot level="ok" label="Healthy" />
              <StatusDot level="warn" label="Watch" />
              <StatusDot level="critical" label="Critical" />
              <StatusDot level="idle" label="Idle" />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Delta v={8.2} /><Delta v={-3.1} /><Delta v={4.2} money /><Delta v={120} suffix=" RON" money />
            </div>
            <div className="grid max-w-[640px] grid-cols-2 gap-5 sm:grid-cols-4">
              <ConfidenceMeter pct={92} /><ConfidenceMeter pct={68} /><ConfidenceMeter pct={41} /><ConfidenceMeter pct={22} />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-9">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[.16em] text-white/40">{label}</h2>
        <span className="h-px flex-1 bg-white/[.07]" />
      </div>
      {children}
    </section>
  );
}
