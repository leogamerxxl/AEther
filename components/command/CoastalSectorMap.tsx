"use client";

// CoastalSectorMap - a tilted, exploded-3D map of the coast with glowing,
// color-coded resort sectors and upright labels (diamond marker + stem), in the
// spirit of the UXP smart-city reference. Stylized, not cartographic.

import * as React from "react";
import { COAST_SECTORS, SECTOR_COLORS, blobPath } from "@/lib/coast-sectors";
import { cn } from "@/lib/utils";

const TILT = 52;

export function CoastalSectorMap({ selected, onSelect }: { selected?: string | null; onSelect?: (id: string) => void }) {
  return (
    <div className="relative mx-auto w-full" style={{ perspective: "1200px" }}>
      <div className="relative mx-auto w-full" style={{ maxWidth: 900, aspectRatio: "1000 / 600", transform: `rotateX(${TILT}deg)`, transformStyle: "preserve-3d", transformOrigin: "50% 44%" }}>
        <svg viewBox="0 0 1000 620" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <pattern id="cs-dots" width="15" height="15" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.18)" />
            </pattern>
            <filter id="cs-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* faint coastline / sea edge */}
          <path d="M 742 14 C 712 170, 612 268, 548 366 S 432 548, 392 606" fill="none" stroke="rgba(120,200,255,0.12)" strokeWidth="2" />

          {COAST_SECTORS.map((s) => {
            const c = SECTOR_COLORS[s.level];
            const d = blobPath(s.cx, s.cy, s.r, s.seed);
            const active = selected === s.id;
            return (
              <g key={s.id} className="pointer-events-auto cursor-pointer" onClick={() => onSelect?.(s.id)}>
                <path d={d} fill={c.soft} />
                <path d={d} fill="url(#cs-dots)" opacity="0.5" />
                <path d={d} fill="none" stroke={c.color} strokeWidth={active ? 4 : 2.4} filter="url(#cs-glow)" opacity={active ? 1 : 0.8} />
                <path d={d} fill="none" stroke={c.color} strokeWidth={1.4} opacity="0.9" />
              </g>
            );
          })}
        </svg>

        {/* upright labels (counter-rotated so they stand up on the tilted plane) */}
        {COAST_SECTORS.map((s) => {
          const c = SECTOR_COLORS[s.level];
          const active = selected === s.id;
          return (
            <button key={s.id} onClick={() => onSelect?.(s.id)}
              className="absolute flex flex-col items-center"
              style={{ left: `${(s.cx / 1000) * 100}%`, top: `${(s.cy / 620) * 100}%`, transform: `translate(-50%, -150%) rotateX(-${TILT}deg)`, transformOrigin: "50% 100%" }}>
              <span className={cn("gx gx-bento inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors", active ? "text-white" : "text-white/85")}>
                <span style={{ color: c.color }}>&#9670;</span> {s.name}
              </span>
              <span className="mt-0.5 h-5 w-px" style={{ background: `linear-gradient(${c.color}, transparent)` }} />
              <span className="size-1.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
