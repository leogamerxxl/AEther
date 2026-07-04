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
import { C } from "@/lib/command-theme";
import { ioFreshness, type IntelligenceObject } from "@/lib/intelligence-map";
import { AnimatePresence } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useIntelligence } from "./intelligence/SpatialIntelligenceProvider";
import { deriveIntel } from "@/lib/spatial-intel";
import type { PropertyIntelligenceNode } from "@/types/spatial";
import { HoverChip } from "./MapCards";
import { buildPropertyExtrusions, buildPropertyGlowPoints, PACE_COLORS, lightenHex } from "@/lib/property-extrusions";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// ─── Constants ───────────────────────────────────────────────────────────────
const CENTER: [number, number] = [28.596282, 43.869390];

// ─── CoastalCommandCenter ────────────────────────────────────────────────────

export default function CoastalCommandCenter({ cinematic = false, start = false, locked = false, onCamera, registerFlyTo, registerCamera, onFocus, onPickIo }: { cinematic?: boolean; start?: boolean; locked?: boolean; onCamera?: (zoom: number) => void; registerFlyTo?: (fn: (zoom: number) => void) => void; registerCamera?: (ops: { zoomBy: (d: number) => void; home: () => void }) => void; onFocus?: (id: string | null) => void; onPickIo?: (io: IntelligenceObject) => void } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markersRef   = useRef<mapboxgl.Marker[]>([]);
  const rafRef       = useRef<number>(0);
  const bootedRef    = useRef(false);
  const lockedRef    = useRef(locked);
  lockedRef.current  = locked;
  const onCameraRef = useRef(onCamera);
  onCameraRef.current = onCamera;
  const registerFlyToRef = useRef(registerFlyTo);
  registerFlyToRef.current = registerFlyTo;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const registerCameraRef = useRef(registerCamera);
  registerCameraRef.current = registerCamera;

  // Single read layer: nodes (sample scaffold overlaid with live IO insight) come
  // from the one provider - never a direct NODES import. A ref keeps map event
  // handlers (bound once) resolving against the latest live nodes.
  const { nodes, source, objects, decisions } = useIntelligence();
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const HOME = useMemo(() => nodes.find(n => n.name === "Hotel Terra Neptun") ?? nodes[0], [nodes]);

  // The world layer reads the REAL market IO: tonight's per-comp availability is
  // painted onto the buildings (feature-state), and the actionable nights become
  // a scene-anchored harbor pin. No new fetch - the one provider feeds the map.
  const marketIos = useMemo(() => objects
    .filter(io => io.signal_type === "market_rate_pressure" && ioFreshness(io) !== "dead")
    .sort((a, b) => String(a.raw_jsonb?.stay_date).localeCompare(String(b.raw_jsonb?.stay_date))), [objects]);
  const latestMarket = marketIos[0];
  const actionable = useMemo(() => marketIos
    .filter(io => (io.recommended_actions ?? []).length > 0 && !decisions[io.id]), [marketIos, decisions]);
  const liveStates = useMemo(() => {
    const comps = ((latestMarket?.raw_jsonb as Record<string, unknown> | undefined)?.comps ?? []) as
      { name?: string | null; availability_state?: string | null }[];
    const STOP = new Set(["hotel", "resort", "and", "spa", "the"]);
    const words = (s: string) => new Set(s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
    const out: { id: string; sold: boolean }[] = [];
    for (const cp of comps) {
      if (!cp.name) continue;
      const cw = words(cp.name);
      let best: { id: string; score: number } | null = null;
      for (const n of nodes) {
        if (n.isOwn) continue;
        const nw = words(n.name ?? "");
        let score = 0;
        cw.forEach(w => { if (nw.has(w)) score++; });
        if (score > 0 && (!best || score > best.score)) best = { id: n.id, score };
      }
      if (best) out.push({ id: best.id, sold: cp.availability_state === "sold_out" });
    }
    return out;
  }, [latestMarket, nodes]);

  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setFrame] = useState(0);
  const [ready, setReady] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  // ── Camera flight + select ────────────────────────────────────────────────
  // Click = navigate the world: fly to property altitude and hand focus to the rail.
  // No windows spawn; the altitude system renders the focused entity.
  const select = (n: PropertyIntelligenceNode) => {
    if (lockedRef.current) return;
    setSelectedId(n.id);
    onFocusRef.current?.(n.id);
    mapRef.current?.flyTo({
      center:   n.coordinates,
      zoom:     15.6,
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

    map.on("load", () => {
      setReady(true);
      try { onCameraRef.current?.(map.getZoom()); } catch { /* noop */ }
      registerFlyToRef.current?.((zoom: number) => {
        try { map.flyTo({ zoom, duration: 1600, essential: true }); } catch { /* noop */ }
      });
      registerCameraRef.current?.({
        zoomBy: (d: number) => { try { map.easeTo({ zoom: map.getZoom() + d, duration: 400 }); } catch { /* noop */ } },
        home: () => {
          try {
            map.flyTo({ center: HOME?.coordinates ?? CENTER, zoom: 15.6, pitch: 62, bearing: -20, duration: 2000, essential: true });
          } catch { /* noop */ }
        },
      });
    });

    // RAF-throttled re-render for marker projections
    const bump = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setFrame(f => (f + 1) % 1_000_000);
        try { onCameraRef.current?.(map.getZoom()); } catch { /* noop */ }
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
          "circle-color": [
            "case",
            ["boolean", ["feature-state", "sold"], false], PACE_COLORS.balanced,
            ["boolean", ["feature-state", "avail"], false], C.live,
            ["get", "color"],
          ],
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
          "fill-extrusion-color": [
            "case",
            ["boolean", ["feature-state", "sold"], false], PACE_COLORS.balanced,
            ["boolean", ["feature-state", "avail"], false], lightenHex(C.live, 0.4),
            ["get", "lit"],
          ],
          "fill-extrusion-height": [
            "+",
            ["get", "height"],
            ["case", ["boolean", ["feature-state", "hover"], false], 18, 0],
          ],
          "fill-extrusion-base": 0,
          "fill-extrusion-vertical-gradient": true,
          "fill-extrusion-opacity": 0.55,
          "fill-extrusion-emissive-strength": [
            "case",
            ["boolean", ["feature-state", "hover"], false], 1,
            ["boolean", ["feature-state", "sold"], false], 0.28,
            ["boolean", ["feature-state", "avail"], false], 1,
            0.85,
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

  // ── World layer live-state: paint tonight's availability onto the buildings ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || liveStates.length === 0) return;
    for (const s of liveStates) {
      try {
        map.setFeatureState({ source: "aether-properties", id: s.id }, { sold: s.sold, avail: !s.sold });
      } catch { /* layer may be mid-teardown */ }
    }
  }, [ready, liveStates]);

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


  // ── Derived render state ──────────────────────────────────────────────────
  const map      = mapRef.current;
  const project  = (n: PropertyIntelligenceNode) => map && ready ? map.project(n.coordinates) : null;
  const hovered  = hoveredId  ? nodes.find(n => n.id === hoveredId)  ?? null : null;
  const hp       = hovered && hovered.id !== selectedId ? project(hovered) : null;
  const zoomNow  = map && ready ? map.getZoom() : 0;
  const marketCentroid = useMemo<[number, number] | null>(() => {
    const comps = nodes.filter(n => !n.isOwn);
    if (comps.length === 0) return null;
    return [
      comps.reduce((s, n) => s + n.coordinates[0], 0) / comps.length,
      comps.reduce((s, n) => s + n.coordinates[1], 0) / comps.length,
    ];
  }, [nodes]);
  const topRec = actionable[0] ?? null;
  const pinP = topRec && marketCentroid && zoomNow >= 10.5 && zoomNow < 14 && map && ready
    ? map.project(marketCentroid) : null;

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

        {/* ── Hover chip ──────────────────────────────────────── */}
        <AnimatePresence>
          {!locked && hovered && hp ? (
            <HoverChip key={hovered.id} node={hovered} x={hp.x} y={hp.y} />
          ) : null}
        </AnimatePresence>

        {/* Scene-anchored action pin: the actionable nights, ON the world (harbor) */}
        {!locked && pinP && topRec ? (
          <button
            onClick={() => onPickIo?.(topRec)}
            className="absolute z-20 -translate-x-1/2 -translate-y-full cursor-pointer"
            style={{ left: pinP.x, top: pinP.y }}
            aria-label="Deschide actiunea de piata"
          >
            <span className="gx gx-matte flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: C.money }} />
                <span className="relative inline-flex size-2.5 rounded-full" style={{ background: C.money }} />
              </span>
              <span className="text-[10.5px] font-medium text-white/90">
                {actionable.length} {actionable.length === 1 ? "noapte actionabila" : "nopti actionabile"}
              </span>
            </span>
            <span className="mx-auto block h-3 w-px" style={{ background: C.money, opacity: 0.7 }} />
          </button>
        ) : null}

        {/* <AssetTwin> set aside for now (perf) */}



      </div>
    </div>
  );
}
