"use client";

// AssetCard - a true-glass hospitality asset card. Daily occupancy, an angled
// aerial mini-map that blends into the card, and a weekly forecast SLIDER with a
// popup that follows the handle to show how the metric evolves across the week.

import * as React from "react";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, MapPin, Radio, Wifi, Crosshair, ChevronRight } from "lucide-react";
import { HotelLineArt, RouteUnderlay } from "./illustrations";
import { cn } from "@/lib/utils";
import { ron } from "@/lib/command-theme";
import type { DayPoint } from "@/lib/asset-forecast";

export interface AssetCardData {
  name: string;
  city?: string;
  stars?: number;
  code: string;
  accent?: string;
  occupancy: number;
  adr: number;
  forecast: DayPoint[];
  timeISO?: string;
  isOwn?: boolean;
  className?: string;
  dimmed?: boolean;
  onOpen?: () => void;
  onLocate?: () => void;
  onHoverChange?: (h: boolean) => void;
}

type Metric = "occ" | "adr";

function fmtTime(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".");
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

function metricVal(d: DayPoint, m: Metric): number {
  return m === "occ" ? d.occ : d.adr;
}

function MetricToggle({ metric, onChange, accent }: { metric: Metric; onChange: (m: Metric) => void; accent: string }) {
  return (
    <div className="relative flex h-6 w-[92px] shrink-0 items-center rounded-full bg-white/[.05] p-0.5 text-[10.5px] font-medium">
      <motion.span layout className="absolute h-5 w-[44px] rounded-full"
        style={{ background: "rgba(255,255,255,.12)", boxShadow: `inset 0 0 0 1px ${accent}55`, left: metric === "occ" ? 2 : 46 }}
        transition={{ type: "spring", stiffness: 440, damping: 34 }} />
      <button onClick={() => onChange("occ")} className={cn("relative z-10 flex-1 cursor-pointer rounded-full py-0.5 transition-colors", metric === "occ" ? "text-white" : "text-white/45")}>Occ</button>
      <button onClick={() => onChange("adr")} className={cn("relative z-10 flex-1 cursor-pointer rounded-full py-0.5 transition-colors", metric === "adr" ? "text-white" : "text-white/45")}>ADR</button>
    </div>
  );
}

