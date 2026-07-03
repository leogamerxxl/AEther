"use client";
// WorldChrome - the single piece of world chrome. Left space is the Ae menu
// (mounted by Entry); center = the altitude breadcrumb (where you are in the
// world); right = the truth state (LIVE pulse or neutral DEMO). Nothing else
// floats on top of the world.

import { C } from "@/lib/command-theme";
import { bandMeta, type AltitudeBand } from "@/lib/altitude";
import { useIntelligence } from "./SpatialIntelligenceProvider";

export default function WorldChrome({ band }: { band: AltitudeBand }) {
  const { source, loading } = useIntelligence();
  const meta = bandMeta(band);
  return (
    <div className="gx gx-bento fixed left-1/2 top-4 z-[82] flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-1.5">
      <span className="max-w-[46vw] truncate text-[11px] tracking-[.04em] text-white/70" title={meta.trail}>
        {meta.trail}
      </span>
      <span className="h-3 w-px bg-white/10" />
      {loading ? (
        <span className="h-2 w-10 animate-pulse rounded-[4px] bg-white/[.08]" />
      ) : (
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em]"
              style={{ color: source === "live" ? C.live : C.idle }}>
          <span className={source === "live" ? "size-1.5 animate-pulse rounded-full" : "size-1.5 rounded-full"}
                style={{ background: source === "live" ? C.live : C.idle }} />
          {source === "live" ? "LIVE" : "DEMO"}
        </span>
      )}
    </div>
  );
}