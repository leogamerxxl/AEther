"use client";
// AltitudeRail - the altitude pills, floating inside the map world just below
// the app bar (UXP: City / District / Street / Building). Map-lens only.

import { BANDS, type AltitudeBand } from "@/lib/altitude";

export default function AltitudeRail({ band, onFlyTo }: {
  band: AltitudeBand; onFlyTo: (band: AltitudeBand) => void;
}) {
  return (
    <div className="gx gx-matte fixed left-1/2 top-[60px] z-[81] hidden -translate-x-1/2 items-center gap-1 rounded-full p-1 lg:flex">
      {BANDS.map((b) => {
        const active = b.id === band;
        return (
          <button
            key={b.id}
            onClick={() => onFlyTo(b.id)}
            aria-current={active ? "true" : undefined}
            className={"cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] transition-colors duration-200 " +
              (active ? "gx-metal font-medium" : "text-white/50 hover:text-white/85")}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}