"use client";

// Monochrome line motifs used as faint 3D-ish background illustrations behind
// bento cards (data-dependent). Stroke = currentColor so the card tints them.

import * as React from "react";
import { cn } from "@/lib/utils";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export type MotifName = "trend" | "building" | "skyline" | "waves" | "radar" | "calendar" | "occupancy" | "compass";

export function Motif({ name, className }: { name: MotifName; className?: string }) {
  const common = { viewBox: "0 0 160 120", className, "aria-hidden": true, ...S } as React.SVGProps<SVGSVGElement>;
  switch (name) {
    case "trend":
      return (<svg {...common}><path d="M8 104 L40 78 L72 86 L104 50 L152 26" /><path d="M132 26 H152 V46" /><line x1="8" y1="116" x2="152" y2="116" opacity="0.4" /><line x1="28" y1="116" x2="28" y2="92" opacity="0.5" /><line x1="56" y1="116" x2="56" y2="98" opacity="0.5" /><line x1="84" y1="116" x2="84" y2="86" opacity="0.5" /></svg>);
    case "building":
    case "skyline":
      return (<svg {...common}><path d="M6 114 V62 H36 V114" /><path d="M36 114 V86 H68 V114" /><path d="M68 114 V42 H100 V114" /><path d="M100 114 V72 H152 V114" /><g opacity="0.5"><line x1="14" y1="74" x2="28" y2="74" /><line x1="14" y1="90" x2="28" y2="90" /><line x1="76" y1="56" x2="92" y2="56" /><line x1="76" y1="76" x2="92" y2="76" /><line x1="76" y1="96" x2="92" y2="96" /><line x1="112" y1="86" x2="140" y2="86" /></g></svg>);
    case "waves":
      return (<svg {...common}><path d="M2 50 Q22 38 42 50 T82 50 T122 50 T162 50" /><path d="M2 72 Q22 60 42 72 T82 72 T122 72 T162 72" opacity="0.6" /><path d="M2 94 Q22 82 42 94 T82 94 T122 94 T162 94" opacity="0.35" /></svg>);
    case "radar":
      return (<svg {...common}><circle cx="80" cy="62" r="16" /><circle cx="80" cy="62" r="34" opacity="0.6" /><circle cx="80" cy="62" r="52" opacity="0.35" /><line x1="80" y1="62" x2="80" y2="8" /><line x1="80" y1="62" x2="132" y2="42" opacity="0.7" /><circle cx="110" cy="40" r="2.6" fill="currentColor" stroke="none" /></svg>);
    case "calendar":
      return (<svg {...common}><rect x="16" y="20" width="128" height="88" rx="8" /><line x1="16" y1="44" x2="144" y2="44" /><line x1="48" y1="14" x2="48" y2="28" /><line x1="112" y1="14" x2="112" y2="28" /><g opacity="0.5"><line x1="48" y1="44" x2="48" y2="108" /><line x1="80" y1="44" x2="80" y2="108" /><line x1="112" y1="44" x2="112" y2="108" /><line x1="16" y1="66" x2="144" y2="66" /><line x1="16" y1="88" x2="144" y2="88" /></g><rect x="84" y="48" width="24" height="16" rx="2" fill="currentColor" stroke="none" opacity="0.5" /></svg>);
    case "occupancy":
      return (<svg {...common}><g>{[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => { const filled = (r * 5 + c) % 3 === 0; return <rect key={`${r}-${c}`} x={16 + c * 28} y={20 + r * 24} width="20" height="16" rx="2" fill={filled ? "currentColor" : "none"} stroke="currentColor" opacity={filled ? 0.5 : 1} />; }))}</g></svg>);
    case "compass":
      return (<svg {...common}><circle cx="80" cy="60" r="44" /><path d="M80 26 L94 60 L80 94 L66 60 Z" /><circle cx="80" cy="60" r="3" fill="currentColor" stroke="none" /></svg>);
    default:
      return null;
  }
}

// Faint, large background watermark with a subtle hover parallax.
export function CardBackdrop({ name, className }: { name: MotifName; className?: string }) {
  return (
    <span className={cn("pointer-events-none absolute -bottom-5 -right-4 z-[1] h-28 w-36 opacity-[.06] transition-all duration-500 group-hover:-translate-y-1 group-hover:opacity-[.12]", className)} aria-hidden>
      <Motif name={name} className="h-full w-full" />
    </span>
  );
}
