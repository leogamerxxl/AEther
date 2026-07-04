"use client";
// AppBar - the UXP-grammar top system: brand space left (the Aether menu lives
// there), the five modes as a text nav center (active = white + lit underline),
// and the context cluster right: market location, REAL weather (from the live
// weather intelligence object - never a hardcoded degree), local clock, truth
// state. One bar; the altitude pills live below it, inside the map world.

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { C } from "@/lib/command-theme";
import { MODES, type WorldMode } from "@/lib/mode-data";
import { ioFreshness } from "@/lib/intelligence-map";
import { useIntelligence } from "./SpatialIntelligenceProvider";

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

export default function AppBar({ mode, onMode }: { mode: WorldMode; onMode: (m: WorldMode) => void }) {
  const { source, loading, objects } = useIntelligence();
  const clock = useClock();

  // Today's real max temp from the weather IO (evidence-backed; absent -> no number)
  const tempC = useMemo(() => {
    const w = objects.find((io) => io.signal_type === "weather_demand_outlook" && ioFreshness(io) !== "dead");
    const days = (w?.raw_jsonb as { days?: { date: string; tmax_c?: number }[] } | undefined)?.days;
    const today = new Date().toISOString().slice(0, 10);
    const d = days?.find((x) => x.date === today) ?? days?.[0];
    return typeof d?.tmax_c === "number" ? Math.round(d.tmax_c) : null;
  }, [objects]);

  return (
    <div className="fixed inset-x-0 top-0 z-[82] hidden h-12 items-center border-b border-white/[.06] px-4 lg:flex"
         style={{ background: "rgba(5,6,8,.92)" }}>
      {/* left space is owned by the Aether menu (Entry renders it fixed here) */}
      <div className="w-[190px]" />

      {/* mode nav - text tabs, one lit underline */}
      <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-7" aria-label="Moduri">
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => onMode(m.id)}
              aria-current={active ? "true" : undefined}
              className={"relative cursor-pointer py-3.5 text-[13px] transition-colors duration-200 " +
                (active ? "text-white" : "text-white/45 hover:text-white/80")}
            >
              {m.label}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-white/85"
                      style={{ boxShadow: "0 0 14px rgba(255,255,255,.55)" }} />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* context cluster */}
      <div className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.03] px-3 py-1 text-[11.5px] text-white/70">
          <MapPin className="size-3" /> Neptun, RO
        </span>
        {tempC != null ? (
          <span className="text-[12px] tabular-nums text-white/70">{tempC}&deg;C</span>
        ) : null}
        <span className="text-[12px] tabular-nums text-white/70">{clock}</span>
        {loading ? (
          <span className="h-2 w-9 animate-pulse rounded-[4px] bg-white/[.08]" />
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em]"
                style={{ color: source === "live" ? C.live : C.idle }}>
            <span className={source === "live" ? "size-1.5 animate-pulse rounded-full" : "size-1.5 rounded-full"}
                  style={{ background: source === "live" ? C.live : C.idle }} />
            {source === "live" ? "LIVE" : "DEMO"}
          </span>
        )}
      </div>
    </div>
  );
}