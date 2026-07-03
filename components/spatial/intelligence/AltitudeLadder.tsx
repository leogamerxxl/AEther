"use client";
// AltitudeLadder - the game-grade vertical navigator. One dot per band; the camera
// position IS the app state. Click = fly. Current band glows cyan (live axis);
// labels reveal on hover. Slim, right edge, desktop-only.

import { C } from "@/lib/command-theme";
import { BANDS, type AltitudeBand } from "@/lib/altitude";

export default function AltitudeLadder({ band, onFlyTo }: { band: AltitudeBand; onFlyTo: (zoom: number) => void }) {
  return (
    <nav
      aria-label="Altitudine"
      className="gx gx-bento fixed right-4 top-1/2 z-[80] hidden -translate-y-1/2 flex-col items-center gap-1 rounded-full px-1.5 py-2 lg:flex"
    >
      {BANDS.map((b) => {
        const active = b.id === band;
        return (
          <button
            key={b.id}
            onClick={() => onFlyTo(b.zoomTarget)}
            aria-label={b.label}
            aria-current={active ? "true" : undefined}
            className="group relative flex size-7 items-center justify-center rounded-full transition-colors duration-200 hover:bg-white/[.06]"
          >
            <span
              className="size-1.5 rounded-full transition-all duration-200"
              style={active
                ? { background: C.live, boxShadow: `0 0 8px ${C.live}`, transform: "scale(1.5)" }
                : { background: "rgba(255,255,255,0.28)" }}
            />
            <span className="pointer-events-none absolute right-9 whitespace-nowrap rounded-md border border-white/[.08] bg-black/80 px-2 py-1 text-[10.5px] text-white/75 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {b.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}