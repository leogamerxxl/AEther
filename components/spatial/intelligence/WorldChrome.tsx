"use client";
// WorldChrome - the world's top system: ONE chrome bar. Primary = the five modes
// (Observa / Brief / Harta / Simulare / Decizii) - the lenses over the same world.
// When the map lens is active, the altitude bands appear as its sub-sections.
// The truth state (LIVE/DEMO) closes the bar. Nothing else floats up top.

import { C } from "@/lib/command-theme";
import { BANDS, type AltitudeBand } from "@/lib/altitude";
import { MODES, type WorldMode } from "@/lib/mode-data";
import { useIntelligence } from "./SpatialIntelligenceProvider";

export default function WorldChrome({ band, onFlyTo, mode, onMode }: {
  band: AltitudeBand; onFlyTo: (zoom: number) => void;
  mode: WorldMode; onMode: (m: WorldMode) => void;
}) {
  const { source, loading } = useIntelligence();

  return (
    <div className="gx gx-matte fixed left-1/2 top-4 z-[82] hidden -translate-x-1/2 items-center gap-1 rounded-full p-1 lg:flex">
      {/* The five modes - exactly one carries the metal pill */}
      {MODES.map((m) => {
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            onClick={() => onMode(m.id)}
            aria-current={active ? "true" : undefined}
            className={"cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] transition-colors duration-200 " +
              (active ? "gx-metal font-medium" : "text-white/50 hover:text-white/85")}
          >
            {m.label}
          </button>
        );
      })}

      {/* Altitude bands - the map lens's sub-sections (text-only, active = white) */}
      {mode === "map" ? (
        <>
          <span className="mx-1 h-4 w-px bg-white/10" />
          {BANDS.map((b) => {
            const active = b.id === band;
            return (
              <button
                key={b.id}
                onClick={() => onFlyTo(b.zoomTarget)}
                aria-current={active ? "true" : undefined}
                className={"cursor-pointer rounded-full px-2.5 py-1.5 text-[11px] transition-colors duration-200 " +
                  (active ? "font-medium text-white" : "text-white/45 hover:text-white/80")}
              >
                {b.label}
              </button>
            );
          })}
        </>
      ) : null}

      <span className="mx-1 h-4 w-px bg-white/10" />
      {loading ? (
        <span className="mr-2 h-2 w-9 animate-pulse rounded-[4px] bg-white/[.08]" />
      ) : (
        <span className="mr-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em]"
              style={{ color: source === "live" ? C.live : C.idle }}>
          <span className={source === "live" ? "size-1.5 animate-pulse rounded-full" : "size-1.5 rounded-full"}
                style={{ background: source === "live" ? C.live : C.idle }} />
          {source === "live" ? "LIVE" : "DEMO"}
        </span>
      )}
    </div>
  );
}