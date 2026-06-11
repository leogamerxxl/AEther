// Monochrome line illustrations for asset cards. Stroke = currentColor so the
// parent controls the tint.

import * as React from "react";

export function HotelLineArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 180" fill="none" stroke="currentColor" strokeWidth={1.3}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <line x1="14" y1="156" x2="306" y2="156" opacity="0.45" />
      <path d="M96 156 V44 q0 -6 6 -6 H214 q6 0 6 6 V156" />
      <line x1="96" y1="50" x2="220" y2="50" />
      <line x1="96" y1="72" x2="220" y2="72" opacity="0.7" />
      <line x1="96" y1="94" x2="220" y2="94" opacity="0.7" />
      <line x1="96" y1="116" x2="220" y2="116" opacity="0.7" />
      <line x1="96" y1="138" x2="220" y2="138" opacity="0.7" />
      <line x1="123" y1="50" x2="123" y2="156" opacity="0.4" />
      <line x1="150" y1="50" x2="150" y2="138" opacity="0.4" />
      <line x1="166" y1="50" x2="166" y2="138" opacity="0.4" />
      <line x1="193" y1="50" x2="193" y2="156" opacity="0.4" />
      <path d="M150 156 V140 h16 v16" />
      <path d="M143 140 h30" opacity="0.85" />
      <path d="M40 156 V92 h56" opacity="0.9" />
      <line x1="40" y1="112" x2="96" y2="112" opacity="0.55" />
      <line x1="40" y1="134" x2="96" y2="134" opacity="0.55" />
      <line x1="68" y1="92" x2="68" y2="156" opacity="0.35" />
      <path d="M220 156 V104 h44 V156" opacity="0.9" />
      <line x1="220" y1="126" x2="264" y2="126" opacity="0.55" />
      <line x1="242" y1="104" x2="242" y2="156" opacity="0.35" />
      <path d="M286 156 q-4 -26 2 -44" opacity="0.8" />
      <path d="M288 112 q-12 -6 -20 -2" opacity="0.8" />
      <path d="M288 112 q12 -6 20 -2" opacity="0.8" />
      <path d="M288 112 q-6 -12 -2 -22" opacity="0.8" />
      <path d="M288 112 q9 -10 17 -12" opacity="0.8" />
    </svg>
  );
}

// Spatial street map underlay with a glowing route + pin anchor point.
export function RouteUnderlay({ className, accent = "currentColor" }: { className?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 320 130" fill="none" className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      {/* street grid */}
      <g stroke="currentColor" strokeWidth={1} opacity="0.14">
        <line x1="0" y1="26" x2="320" y2="26" />
        <line x1="0" y1="58" x2="320" y2="58" />
        <line x1="0" y1="92" x2="320" y2="92" />
        <line x1="46" y1="0" x2="46" y2="130" />
        <line x1="122" y1="0" x2="122" y2="130" />
        <line x1="196" y1="0" x2="196" y2="130" />
        <line x1="262" y1="0" x2="262" y2="130" />
        <line x1="0" y1="120" x2="200" y2="0" opacity="0.7" />
      </g>
      {/* blocks */}
      <g fill="currentColor" opacity="0.05">
        <rect x="52" y="32" width="62" height="20" rx="2" />
        <rect x="128" y="64" width="60" height="22" rx="2" />
        <rect x="202" y="32" width="52" height="20" rx="2" />
        <rect x="202" y="96" width="52" height="22" rx="2" />
      </g>
      {/* active route */}
      <path d="M40 104 L40 60 L120 60 L120 30 L240 30" stroke={accent} strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
        style={{ filter: `drop-shadow(0 0 4px ${accent})` }} />
      {/* POIs */}
      <g fill="currentColor" opacity="0.4">
        <rect x="237" y="27" width="6" height="6" rx="1" />
        <rect x="117" y="57" width="6" height="6" rx="1" />
      </g>
    </svg>
  );
}
