"use client";

// Aether spatial intelligence map (OODA spine):
//  OBSERVE  - corridor overview, all properties, flagged ones glow
//  ORIENT   - click a pin -> cinematic flyTo into the 3D structure
//  DECIDE   - glass popup with rate / availability / vs-market + live sparkline
//  ACT      - "inspect-worthy" flags surface what to act on
// Free MapLibre 3D buildings (OpenFreeMap). Real data from lib/corridor.
// Glass + glow are a user-approved, amber-only treatment (see DESIGN.md note).
// Route: /mapcn

import { useEffect, useRef, useState } from "react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MarkerPopup,
  MapControls,
  useMap,
  type MapRef,
} from "@/components/ui/mapcn-marker-popup";
import { ALL_POINTS, MARKET_AVG, TRAJECTORY, type Point } from "@/lib/corridor";
import { TrendingUp, TrendingDown, BedDouble, Star, CalendarClock, Hash, Crosshair, AlertTriangle } from "lucide-react";

const OPENFREEMAP_DARK = "https://tiles.openfreemap.org/styles/dark";
const HOTEL_IMG = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=320&h=180&fit=crop";

// Corridor overview (OBSERVE) and per-pin close-up (ORIENT) camera states.
const OVERVIEW = { center: [28.628, 44.02] as [number, number], zoom: 9, pitch: 26, bearing: -8 };

type Flag = { level: "alert" | "watch" | null; reason: string };
function inspectFlag(p: Point): Flag {
  if (p.alert) return { level: "alert", reason: "No rate data - verify listing" };
  if (p.rate != null) {
    const gap = p.rate - MARKET_AVG;
    if (p.avail >= 88) return { level: "watch", reason: `Soft demand - ${p.avail}% open` };
    if (gap <= -8) return { level: "watch", reason: `Underpricing market by ${Math.abs(gap)} RON` };
  }
  return { level: null, reason: "" };
}

function dotClass(p: Point) {
  if (p.alert) return "bg-[var(--negative)]";
  if (p.own) return "bg-[var(--accent)]";
  return "bg-[#7896B9]";
}
function glowFor(p: Point, f: Flag) {
  if (f.level === "alert") return "0 0 12px 3px rgba(194,77,77,.75)";
  if (p.own) return "0 0 12px 3px rgba(200,161,101,.65)";
  if (f.level === "watch") return "0 0 10px 2px rgba(200,161,101,.5)";
  return "0 0 6px 1px rgba(0,0,0,.55)";
}

// 14-day corridor trajectory as a glowing sparkline; dashed line = this rate.
function Sparkline({ refValue }: { refValue?: number | null }) {
  const w = 168, h = 36, pad = 3;
  const data = TRAJECTORY;
  const min = Math.min(...data), max = Math.max(...data);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (data.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const ry = refValue != null ? y(Math.max(min, Math.min(max, refValue))) : null;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={`${d} L${(w - pad).toFixed(1)} ${h - pad} L${pad} ${h - pad} Z`} fill="rgba(200,161,101,.10)" stroke="none" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(200,161,101,.6))" }} />
      {ry != null && <line x1={pad} x2={w - pad} y1={ry} y2={ry} stroke="var(--text-3)" strokeDasharray="3 3" strokeWidth={1} />}
    </svg>
  );
}

function Buildings3D() {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!isLoaded || !map) return;
    if (map.getLayer("aether-buildings")) return;
    const style = map.getStyle();
    const layers = style.layers ?? [];
    const bl = layers.find((l) => (l as { "source-layer"?: string })["source-layer"] === "building") as { source?: string } | undefined;
    let source = bl?.source;
    if (!source) source = Object.entries(style.sources ?? {}).find(([, s]) => (s as { type?: string }).type === "vector")?.[0];
    if (!source) return;
    const firstSymbol = layers.find((l) => l.type === "symbol")?.id;
    map.addLayer({
      id: "aether-buildings",
      type: "fill-extrusion",
      source,
      "source-layer": "building",
      minzoom: 13,
      paint: {
        "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 8], 0, "#15110E", 12, "#1C1712", 40, "#241D16", 100, "#2E2519"],
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, ["coalesce", ["get", "render_height"], 8]],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.92,
      },
    }, firstSymbol);
    return () => { if (map.getLayer("aether-buildings")) map.removeLayer("aether-buildings"); };
  }, [isLoaded, map]);
  return null;
}

const SOURCES: [string, string][] = [
  ["Reviews & rating", "Connect Google / TripAdvisor"],
  ["Booking pace", "Connect Booking.com"],
  ["Social posts", "Connect Instagram / TikTok"],
];
const SOURCE_ICON = [Star, CalendarClock, Hash];

