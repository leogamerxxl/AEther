"use client";

// Aether - Command Center (Mapbox GL dark-v11 + 3D buildings, cyan command deck).
// Native Mapbox markers; click a pin -> fly + open the Dossier. Framer-Motion panels.

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion } from "framer-motion";
import {
  ALL_POINTS, COMPETITORS_WITH_DIST, OWN, MARKET_AVG, METRICS, TRAJECTORY, type Point,
} from "@/lib/corridor";
import { ArrowUpRight, Crosshair } from "lucide-react";
import Dossier from "./Dossier";import { supabase } from "@/lib/supabase";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";
const OVERVIEW = { center: [28.61, 44.02] as [number, number], zoom: 8.6, pitch: 0, bearing: 0 };
const C = { pos: "#4ADE80", neg: "#F87171", accent: "#22D3EE", hi: "#EDEDED", mid: "#A1A1A1", lo: "#6B6B6B" };

function useCountUp(target: number, decimals = 0, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => { const t = Math.min(1, (now - start) / ms); setV(target * ease(t)); if (t < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v.toFixed(decimals);
}

type Flag = { level: "alert" | "watch" | null; reason: string };
function inspectFlag(p: Point): Flag {
  if (p.alert) return { level: "alert", reason: "No rate data" };
  if (p.rate != null) {
    const gap = p.rate - MARKET_AVG;
    if (p.avail >= 88) return { level: "watch", reason: p.avail + "% open" };
    if (gap <= -8) return { level: "watch", reason: "-" + Math.abs(gap) + " vs mkt" };
  }
  return { level: null, reason: "" };
}
function dotColor(p: Point, f: Flag) {
  if (f.level === "alert") return C.neg;
  if (p.own) return C.accent;
  return "#5B7FA6";
}

function TrendChart({ data, color = C.accent, height = 60 }: { data: number[]; color?: string; height?: number }) {
  const w = 280, padL = 4, padR = 4, padT = 6, padB = 8;
  const min = Math.min(...data), mx = Math.max(...data);
  const lo = min - (mx - min) * 0.18, hi = mx + (mx - min) * 0.18;
  const X = (i: number) => padL + (i * (w - padL - padR)) / (data.length - 1);
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (height - padT - padB);
  const d = data.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  return (
    <svg viewBox={"0 0 " + w + " " + height} className="w-full" preserveAspectRatio="none">
      <defs><linearGradient id="vfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[0, 0.5, 1].map((g) => { const yy = padT + g * (height - padT - padB); return <line key={g} x1={padL} x2={w - padR} y1={yy} y2={yy} stroke="rgba(255,255,255,.05)" strokeWidth={0.5} />; })}
      <path d={d + " L" + X(data.length - 1) + " " + (height - padB) + " L" + padL + " " + (height - padB) + " Z"} fill="url(#vfill)" />
      <path className="draw" pathLength={1} d={d} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

export default function CommandCenter() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [detail, setDetail] = useState<Point | null>(null);
  const [ready, setReady] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  const occ = useCountUp(METRICS.occupancy, 1);
  const adr = useCountUp(METRICS.adr);
  const revpar = useCountUp(METRICS.revpar);
  const gap = (OWN.rate as number) - MARKET_AVG;
  const flaggedCount = ALL_POINTS.filter((p) => inspectFlag(p).level).length;
  const rows = [...ALL_POINTS].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

  const openDetail = (p: Point) => {
    setSelectedId(p.id); setZoomed(true); setDetail(p);
    mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 15.4, pitch: 55, bearing: -18, duration: 2000 });
  };
  const resetView = () => {
    setSelectedId(null); setZoomed(false);
    mapRef.current?.flyTo({ center: OVERVIEW.center, zoom: OVERVIEW.zoom, pitch: OVERVIEW.pitch, bearing: OVERVIEW.bearing, duration: 1500 });
  };

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    if (!mapboxgl.accessToken) { setTokenMissing(true); return; }
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: OVERVIEW.center, zoom: OVERVIEW.zoom, pitch: OVERVIEW.pitch, bearing: OVERVIEW.bearing,
      antialias: true, attributionControl: false, maxPitch: 70,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.on("style.load", () => {
      try { map.setProjection({ name: "globe" }); } catch { /* noop */ }
      try {
        map.addLayer({
          id: "3d-buildings", source: "composite", "source-layer": "building",
          filter: ["==", "extrude", "true"], type: "fill-extrusion", minzoom: 13,
          paint: {
            "fill-extrusion-color": "#12161a",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": 0.85,
          },
        } as mapboxgl.FillExtrusionLayerSpecification);
      } catch { /* noop */ }
    });
    map.on("load", () => setReady(true));
    const rs = setTimeout(() => { try { map.resize(); } catch { /* noop */ } }, 300);
    return () => { clearTimeout(rs); markersRef.current.forEach((m) => m.remove()); markersRef.current = []; map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = ALL_POINTS.map((p) => {
      const f = inspectFlag(p);
      const el = document.createElement("div");
      el.style.cssText = "cursor:pointer;width:28px;height:28px;display:grid;place-items:center;";
      const ring = f.level ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:1px solid ${f.level === "alert" ? C.neg : C.accent};opacity:.5;"></span>` : "";
      el.innerHTML = `<span style="position:relative;display:grid;place-items:center;">${ring}<span style="width:11px;height:11px;border-radius:9999px;border:1px solid rgba(255,255,255,.7);background:${dotColor(p, f)};box-shadow:${p.own ? "0 0 9px " + C.accent : "0 0 4px rgba(0,0,0,.55)"};"></span></span>`;
      el.addEventListener("click", (ev) => { ev.stopPropagation(); openDetail(p); });
      return new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
    });
    return () => { markersRef.current.forEach((m) => m.remove()); markersRef.current = []; };
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    supabase.from("local_amenities_geo").select("name,environment_category,lng,lat").then(({ data }) => {
      const list = (data ?? []) as { name: string; environment_category: string; lng: number; lat: number }[];
      if (cancelled || !map.getStyle()) return;
      const fc = {
        type: "FeatureCollection" as const,
        features: list.map((a) => ({
          type: "Feature" as const,
          properties: { cat: a.environment_category, name: a.name },
          geometry: { type: "Point" as const, coordinates: [a.lng, a.lat] as [number, number] },
        })),
      };
      const src = map.getSource("amenities") as mapboxgl.GeoJSONSource | undefined;
      if (src) { src.setData(fc); return; }
      map.addSource("amenities", { type: "geojson", data: fc });
      map.addLayer({
        id: "amenities", type: "circle", source: "amenities", minzoom: 10,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2, 15, 4.5],
          "circle-color": ["match", ["get", "cat"], "coast", "#22D3EE", "wellness", "#4ADE80", "attraction", "#C084FC", "#5B7280"],
          "circle-opacity": 0.72,
          "circle-stroke-width": 0.5,
          "circle-stroke-color": "rgba(255,255,255,.25)",
        },
      } as mapboxgl.CircleLayerSpecification);
    });
    return () => { cancelled = true; };
  }, [ready]);

  return (
    <div className="h-screen w-full bg-black p-3">
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/10">
        <div ref={mapContainer} className="absolute inset-0 h-full w-full" />

        {tokenMissing && (
          <div className="absolute inset-0 grid place-items-center bg-black text-center text-[13px] text-[#A1A1A1]">
            <div>Add <span className="text-[#22D3EE]">NEXT_PUBLIC_MAPBOX_TOKEN</span> to .env.local and restart the dev server.</div>
          </div>
        )}

        <div className="absolute left-3 top-3 z-10 flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#0A0A0A]/90 px-3 py-1.5 backdrop-blur-sm">
          <span className="text-[10px] tracking-[.16em] text-[#A1A1A1]">{zoomed ? "ORIENT" : "OBSERVE"}</span>
          <span className="h-3 w-px bg-white/10" />
          <span className="text-[11px] tabular-nums text-[#EDEDED]">{ALL_POINTS.length} properties</span>
          <span className="flex items-center gap-1 text-[11px] tabular-nums text-[#22D3EE]"><span className="size-1.5 rounded-full bg-[#22D3EE]" />{flaggedCount} flagged</span>
        </div>

        <motion.div
          initial={{ opacity: 0, x: -24, filter: "blur(8px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.05 }}
          className="absolute left-3 top-[54px] z-10 w-[320px] rounded-xl border border-white/10 bg-[#0A0A0A] p-5"
        >
          <div className="text-[10px] uppercase tracking-wider text-[#6B6B6B]">Occupancy</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-[40px] font-semibold leading-none tracking-tight tabular-nums text-[#EDEDED]">{occ}</span>
            <span className="text-[15px] text-[#6B6B6B]">%</span>
            <span className="ml-auto text-[10px] tabular-nums text-[#6B6B6B]">target 80</span>
          </div>
          <div className="mt-3"><TrendChart data={TRAJECTORY} /></div>
          <div className="mt-1 text-[11px] text-[#6B6B6B]">Corridor rate <span className="tabular-nums">598-625</span> - 14 days</div>
          <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/[.06] bg-white/[.05]">
            {([["ADR", adr], ["RevPAR", revpar], ["Gap", String(gap)]] as [string, string][]).map(([k, v]) => (
              <div key={k} className="bg-[#0A0A0A] p-2"><div className="text-[9px] uppercase tracking-wider text-[#6B6B6B]">{k}</div><div className="mt-0.5 text-[15px] font-medium tabular-nums text-[#EDEDED]">{v}</div></div>
            ))}
          </div>
          <button className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-lg border border-[#22D3EE]/30 bg-[#22D3EE]/[.08] px-3 py-2 text-left outline-none transition-colors hover:bg-[#22D3EE]/[.14] focus-visible:ring-1 focus-visible:ring-[#22D3EE]/50">
            <span><span className="block text-[11px] font-medium text-[#EDEDED]">Raise 6-8 Jun - 575 to 605</span><span className="block text-[10px] tabular-nums text-[#6B6B6B]">88% confidence</span></span>
            <ArrowUpRight className="size-4 text-[#22D3EE]" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.1 }}
          className="absolute right-3 top-3 z-10 w-[320px] rounded-xl border border-white/10 bg-[#0A0A0A] p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#EDEDED]">Competitive set</span>
            <span className="text-[10px] tabular-nums text-[#6B6B6B]">{COMPETITORS_WITH_DIST.length} tracked</span>
          </div>
          <div className="grid grid-cols-[1fr_46px_46px_42px] gap-x-2 border-b border-white/[.07] pb-1.5 text-[10px] uppercase tracking-wider text-[#6B6B6B]">
            <span>Hotel</span><span className="text-right">Rate</span><span className="text-right">d Mkt</span><span className="text-right">Avail</span>
          </div>
          <div className="mt-1 max-h-[44vh] overflow-auto">
            {rows.map((p) => { const g = p.rate == null ? null : p.rate - MARKET_AVG; return (
              <button key={p.id} onClick={() => openDetail(p)} className={"grid w-full cursor-pointer grid-cols-[1fr_46px_46px_42px] gap-x-2 rounded-md px-1.5 py-1.5 text-left text-[12px] outline-none transition-colors hover:bg-white/[.04] focus-visible:ring-1 focus-visible:ring-white/20 " + (selectedId === p.id ? "bg-white/[.05]" : "")}>
                <span className={"truncate " + (p.own ? "font-medium text-[#22D3EE]" : "text-[#A1A1A1]")}>{p.own ? "Hotel Terra" : p.name}</span>
                <span className="text-right tabular-nums text-[#EDEDED]">{p.rate ?? "-"}</span>
                <span className={"text-right tabular-nums " + (g == null ? "text-[#6B6B6B]" : g >= 0 ? "text-[#4ADE80]" : "text-[#F87171]")}>{g == null ? "-" : (g >= 0 ? "+" : "") + g}</span>
                <span className="text-right tabular-nums text-[#A1A1A1]">{p.avail}%</span>
              </button>
            ); })}
          </div>
        </motion.div>

        <Dossier point={detail} open={!!detail} onClose={() => setDetail(null)} />

        {zoomed && (
          <button onClick={resetView} className="absolute bottom-3 left-3 z-10 flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-1.5 text-[11px] text-[#A1A1A1] outline-none transition-colors hover:text-[#EDEDED] focus-visible:ring-1 focus-visible:ring-white/30">
            <Crosshair className="size-3.5" /> Overview
          </button>
        )}
      </div>
    </div>
  );
}
