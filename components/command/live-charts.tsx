"use client";

// Live, animated chart primitives: a number that counts up, and a sparkline
// that draws itself on mount with a pulsing "live" endpoint.

import * as React from "react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function CountUp({ value, decimals = 0, duration = 950, className }: { value: number; decimals?: number; duration?: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setN(value * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={cn("tabular-nums", className)}>{n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

export function LiveSparkline({ data, stroke = "#22D3EE", fill = true, live = true, className }: { data: number[]; stroke?: string; fill?: boolean; live?: boolean; className?: string }) {
  const W = 120, H = 36;
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 7)] as const);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
  const last = pts[pts.length - 1];
  const lx = (last[0] / W) * 100, ly = (last[1] / H) * 100;

  return (
    <div className={cn("relative h-full w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {fill ? <motion.path d={area} fill={stroke} initial={{ opacity: 0 }} animate={{ opacity: 0.12 }} transition={{ duration: 0.7 }} /> : null}
        <motion.path d={line} fill="none" stroke={stroke} strokeWidth={1.6} vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeOut" }} />
      </svg>
      {live ? (
        <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${lx}%`, top: `${ly}%` }}>
          <span className="relative grid size-1.5 place-items-center">
            <span className="absolute size-1.5 rounded-full" style={{ background: stroke, animation: "gxping 1.9s ease-out infinite" }} />
            <span className="size-1.5 rounded-full" style={{ background: stroke, boxShadow: `0 0 6px ${stroke}` }} />
          </span>
        </span>
      ) : null}
    </div>
  );
}
