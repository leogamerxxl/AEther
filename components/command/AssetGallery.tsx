"use client";

// AssetGallery - a horizontal scroll-snapping rail of glass AssetCards built
// from the real property set. Hover-to-illuminate (only the hovered card stays
// bright, siblings dim) and an expand/forecast -> AssetDossier flow.

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AssetCard } from "./AssetCard";
import { AssetDossier } from "./AssetDossier";
import { useIntelligence } from "@/components/spatial/intelligence/SpatialIntelligenceProvider";
import { deriveIntel } from "@/lib/spatial-intel";
import { paceColor } from "@/lib/property-extrusions";
import { weeklyForecast } from "@/lib/asset-forecast";

function codeFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return String(10000 + (h % 89999));
}

export function AssetGallery({ onLocate }: { onLocate?: (id: string) => void }) {
  const { nodes } = useIntelligence();
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 340, behavior: "smooth" });

  return (
    <>
      <div className="relative">
        <div ref={ref} className="snap-x no-scrollbar flex gap-4 overflow-x-auto px-1 pb-3 pt-1">
          {nodes.map((n) => {
            const i = deriveIntel(n);
            const accent = paceColor(n);
            return (
              <AssetCard
                key={n.id}
                name={n.name}
                city={n.city}
                stars={n.stars}
                code={codeFor(n.id)}
                accent={accent}
                occupancy={i.occupancy}
                adr={i.adr}
                forecast={weeklyForecast(n.id, i.occupancy, i.adr)}
                isOwn={n.isOwn}
                dimmed={hovered !== null && hovered !== n.id}
                onHoverChange={(h) => setHovered((cur) => (h ? n.id : cur === n.id ? null : cur))}
                onOpen={() => setOpenId(n.id)}
                onLocate={onLocate ? () => onLocate(n.id) : undefined}
              />
            );
          })}
        </div>

        <button onClick={() => scroll(-1)} aria-label="Scroll left"
          className="gx-glass absolute left-1 top-1/2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-white/80 transition-colors hover:text-white">
          <ChevronLeft className="size-4.5" />
        </button>
        <button onClick={() => scroll(1)} aria-label="Scroll right"
          className="gx-glass absolute right-1 top-1/2 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-white/80 transition-colors hover:text-white">
          <ChevronRight className="size-4.5" />
        </button>
      </div>

      <AssetDossier nodeId={openId} onClose={() => setOpenId(null)} onLocate={onLocate ? (id) => { onLocate(id); setOpenId(null); } : undefined} />
    </>
  );
}