function ForecastSlider({ forecast, metric, accent }: { forecast: DayPoint[]; metric: Metric; accent: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const todayIdx = Math.max(0, forecast.findIndex((d) => d.today));
  const [pos, setPos] = useState(todayIdx / 6);
  const [active, setActive] = useState(false);

  const vals = forecast.map((d) => metricVal(d, metric));
  const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(1, max - min);

  const f = pos * 6;
  const i0 = Math.floor(f), i1 = Math.min(6, i0 + 1), frac = f - i0;
  const val = Math.round(vals[i0] + (vals[i1] - vals[i0]) * frac);
  const dayLabel = forecast[Math.round(f)].day;

  const setFromX = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  };
  const onDown = (e: React.PointerEvent) => { draggingRef.current = true; setActive(true); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setFromX(e.clientX); };
  const onMove = (e: React.PointerEvent) => { if (draggingRef.current) setFromX(e.clientX); };
  const onUp = () => { draggingRef.current = false; setActive(false); };

  // sparkline track (the week curve)
  const W = 100, H = 30;
  const pts = vals.map((v, i) => [(i / 6) * W, H - 3 - ((v - min) / span) * (H - 8)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
  const popLeft = Math.max(13, Math.min(87, pos * 100));

  return (
    <div className="relative pt-7">
      {/* popup follows the handle */}
      <AnimatePresence>
        {active ? (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }}
            className="gx gx-bento pointer-events-none absolute top-0 z-20 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 text-[11px]"
            style={{ left: `${popLeft}%` }}>
            <span className="font-medium text-white/55">{dayLabel}</span>{" "}
            <span className="font-semibold tabular-nums" style={{ color: accent }}>{metric === "occ" ? `${val}%` : `${ron(val)} RON`}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div ref={trackRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerEnter={() => setActive(true)} onPointerLeave={onUp}
        className="relative h-[30px] cursor-ew-resize touch-none select-none">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d={area} fill={accent} opacity="0.13" />
          <path d={line} fill="none" stroke={accent} strokeWidth="1.4" opacity="0.65" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="tick-ruler absolute inset-x-0 bottom-0" />
        <div className="absolute bottom-0 top-0 w-px" style={{ left: `${pos * 100}%`, background: accent, opacity: 0.8, boxShadow: `0 0 8px ${accent}` }} />
        <div className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${pos * 100}%`, top: "50%", background: accent }} />
      </div>
    </div>
  );
}

export function AssetCard({
  name, city, stars = 4, code, accent = "#22D3EE", occupancy, adr, forecast, timeISO, className, dimmed, onOpen, onLocate, onHoverChange,
}: AssetCardData) {
  const [metric, setMetric] = useState<Metric>("occ");

  return (
    <motion.article
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      animate={{ opacity: dimmed ? 0.55 : 1, scale: dimmed ? 0.985 : 1, filter: dimmed ? "saturate(0.65)" : "saturate(1)" }}
      transition={{ duration: 0.3 }}
      className={cn("gx-glass snap-card group relative flex w-[300px] shrink-0 flex-col p-5 sm:w-[320px]", className)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[19px] font-semibold leading-tight text-white">{name}</h3>
          <div className="mt-1 text-[11.5px] tabular-nums text-white/45">{fmtTime(timeISO)}</div>
        </div>
        <button onClick={onOpen} aria-label="Open dossier" className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/[.08] hover:text-white">
          <ArrowUpRight className="size-4.5" />
        </button>
      </div>

      {/* Illustration + plate */}
      <div className="relative mt-3 grid place-items-center py-2">
        <HotelLineArt className="h-[104px] w-full text-white/55 transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute flex items-center gap-2 rounded-full border border-white/10 bg-black/30 py-1 pl-1 pr-3.5 backdrop-blur-md">
          <span className="grid size-7 place-items-center rounded-full bg-white/12 text-[12px] font-semibold text-white/90">{stars}</span>
          <span className="font-mono text-[15px] tracking-[.06em] text-white tabular-nums">{code}</span>
        </div>
      </div>

      {/* Occupancy stat + feeds */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <button onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-full bg-white/[.05] py-1.5 pl-3 pr-2.5 text-[12.5px] text-white/85 transition-colors hover:bg-white/[.09]">
          <span className="size-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
          Occupancy <span className="font-semibold tabular-nums text-white">{occupancy}%</span>
          <ChevronRight className="size-3.5 text-white/40" />
        </button>
        <div className="flex items-center gap-3 text-white/65">
          <span className="inline-flex items-center gap-1.5 text-[12px]"><Radio className="size-3.5" /> OTA</span>
          <span className="inline-flex items-center gap-1.5 text-[12px]"><Wifi className="size-3.5" /> PMS</span>
        </div>
      </div>

      {/* Angled aerial map - blends into the card */}
      <button onClick={onLocate} className="group/map relative mt-3 block h-[92px] w-full overflow-hidden text-left">
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ transform: "perspective(640px) rotateX(46deg) scale(1.28) translateY(6%)", transformOrigin: "50% 84%", WebkitMaskImage: "radial-gradient(135% 105% at 50% 16%, #000 46%, transparent 92%)", maskImage: "radial-gradient(135% 105% at 50% 16%, #000 46%, transparent 92%)" }}>
            <RouteUnderlay className="h-full w-full text-white/90" accent={accent} />
          </div>
        </div>
        <span className="absolute left-[20%] top-[52%] -translate-x-1/2 -translate-y-full" style={{ color: accent }}>
          <MapPin className="size-5" style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
        </span>
        <span className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[10px] text-white/55 opacity-0 backdrop-blur transition-opacity group-hover/map:opacity-100">
          <Crosshair className="size-3" /> Locate
        </span>
        {city ? <span className="absolute bottom-1 right-1 text-[10px] uppercase tracking-[.12em] text-white/30">{city}</span> : null}
      </button>

      {/* Weekly forecast slider */}
      <div className="mt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[.14em] text-white/40">7-day forecast</span>
          <MetricToggle metric={metric} onChange={setMetric} accent={accent} />
        </div>
        <ForecastSlider forecast={forecast} metric={metric} accent={accent} />
        <div className="flex items-center justify-between text-[10px] tabular-nums text-white/40">
          <span>Mon</span><span>Sun</span>
        </div>
      </div>
    </motion.article>
  );
}
