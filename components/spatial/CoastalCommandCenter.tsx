"use client";

/**
 * Aether — CoastalCommandCenter (Spatial Orchestrator)
 *
 * The Jarvis canvas. Mapbox GL v3 with:
 *   • Night-mode dark preset ("lightPreset": "night")
 *   • 3D building extrusions with volumetric shadows
 *   • Velocity-coded 3D property extrusions (color = pace, height = ADR):
 *       Own property   → electric cyan  #06b6d4  (double-ring pulsing)
 *       Demand tight   → emerald        #10b981
 *       Demand soft    → warning amber  #f59e0b
 *       Balanced       → slate blue     #5b7fa6
 *   • Click → flyTo(pitch 62, bearing -20) + open AssetIntelligenceSheet
 *   • Hover → HoverChip preview (anchored above marker)
 *   • Supabase Realtime subscription for live telemetry updates
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useIntelligence } from "./intelligence/SpatialIntelligenceProvider";
import { deriveIntel } from "@/lib/spatial-intel";
import type { PropertyIntelligenceNode } from "@/types/spatial";
import { HoverChip, PinPopup } from "./MapCards";
import { buildPropertyExtrusions, buildPropertyGlowPoints } from "@/lib/property-extrusions";
import AssetDashboard from "./AssetDashboard";
// import AssetTwin from "./AssetTwin"; // 3D twin set aside for now (perf)
import OperationsConsole from "./OperationsConsole";
import { toast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// ─── Constants ───────────────────────────────────────────────────────────────
const CENTER: [number, number] = [28.596282, 43.869390];

// ─── CoastalCommandCenter ────────────────────────────────────────────────────

export default function CoastalCommandCenter({ cinematic = false, start = false, locked = false }: { cinematic?: boolean; start?: boolean; locked?: boolean } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markersRef   = useRef<mapboxgl.Marker[]>([]);
  const rafRef       = useRef<number>(0);
  const bootedRef    = useRef(false);
  const lockedRef    = useRef(locked);
  lockedRef.current  = locked;

  // Single read layer: nodes (sample scaffold overlaid with live IO insight) come
  // from the one provider - never a direct NODES import. A ref keeps map event
  // handlers (bound once) resolving against the latest live nodes.
  const { nodes, source } = useIntelligence();
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const HOME = useMemo(() => nodes.find(n => n.name === "Hotel Terra Neptun") ?? nodes[0], [nodes]);

  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  // const [twinOpen, setTwinOpen] = useState(false); // 3D twin disabled
  const [opsOpen, setOpsOpen] = useState(false);
  const [, setFrame] = useState(0);
  const [ready, setReady] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);
  const [live, setLive] = useState<Record<string, { narrative: string; delta: number; alert: string }>>({});

  // ── Camera flight + select ────────────────────────────────────────────────
  const select = (n: PropertyIntelligenceNode) => {
    if (lockedRef.current) return;
    setSelectedId(n.id);
    setExpanded(false);
    // (3D twin disabled)
    setOpsOpen(false);
    mapRef.current?.flyTo({
      center:   n.coordinates,
      zoom:     16.2,
      pitch:    62,
      bearing:  -20,
      duration: 2200,
      essential: true,
    });
  };

  // ── Mapbox initialization ─────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    if (!mapboxgl.accessToken) { setTokenMissing(true); return; }
    // (3D twin disabled - map keeps the single WebGL context)

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     "mapbox://styles/mapbox/standard",
      projection: cinematic ? "globe" : "mercator",
      center:    cinematic ? (HOME?.coordinates ?? CENTER) : CENTER,
      zoom:      cinematic ? 2.4 : 14.2,
      pitch:     cinematic ? 0 : 56,
      bearing:   cinematic ? 0 : -18,
      antialias: true,
      attributionControl: false,
      maxPitch:  75,
    });
    mapRef.current = map;

    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "bottom-right"
    );

    // v3 Standard style config: night preset + clean POI
    map.on("style.load", () => {
      try { map.setConfigProperty("basemap", "lightPreset", "night"); }           catch { /* noop */ }
      try { map.setConfigProperty("basemap", "showPointOfInterestLabels", false); } catch { /* noop */ }
      try { map.setConfigProperty("basemap", "showTransitLabels", false); }       catch { /* noop */ }
      try { map.setFog({ "color": "#0a0a0c", "high-color": "#000000", "space-color": "#000000", "horizon-blend": 0.02, "star-intensity": 0.12 }); } catch { /* noop */ }
    });

    map.on("load", () => setReady(true));

    // RAF-throttled re-render for marker projections
    const bump = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setFrame(f => (f + 1) % 1_000_000);
      });
    };
    map.on("move", bump);
    // map.on("render", bump); // perf: follow markers on "move" only

    const rs = setTimeout(() => { try { map.resize(); } catch { /* noop */ } }, 300);

    return () => {
      clearTimeout(rs);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Property extrusions (color-coded 3D towers) ───────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const SRC = "aether-properties";
    const LAYER = "aether-extrusions";
    const data = buildPropertyExtrusions();
    let hoveredFeature: string | null = null;
    type AddLayer = Parameters<typeof map.addLayer>[0];

    // Soft luminescent ground-glow pool under each asset.
    const GLOW_SRC = "aether-glow-src";
    const GLOW = "aether-glow";
    const glow = buildPropertyGlowPoints();
    if (!map.getSource(GLOW_SRC)) {
      map.addSource(GLOW_SRC, { type: "geojson", data: glow });
    } else {
      (map.getSource(GLOW_SRC) as mapboxgl.GeoJSONSource).setData(glow);
    }
    if (!map.getLayer(GLOW)) {
      const glowLayer = {
        id: GLOW, type: "circle", source: GLOW_SRC, slot: "middle",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 5, 14, 22, 16, 48, 18, 90],
          "circle-blur": 1,
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.10, 15, 0.26],
          "circle-emissive-strength": 1,
          "circle-pitch-alignment": "map",
        },
      } as unknown as AddLayer;
      try { map.addLayer(glowLayer); } catch { /* noop */ }
    }

    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: "geojson", data });
    } else {
      (map.getSource(SRC) as mapboxgl.GeoJSONSource).setData(data);
    }
    if (!map.getLayer(LAYER)) {
      const layer = {
        id: LAYER,
        type: "fill-extrusion",
        source: SRC,
        slot: "middle",
        paint: {
          "fill-extrusion-color": ["get", "lit"],
          "fill-extrusion-height": [
            "+",
            ["get", "height"],
            ["case", ["boolean", ["feature-state", "hover"], false], 18, 0],
          ],
          "fill-extrusion-base": 0,
          "fill-extrusion-vertical-gradient": true,
          "fill-extrusion-opacity": 0.55,
          "fill-extrusion-emissive-strength": [
            "case", ["boolean", ["feature-state", "hover"], false], 1, 0.85,
          ],
        },
      } as unknown as AddLayer;
      try { map.addLayer(layer); } catch { /* noop */ }
    }

    const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      const node = id ? nodesRef.current.find(n => n.id === id) : null;
      if (node) { e.originalEvent.stopPropagation(); select(node); }
    };
    const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onMove = (e: mapboxgl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const id = f?.id != null ? String(f.id) : null;
      if (id && id !== hoveredFeature) {
        if (hoveredFeature) map.setFeatureState({ source: SRC, id: hoveredFeature }, { hover: false });
        hoveredFeature = id;
        map.setFeatureState({ source: SRC, id }, { hover: true });
        setHoveredId(id);
      }
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      if (hoveredFeature) map.setFeatureState({ source: SRC, id: hoveredFeature }, { hover: false });
      hoveredFeature = null;
      setHoveredId(null);
    };

    map.on("click", LAYER, onClick);
    map.on("mouseenter", LAYER, onEnter);
    map.on("mousemove", LAYER, onMove);
    map.on("mouseleave", LAYER, onLeave);

    return () => {
      map.off("click", LAYER, onClick);
      map.off("mouseenter", LAYER, onEnter);
      map.off("mousemove", LAYER, onMove);
      map.off("mouseleave", LAYER, onLeave);
      try { if (map.getLayer(LAYER)) map.removeLayer(LAYER); } catch { /* noop */ }
      try { if (map.getLayer(GLOW)) map.removeLayer(GLOW); } catch { /* noop */ }
      try { if (map.getSource(SRC)) map.removeSource(SRC); } catch { /* noop */ }
      try { if (map.getSource(GLOW_SRC)) map.removeSource(GLOW_SRC); } catch { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── Initial flyTo to Hotel Terra on boot ─────────────────────────────────
  useEffect(() => {
    if (!ready || bootedRef.current || !HOME) return;
    if (cinematic && !start) return; // wait for the splash to reveal the globe
    bootedRef.current = true;
    const t = setTimeout(
      () => mapRef.current?.flyTo({
        center:   HOME.coordinates,
        zoom:     16.2,
        pitch:    62,
        bearing:  -20,
        duration: cinematic ? 5400 : 2600,
        curve:    1.5,
        essential: true,
      }),
      400
    );
    return () => clearTimeout(t);
  }, [ready, start]);

  // ── Supabase Realtime — live telemetry ────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    supabase
      .from("property_live_telemetry")
      .select("property_ref,narrative,recommended_delta_ron,maritime_alert")
      .then(({ data }) => {
        if (!mounted || !data) return;
        setLive(Object.fromEntries(
          (data as { property_ref: string; narrative: string; recommended_delta_ron: number; maritime_alert: string }[])
            .map(d => [d.property_ref, { narrative: d.narrative, delta: d.recommended_delta_ron, alert: d.maritime_alert }])
        ));
      });

    const chan = supabase
      .channel("ooda-telemetry")
      .on("postgres_changes", { event: "*", schema: "public", table: "property_live_telemetry" }, payload => {
        const r = payload.new as { property_ref?: string; narrative?: string; recommended_delta_ron?: number; maritime_alert?: string };
        if (r?.property_ref) {
          setLive(prev => ({
            ...prev,
            [r.property_ref as string]: {
              narrative: r.narrative ?? "",
              delta:     r.recommended_delta_ron ?? 0,
              alert:     r.maritime_alert ?? "clear",
            },
          }));
        }
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(chan); };
  }, []);

  // ── Derived render state ──────────────────────────────────────────────────
  const map      = mapRef.current;
  const project  = (n: PropertyIntelligenceNode) => map && ready ? map.project(n.coordinates) : null;
  const hovered  = hoveredId  ? nodes.find(n => n.id === hoveredId)  ?? null : null;
  const selected = selectedId ? nodes.find(n => n.id === selectedId) ?? null : null;
  const hp       = hovered && hovered.id !== selectedId ? project(hovered) : null;
  const sp       = selected && !expanded ? project(selected) : null;
  const oodaMode = selected ? (live[selected.id] ? "LIVE" : "ORIENT") : "OBSERVE";
  const nodeCount = nodes.length;

  // ── Action handler ────────────────────────────────────────────────────────
  const onAction = (label: string) => {
    toast(label);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-[#08090b] p-3">
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/[.08]">

        {/* Map canvas */}
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />

        {/* ── Token-missing fallback ─────────────────────────── */}
        {tokenMissing && (
          <div className="absolute inset-0 grid place-items-center bg-[#08090b] text-center text-[13px] text-slate-400">
            Add{" "}
            <span className="font-mono text-[#06b6d4]">NEXT_PUBLIC_MAPBOX_TOKEN</span>{" "}
            to <span className="font-mono text-slate-300">.env.local</span> and restart.
          </div>
        )}

        {/* ── Top status bar ──────────────────────────────────── */}
        <div className={`hidden ${expanded ? "hidden" : ""}`}>
          {/* OODA mode indicator */}
          <span className="font-mono text-[10px] tracking-[.20em]" style={{ color: "#06b6d4" }}>
            {oodaMode}
          </span>
          <span className="h-3 w-px bg-white/10" />

          {/* Live pulse if connected */}
          {oodaMode === "LIVE" && (
            <>
              <span className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: "#06b6d4" }}>
                <span className="size-1.5 animate-pulse rounded-full" style={{ background: "#06b6d4" }} />
                LIVE
              </span>
              <span className="h-3 w-px bg-white/10" />
            </>
          )}

          <span className="font-mono text-[11px] text-slate-200">{nodeCount} nodes</span>
          <span className="h-3 w-px bg-white/10" />
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
            Neptun–Olimp
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="font-mono text-[10px] text-slate-500">
            {CENTER[1].toFixed(4)}°N {CENTER[0].toFixed(4)}°E
          </span>
        </div>

        {/* ── Node legend ─────────────────────────────────────── */}
        <div className={`gx gx-raised absolute right-4 top-4 z-20 flex flex-col gap-2 rounded-2xl px-3.5 py-3 ${expanded ? "hidden" : ""}`}>
          {[
            { color: "#06b6d4", label: "Own asset" },
            { color: "#10b981", label: "Demand tight" },
            { color: "#5b7fa6", label: "Balanced" },
            { color: "#f59e0b", label: "Demand soft" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
              <span className="font-mono text-[10px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Hover chip ──────────────────────────────────────── */}
        <AnimatePresence>
          {!locked && hovered && hp ? (
            <HoverChip key={hovered.id} node={hovered} x={hp.x} y={hp.y} />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>{selected && opsOpen ? <OperationsConsole key={"ops-" + selected.id} propertyName={selected.name} onClose={() => setOpsOpen(false)} /> : null}</AnimatePresence>
        {/* <AssetTwin> set aside for now (perf) */}

        {/* ── AssetIntelligenceSheet (progressive disclosure) ── */}
        <AnimatePresence>
          {selected && sp && !expanded ? (
            <PinPopup key={selected.id} node={selected} x={sp.x} y={sp.y} live={selected ? live[selected.id] ?? null : null} onExpand={() => setExpanded(true)} onClose={() => setSelectedId(null)} />
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {selected && expanded ? (
            <AssetDashboard key={"dash-" + selected.id} node={selected} live={selected ? live[selected.id] ?? null : null} onClose={() => setExpanded(false)} onAction={onAction} onOpenOps={() => setOpsOpen(true)} />
          ) : null}
        </AnimatePresence>

        {/* ── Bottom system bar ───────────────────────────────── */}
        <div
          className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 flex items-center gap-3 rounded-full px-4 py-1.5"
          style={{
            backdropFilter: "blur(12px)",
            background:     "rgba(8, 9, 11, 0.7)",
            border:         "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span className="font-mono text-[9px] uppercase tracking-[.18em] text-slate-600">
            Aether · Project Palantir-H
          </span>
          <span className="h-2 w-px bg-white/[.08]" />
          <span className="font-mono text-[9px] text-slate-600">
            Neptun–Olimp Corridor
          </span>
          <span className="h-2 w-px bg-white/[.08]" />
          <span className="font-mono text-[9px] text-slate-600">
            {source === "live" ? "Live market intelligence" : "Real ADR · Sample telemetry"}
          </span>
        </div>

      </div>
    </div>
  );
}
