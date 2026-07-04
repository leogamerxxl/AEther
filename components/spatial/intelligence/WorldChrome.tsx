"use client";
// WorldChrome - the world's top system, reference-anatomy: a pill navigation row
// (the altitude bands as sections; active = filled pill) with the truth state at
// its end, and beneath it the oversized thin display title that names where you
// are, overlaying the map. One chrome system - nothing else floats up top.

import { motion } from "framer-motion";
import { C } from "@/lib/command-theme";
import { TRANSITION } from "@/lib/motion";
import { BANDS, bandMeta, type AltitudeBand } from "@/lib/altitude";
import { useIntelligence } from "./SpatialIntelligenceProvider";

const TITLES: Record<AltitudeBand, string> = {
  globe: "Piete globale",
  country: "Romania",
  region: "Litoralul",
  market: "Neptun-Olimp",
  property: "Hotel Terra Neptun",
  twin: "Interior - Terra",
};

export default function WorldChrome({ band, focusName, onFlyTo }: {
  band: AltitudeBand; focusName?: string | null; onFlyTo: (zoom: number) => void;
}) {
  const { source, loading } = useIntelligence();
  const meta = bandMeta(band);
  const title = band === "property" && focusName ? focusName : TITLES[band];

  return (
    <>
      {/* Pill navigation - the altitude bands as sections */}
      <div className="gx gx-matte fixed left-1/2 top-4 z-[82] hidden -translate-x-1/2 items-center gap-1 rounded-full p-1 lg:flex">
        {BANDS.map((b) => {
          const active = b.id === band;
          return (
            <button
              key={b.id}
              onClick={() => onFlyTo(b.zoomTarget)}
              aria-current={active ? "true" : undefined}
              className={"cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] transition-colors duration-200 " +
                (active ? "gx-metal font-medium" : "text-white/50 hover:text-white/85")}
            >
              {b.label}
            </button>
          );
        })}
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

      {/* The oversized display title over the world - names the current altitude */}
      <motion.div
        key={title}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={TRANSITION.standard}
        className="pointer-events-none fixed left-5 top-[64px] z-[81] hidden w-[360px] lg:block"
      >
        <h1 className="large-title text-white/95" style={{ fontSize: 32 }}>{title}</h1>
        <div className="mt-0.5 text-[10px] uppercase tracking-[.16em] text-white/40">{meta.trail}</div>
      </motion.div>
    </>
  );
}