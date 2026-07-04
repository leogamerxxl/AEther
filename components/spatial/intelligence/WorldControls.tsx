"use client";
// WorldControls - the camera instrument stack, bottom-right (UXP grammar:
// zoom, home, dimension toggle). Every press moves the world.

import { useState } from "react";
import { Plus, Minus, LocateFixed, Box } from "lucide-react";

export default function WorldControls({ zoomBy, home, toggle3D }: {
  zoomBy: (d: number) => void; home: () => void; toggle3D: () => void;
}) {
  const [flat, setFlat] = useState(false);
  const btn = "gx gx-matte flex size-9 items-center justify-center rounded-full text-white/60 transition-colors duration-200 hover:text-white";
  return (
    <div className="fixed bottom-4 right-4 z-[79] hidden flex-col gap-1.5 lg:flex">
      <button className={btn} onClick={() => zoomBy(1)} aria-label="Apropie"><Plus className="size-4" /></button>
      <button className={btn} onClick={home} aria-label="Acasa"><LocateFixed className="size-4" /></button>
      <button className={btn} onClick={() => zoomBy(-1)} aria-label="Departeaza"><Minus className="size-4" /></button>
      <button
        className={btn + " text-[10px] font-semibold"}
        onClick={() => { toggle3D(); setFlat((f) => !f); }}
        aria-label={flat ? "Vedere 3D" : "Vedere 2D"}
      >
        {flat ? <Box className="size-4" /> : "2D"}
      </button>
    </div>
  );
}