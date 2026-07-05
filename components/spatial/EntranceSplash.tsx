"use client";

import { useEffect, useRef, useState } from "react";
import { SpiralAnimation } from "@/components/ui/spiral-animation";

// Cinematic entrance: spiral with the AEther wordmark centered on it. No click.
// Aether fades, then the whole splash crossfades out to reveal the 3D globe map
// underneath (which begins zooming to the property when onReveal fires).
export default function EntranceSplash({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const [showText, setShowText] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const revealed = useRef(false);
  const done = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowText(true), 1000);
    const t2 = setTimeout(() => setShowText(false), 2700);
    const t3 = setTimeout(() => { setLeaving(true); if (!revealed.current) { revealed.current = true; onReveal(); } }, 3100);
    const t4 = setTimeout(() => { if (!done.current) { done.current = true; onDone(); } }, 4200);
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden bg-black ease-out"
      style={{ opacity: leaving ? 0 : 1, transition: "opacity 1100ms ease-out" }}
    >
      {/* Blender-rendered Neptun night massing (scripts/blender_hero_render.py,
          real OSM footprints) - the world the spiral resolves into */}
      <img src="/world/neptun-hero.jpg" alt="" aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 0.55, transform: leaving ? "scale(1.02)" : "scale(1.08)",
                 transition: "transform 4200ms linear, opacity 1100ms ease-out" }} />
      <div className="absolute inset-0" style={{ background: "rgba(2,4,8,.45)" }} />
      <div className="absolute inset-0"><SpiralAnimation /></div>
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 ease-out"
        style={{ opacity: showText ? 1 : 0, transition: "opacity 800ms ease-out" }}
      >
        <span
          className="text-[clamp(44px,9vw,98px)] font-extralight leading-none tracking-[0.14em] text-white"
          style={{ textShadow: "0 0 40px rgba(255,255,255,0.30), 0 0 95px rgba(200,161,101,0.18)" }}
        >
          &AElig;ther
        </span>
      </div>
    </div>
  );
}
