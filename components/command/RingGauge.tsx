"use client";

// RingGauge - an AQI-style dotted circular gauge. Dots fill proportionally to
// value; big number + label in the center.

import * as React from "react";
import { motion } from "framer-motion";
import { CountUp } from "./live-charts";

export function RingGauge({
  value, label, sub, color = "#22d3ee", size = 132, dots = 46,
}: {
  value: number; label?: string; sub?: string; color?: string; size?: number; dots?: number;
}) {
  const filled = Math.round((value / 100) * dots);
  const cx = size / 2, cy = size / 2, R = size / 2 - 9;
  const points = Array.from({ length: dots }).map((_, i) => {
    const a = (i / dots) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, on: i < filled };
  });
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        {points.map((p, i) => (
          <motion.circle key={i} cx={p.x} cy={p.y} r={p.on ? 1.9 : 1.3}
            fill={p.on ? color : "rgba(255,255,255,0.16)"}
            style={{ filter: p.on ? `drop-shadow(0 0 3px ${color})` : "none" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.012, duration: 0.3 }} />
        ))}
      </svg>
      <div className="text-center leading-none">
        <div className="text-[30px] font-semibold tabular-nums text-white"><CountUp value={value} /></div>
        {sub ? <div className="mt-0.5 text-[10px] uppercase tracking-[.14em] text-white/45">{sub}</div> : null}
      </div>
      {label ? <div className="absolute -bottom-1 text-[10px] uppercase tracking-[.12em]" style={{ color }}>{label}</div> : null}
    </div>
  );
}