export default function MapcnMarkerDemo() {
  const mapRef = useRef<MapRef>(null);
  const [zoomed, setZoomed] = useState(false);

  const flags = ALL_POINTS.map(inspectFlag);
  const flaggedCount = flags.filter((f) => f.level).length;

  const flyToPin = (p: Point) =>
    mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 15.6, pitch: 62, bearing: -22, duration: 2200, essential: true });
  const resetView = () => {
    mapRef.current?.flyTo({ ...OVERVIEW, duration: 1600, essential: true });
    setZoomed(false);
  };

  return (
    <div className="h-screen w-full bg-[var(--bg)] p-4">
      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-[var(--border)] shadow-[0_8px_30px_rgba(0,0,0,.35)]">
        <Map ref={mapRef} theme="dark" styles={{ dark: OPENFREEMAP_DARK }} center={OVERVIEW.center} zoom={OVERVIEW.zoom} pitch={OVERVIEW.pitch} bearing={OVERVIEW.bearing} maxPitch={70}>
          <Buildings3D />
          <MapControls showZoom showCompass position="bottom-right" />

          {ALL_POINTS.map((p, i) => {
            const f = flags[i];
            const gap = p.rate == null ? null : p.rate - MARKET_AVG;
            return (
              <MapMarker key={p.id} longitude={p.lng} latitude={p.lat} onClick={() => { setZoomed(true); flyToPin(p); }}>
                <MarkerContent>
                  <div className="relative">
                    {f.level && (
                      <span className={`absolute -inset-2 rounded-full ring-2 ${f.level === "alert" ? "ring-[var(--negative)]" : "ring-[var(--accent)]"} opacity-60 animate-pulse`} />
                    )}
                    <div className={`size-3.5 rounded-full border-2 border-white/80 transition-transform hover:scale-125 ${dotClass(p)}`} style={{ boxShadow: glowFor(p, f) }} />
                  </div>
                  <MarkerLabel position="bottom" className="num text-[10px] tracking-wide text-[var(--text-2)]">
                    {p.own ? "TERRA" : p.city.toUpperCase()}
                  </MarkerLabel>
                </MarkerContent>

                <MarkerPopup closeButton className="w-72 rounded-[14px] p-0! border-white/10! bg-[rgba(20,17,14,0.72)]! shadow-[0_10px_50px_rgba(0,0,0,.6)] backdrop-blur-xl">
                  <div className="relative h-28 overflow-hidden rounded-t-[14px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={HOTEL_IMG} alt={p.name} className="h-full w-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,17,14,0.95)] to-transparent" />
                    {f.level && (
                      <div className={`absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] backdrop-blur-md ${f.level === "alert" ? "bg-[rgba(194,77,77,.22)] text-[var(--negative)]" : "bg-[rgba(200,161,101,.20)] text-[var(--accent)]"}`}>
                        <AlertTriangle className="size-3" /> {f.level === "alert" ? "Inspect" : "Watch"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5 p-3">
                    <div>
                      <p className="num text-[var(--text-2)] pb-0.5 text-[11px] font-medium tracking-wide uppercase">
                        <span className="text-[var(--accent)]">{"*".repeat(p.stars)}</span>{"  "}{p.city}{p.distanceKm != null ? `  -  ${p.distanceKm} km` : ""}
                      </p>
                      <h3 className="text-[var(--text)] leading-tight font-semibold">{p.own ? "Hotel Terra Neptun" : p.name}</h3>
                    </div>

                    {f.reason && <p className={`text-[11px] ${f.level === "alert" ? "text-[var(--negative)]" : "text-[var(--accent)]"}`}>{f.reason}</p>}

                    {p.rate != null && (
                      <div className="grid grid-cols-3 gap-2">
                        {[["Rate", `${p.rate}`, "text-[var(--text)]"], ["Avail", `${p.avail}%`, "text-[var(--text)]"], ["vs Mkt", `${gap! >= 0 ? "+" : ""}${gap}`, gap! >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"]].map(([k, v, cls]) => (
                          <div key={k} className="rounded-md border border-white/5 bg-white/[.03] p-2">
                            <div className="text-[var(--text-2)] text-[9px] tracking-wide uppercase">{k}</div>
                            <div className={`num text-sm font-medium ${cls}`}>{v}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <div className="text-[var(--text-2)] mb-1 flex items-center justify-between text-[9px] tracking-wide uppercase">
                        <span>Corridor trend - 14d</span>
                        {gap != null && (gap >= 0 ? <TrendingUp className="size-3 text-[var(--positive)]" /> : <TrendingDown className="size-3 text-[var(--negative)]" />)}
                      </div>
                      <Sparkline refValue={p.rate} />
                      <div className="num text-[var(--text-3)] mt-1 flex items-center gap-1.5 text-[10px]">
                        <BedDouble className="size-3" />{p.minRate && p.maxRate ? `Range ${p.minRate}-${p.maxRate} RON` : "Range -"}
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-white/5 pt-2">
                      <div className="text-[var(--text-2)] text-[9px] tracking-wide uppercase">Intelligence sources</div>
                      {SOURCES.map(([label, action], si) => {
                        const Icon = SOURCE_ICON[si];
                        return (
                          <div key={label} className="flex items-center gap-2 rounded-md border border-dashed border-white/10 px-2 py-1">
                            <Icon className="size-3.5 text-[var(--text-3)]" />
                            <span className="text-[var(--text)] text-[11px]">{label}</span>
                            <span className="text-[var(--text-3)] ml-auto text-[10px]">{action}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}
        </Map>

        {/* OODA status strip (glass) */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-3 rounded-xl border border-white/10 bg-[rgba(20,17,14,0.6)] px-3.5 py-2 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,.4)]">
          <span className="num text-[10px] tracking-[.18em] text-[var(--accent)]">OBSERVE</span>
          <span className="h-3.5 w-px bg-white/10" />
          <span className="num text-[11px] text-[var(--text)]">{ALL_POINTS.length} properties</span>
          <span className="num flex items-center gap-1 text-[11px] text-[var(--accent)]">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-[var(--accent)]" />{flaggedCount} flagged
          </span>
        </div>

        {zoomed && (
          <button onClick={resetView} className="absolute left-4 bottom-4 z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-[rgba(20,17,14,0.6)] px-3 py-1.5 text-[12px] text-[var(--text)] backdrop-blur-xl transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">
            <Crosshair className="size-3.5" /> Corridor overview
          </button>
        )}
      </div>
    </div>
  );
}