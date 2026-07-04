"use client";
// WorldControls - the camera instrument: zoom in / home / zoom out, stacked
// bottom-right. Every press moves the world (altitude is the mechanic).

import { Plus, Minus, LocateFixed } from "lucide-react";

export default function WorldControls({ zoomBy, home }: { zoomBy: (d: number) => void; home: () => void }) {
  const btn = "gx gx-matte flex size-9 items-center justify-center rounded-full text-white/60 transition-colors duration-200 hover:text-white";
  return (
    <div className="fixed bottom-4 right-4 z-[79] hidden flex-col gap-1.5 lg:flex">
      <button className={btn} onClick={() => zoomBy(1)} aria-label="Apropie"><Plus className="size-4" /></button>
      <button className={btn} onClick={home} aria-label="Acasa"><LocateFixed className="size-4" /></button>
      <button className={btn} onClick={() => zoomBy(-1)} aria-label="Departeaza"><Minus className="size-4" /></button>
    </div>
  );
}