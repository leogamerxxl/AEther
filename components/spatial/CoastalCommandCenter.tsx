"use client";

/**
 * Aether — CoastalCommandCenter (Spatial Orchestrator)
 *
 * The Jarvis canvas. Mapbox GL v3 with:
 *   • Night-mode Standard style; the REAL building shapes are highlighted via the
 *     Standard buildings featureset (available=cyan, sold=slate) — no synthetic towers.
 *   • Ground halo layer = always-visible state color + the interaction surface.
 *   • Hover → rich preview card (name, state, rate, mini-map).
 *   • Click → fly to the asset + detailed dashboard grouped by domain.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "@/lib/command-theme";
import { ioFreshness, type IntelligenceObject } from "@/lib/intelligence-map";
import { AnimatePresence } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useIntelligence } from "./intelligence/SpatialIntelligenceProvider";
import { buildCoastalZones, buildZoneLabels, ZONE_IDS } from "@/lib/coastal-zones";
import { bandMeta, bandForZoom, type AltitudeBand } from "@/lib/altitude";
import { createResortLayer, RESORT_LAYER_ID, RESORT_MIN_ZOOM } from "@/lib/world/resort-scene";
import { createMarketOverlay, MARKET_MIN_ZOOM, MARKET_MAX_ZOOM, type MarketOverlayHandle, type FlowArc } from "@/lib/world/market-layer";
import { currentPhase, MAPBOX_PRESET, SKY } from "@/lib/world/daylight";
import { deriveIntel } from "@/lib/spatial-intel";
import type { PropertyIntelligenceNode } from "@/types/spatial";
import AssetDashboard from "./AssetDashboard";
import OperationsConsole from "./OperationsConsole";
import { toast } from "@/lib/toast";
import { buildPropertyGlowPoints, PACE_COLORS } from "@/lib/property-extrusions";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// ─── Constants ───────────────────────────────────────────────────────────────
const CENTER: [number, number] = [28.596282, 43.869390];

// ─── CoastalCommandCenter ────────────────────────────────────────────────────

export default function CoastalCommandCenter({ cinematic = false, start = false, locked = false, suppressPopups = false, onOverlayChange, onCamera, registerFlyTo, registerCamera, onFocus, onPickIo }: { cinematic?: boolean; start?: boolean; locked?: boolean; suppressPopups?: boolean; onOverlayChange?: (open: boolean) => void; onCamera?: (zoom: number) => void; registerFlyTo?: (fn: (band: AltitudeBand) => void) => void; registerCamera?: (ops: { zoomBy: (d: number) => void; home: () => void; toggle3D: () => void }) => void; onFocus?: (id: string | null) => void; onPickIo?: (io: IntelligenceObject) => void } = {}) {
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
  const HEAT_SRC = "aether-heat-src";
const HEAT_LAYER = "aether-heat";
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
      { name?: string | null; availability_state?: string | null; rate_ron?: number | null; rooms_remaining?: number | null }[];
    const STOP = new Set(["hotel", "resort", "and", "spa", "the"]);
    const words = (s: string) => new Set(s.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
    const out: { id: string; sold: boolean; rate: number | null; rooms: number | null }[] = [];
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
      if (best) out.push({ id: best.id, sold: cp.availability_state === "sold_out",
                           rate: cp.rate_ron ?? null, rooms: cp.rooms_remaining ?? null });
    }
    return out;
  }, [latestMarket, nodes]);
  const compById = useMemo(() => Object.fromEntries(liveStates.map(s => [s.id, s])), [liveStates]);

  const medianTonight = ((latestMarket?.raw_jsonb as Record<string, unknown> | undefined)?.median_adr_ron ?? null) as number | null;

  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  hoveredIdRef.current = hoveredId;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  // Popups never fight for space: when a higher surface opens (IO drawer, a
  // mode pane), the map-level popovers yield immediately.
  useEffect(() => {
    if (suppressPopups) { setExpanded(false); setHoveredId(null); setOpsOpen(false); }
  }, [suppressPopups]);
  useEffect(() => { onOverlayChangeRef.current?.(expanded || opsOpen); }, [expanded, opsOpen]);
  const [, setFrame] = useState(0);
  const mkRef = useRef<MarketOverlayHandle | null>(null);
  const onOverlayChangeRef = useRef(onOverlayChange);
  onOverlayChangeRef.current = onOverlayChange;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const mk = mkRef.current;
    const map = mapRef.current;
    if (!mk || !map || !ready) return;
    const arcs: FlowArc[] = [];
    const feats: GeoJSON.Feature[] = [];
    const home = nodes.find(n => n.isOwn)?.coordinates as [number, number] | undefined;
    for (const s of liveStates) {
      const n = nodes.find(n2 => n2.id === s.id);
      if (!n) continue;
      feats.push({ type: "Feature", geometry: { type: "Point", coordinates: n.coordinates as [number, number] },
                   properties: { weight: s.sold ? 1 : s.rooms != null && s.rooms <= 2 ? 0.6 : 0.28 } });
      if (s.sold && home) arcs.push({ from: n.coordinates as [number, number], to: home });
    }
    mk.setArcs(arcs);
    try { (map.getSource(HEAT_SRC) as mapboxgl.GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: feats }); } catch { /* noop */ }
  }, [ready, liveStates, nodes]);
  const [tokenMissing, setTokenMissing] = useState(false);

  // ── Camera flight + select ────────────────────────────────────────────────
  // Click = navigate the world: fly to property altitude and hand focus to the rail.
  // No windows spawn; the altitude system renders the focused entity.
  const select = (n: PropertyIntelligenceNode) => {
    if (lockedRef.current) return;
    setSelectedId(n.id);
    setExpanded(true);
    setOpsOpen(false);
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

    // v3 Standard style config: night preset + clean POI
    map.on("style.load", () => {
      // Real time of day: ONE clock (lib/world/daylight) lights every layer
      try { map.setConfigProperty("basemap", "lightPreset", MAPBOX_PRESET[currentPhase()]); } catch { /* noop */ }
      try { map.setConfigProperty("basemap", "showPointOfInterestLabels", false); } catch { /* noop */ }
      try { map.setConfigProperty("basemap", "showTransitLabels", false); }       catch { /* noop */ }
      // Real-building highlight colors (Standard featureset states)
      try { map.setConfigProperty("basemap", "colorBuildingHighlight", C.live); } catch { /* noop */ }
      try { map.setConfigProperty("basemap", "colorBuildingSelect", PACE_COLORS.balanced); } catch { /* noop */ }
      try {
        const sky = SKY[currentPhase()];
        map.setFog({ "color": sky.color, "high-color": sky.highColor, "space-color": sky.spaceColor,
                     "horizon-blend": sky.horizonBlend, "star-intensity": sky.starIntensity });
      } catch { /* noop */ }
    });

    map.on("load", () => {
      setReady(true);
      // Crafted resort scene (three.js custom layer) owns the close-up world;
      // basemap 3D massing yields to it past the threshold (no double buildings).
      try { if (!map.getLayer(RESORT_LAYER_ID)) map.addLayer(createResortLayer(currentPhase())); } catch { /* noop */ }
      // Wider market low-poly massing (deck.gl, interleaved) - context beyond the patch
      try {
        const mk = createMarketOverlay(currentPhase());
        mkRef.current = mk;
        map.addControl(mk.overlay);
        // native pressure heatmap (deck HeatmapLayer cannot coexist as a 2nd overlay)
        try {
          if (!map.getSource(HEAT_SRC)) map.addSource(HEAT_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          if (!map.getLayer(HEAT_LAYER)) {
            map.addLayer({
              id: HEAT_LAYER, type: "heatmap", source: HEAT_SRC, slot: "middle",
              maxzoom: 14.2,
              paint: {
                "heatmap-weight": ["get", "weight"],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8.5, 1.6, 13, 2.2],
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8.5, 34, 11, 56, 13.5, 96],
                "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7.6, 0, 8.6, 0.82, 13.2, 0.82, 14.2, 0],
                "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
                  0, "rgba(91,127,166,0)", 0.25, "rgba(91,127,166,0.5)", 0.5, "rgba(166,152,130,0.7)",
                  0.75, "rgba(206,167,110,0.85)", 1, "rgba(230,181,102,0.95)"],
              },
            });
          }
        } catch { /* noop */ }
        const gate = () => {
          const z = map.getZoom();
          mk.setVisible(z >= MARKET_MIN_ZOOM && z <= MARKET_MAX_ZOOM);
          mk.setFlowsVisible(z >= 8.6 && z < 14.2); // demand arcs, region through market
        };
        map.on("zoomend", gate);
        gate();
      } catch { /* noop */ }
      let resortActive = false;
      const swap3D = () => {
        const on = map.getZoom() >= RESORT_MIN_ZOOM;
        if (on === resortActive) return;
        resortActive = on;
        try { map.setConfigProperty("basemap", "show3dObjects", !on); } catch { /* noop */ }
      };
      map.on("zoomend", swap3D);
      swap3D();
      try { onCameraRef.current?.(map.getZoom()); } catch { /* noop */ }
      registerFlyToRef.current?.((band: AltitudeBand) => {
        try {
          const m = bandMeta(band);
          map.flyTo({
            zoom: m.zoomTarget, pitch: m.pitch, bearing: m.bearing,
            center: m.center ?? HOME?.coordinates ?? CENTER,
            duration: 2200, essential: true,
          });
        } catch { /* noop */ }
      });
      registerCameraRef.current?.({
        zoomBy: (d: number) => { try { map.easeTo({ zoom: map.getZoom() + d, duration: 400 }); } catch { /* noop */ } },
        toggle3D: () => { try { map.easeTo({ pitch: map.getPitch() > 25 ? 0 : 62, duration: 600 }); } catch { /* noop */ } },
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
        const z = map.getZoom();
        // Only reconcile React on move if something is glued to the map (a hover
        // card or the market-band action pin). At the property/twin band with no
        // hover there is nothing to follow, so we skip the whole-tree re-render.
        if (hoveredIdRef.current !== null || (z >= 10.5 && z < 14)) setFrame(f => (f + 1) % 1_000_000);
        try { onCameraRef.current?.(z); } catch { /* noop */ }
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

  // ── Region zones: the coastal market as extruded slabs (region altitude) ──
  // Heights from real IOs (live zone rises with tonight's compression); zones
  // without collectors stay low + neutral. Fades in leaving country, out
  // entering market - the region band's world treatment.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    type AddLayer = Parameters<typeof map.addLayer>[0];
    const SRC = "aether-zones-src", FILL = "aether-zones";
    const LBL_SRC = "aether-zone-labels-src", LBL = "aether-zone-labels";
    const zones = buildCoastalZones(objects);
    const labels = buildZoneLabels(objects);
    if (!map.getSource(SRC)) map.addSource(SRC, { type: "geojson", data: zones, promoteId: "id" });
    else (map.getSource(SRC) as mapboxgl.GeoJSONSource).setData(zones);
    if (!map.getSource(LBL_SRC)) map.addSource(LBL_SRC, { type: "geojson", data: labels });
    else (map.getSource(LBL_SRC) as mapboxgl.GeoJSONSource).setData(labels);
    if (!map.getLayer(FILL)) {
      try {
        map.addLayer({
          id: FILL, type: "fill-extrusion", source: SRC, slot: "middle",
          minzoom: 6, maxzoom: 12,
          paint: {
            // grows 0 -> 1 as the region band is entered (the reference rise)
            "fill-extrusion-height": ["*", ["get", "height"], ["coalesce", ["feature-state", "grow"], 0]],
            "fill-extrusion-base": 0,
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 6.4, 0, 7.2, 0.3, 10.6, 0.3, 11.8, 0],
            "fill-extrusion-emissive-strength": 0.85,
          },
        } as unknown as AddLayer);
      } catch { /* noop */ }
    }
    if (!map.getLayer(LBL)) {
      try {
        map.addLayer({
          id: LBL, type: "symbol", source: LBL_SRC, slot: "top",
          minzoom: 6.6, maxzoom: 11.4,
          layout: {
            "text-field": ["get", "name"],
            "text-size": 12.5,
            "text-letter-spacing": 0.04,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          },
          paint: {
            "text-color": "rgba(255,255,255,.68)",
            "text-halo-color": "rgba(5,6,8,.9)",
            "text-halo-width": 1.2,
            "text-opacity": ["interpolate", ["linear"], ["zoom"], 6.6, 0, 7.4, 1, 10.6, 1, 11.4, 0],
          },
        } as unknown as AddLayer);
      } catch { /* noop */ }
    }
    // Rise / settle animation on band boundaries (the reference appear-motion)
    const ease = (k: number) => 1 - Math.pow(1 - k, 3);
    let growRaf = 0;
    const growTo = (from: number, to: number) => {
      const t0 = performance.now(), D = 800;
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / D);
        const v = from + (to - from) * ease(k);
        for (const id of ZONE_IDS) {
          try { map.setFeatureState({ source: SRC, id }, { grow: v }); } catch { /* noop */ }
        }
        if (k < 1) growRaf = requestAnimationFrame(step);
      };
      cancelAnimationFrame(growRaf);
      growRaf = requestAnimationFrame(step);
    };
    let inRegion = false;
    const onZoomGrow = () => {
      const now = bandForZoom(map.getZoom()) === "region";
      if (now === inRegion) return;
      inRegion = now;
      growTo(now ? 0 : 1, now ? 1 : 0);
    };
    map.on("zoom", onZoomGrow);
    onZoomGrow();
    return () => { map.off("zoom", onZoomGrow); cancelAnimationFrame(growRaf); };
  }, [ready, objects]);
  // ── Ground halo layer: always-visible state color + THE interaction surface ──
  // The real building shapes are highlighted separately (featureset effect below);
  // no synthetic towers on top of the world.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    type AddLayer = Parameters<typeof map.addLayer>[0];

    const GLOW_SRC = "aether-glow-src";
    const GLOW = "aether-glow";
    let hoveredFeature: string | null = null;
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
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 6, 14, 22, 16, 44, 18, 78],
          "circle-blur": ["case", ["boolean", ["feature-state", "hover"], false], 0.75, 1],
          // zoom may only drive a TOP-LEVEL interpolate; feature-state cases live in the outputs
          "circle-opacity": [
            "interpolate", ["linear"], ["zoom"],
            11, ["case",
              ["boolean", ["feature-state", "hover"], false], 0.5,
              ["boolean", ["feature-state", "sold"], false], 0.14, 0.14],
            15, ["case",
              ["boolean", ["feature-state", "hover"], false], 0.5,
              ["boolean", ["feature-state", "sold"], false], 0.14, 0.3],
          ],
          "circle-emissive-strength": 1,
          "circle-pitch-alignment": "map",
        },
      } as unknown as AddLayer;
      try { map.addLayer(glowLayer); } catch { /* noop */ }
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
        if (hoveredFeature) map.setFeatureState({ source: GLOW_SRC, id: hoveredFeature }, { hover: false });
        hoveredFeature = id;
        map.setFeatureState({ source: GLOW_SRC, id }, { hover: true });
        setHoveredId(id);
      }
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      if (hoveredFeature) map.setFeatureState({ source: GLOW_SRC, id: hoveredFeature }, { hover: false });
      hoveredFeature = null;
      setHoveredId(null);
    };

    map.on("click", GLOW, onClick);
    map.on("mouseenter", GLOW, onEnter);
    map.on("mousemove", GLOW, onMove);
    map.on("mouseleave", GLOW, onLeave);

    return () => {
      map.off("click", GLOW, onClick);
      map.off("mouseenter", GLOW, onEnter);
      map.off("mousemove", GLOW, onMove);
      map.off("mouseleave", GLOW, onLeave);
      try { if (map.getLayer(GLOW)) map.removeLayer(GLOW); } catch { /* noop */ }
      try { if (map.getSource(GLOW_SRC)) map.removeSource(GLOW_SRC); } catch { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ── Halo live-state: tonight''s availability painted onto the ground halos ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || liveStates.length === 0) return;
    for (const s of liveStates) {
      try {
        map.setFeatureState({ source: "aether-glow-src", id: s.id }, { sold: s.sold, avail: !s.sold });
      } catch { /* layer may be mid-teardown */ }
    }
  }, [ready, liveStates]);

  // ── REAL building shapes: highlight via the Standard buildings featureset ──
  // At close zoom, find the actual building model nearest each asset and set its
  // featureset state (available/own -> highlight cyan, sold -> select slate).
  // Fully guarded: if the style/runtime lacks featuresets, this no-ops and the
  // halos alone carry the state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const paint = () => {
      try {
        if (map.getZoom() < 14.6) return;
        type FsFeature = { id?: string | number } & Record<string, unknown>;
        const q = (map as unknown as { queryRenderedFeatures: (o: unknown) => FsFeature[] })
          .queryRenderedFeatures({ target: { featuresetId: "buildings", importId: "basemap" } });
        if (!q || q.length === 0) return;
        const centroid = (f: FsFeature): [number, number] | null => {
          const g = (f as { geometry?: { type: string; coordinates: unknown } }).geometry;
          if (!g) return null;
          let ring: number[][] | null = null;
          if (g.type === "Polygon") ring = (g.coordinates as number[][][])[0];
          else if (g.type === "MultiPolygon") ring = (g.coordinates as number[][][][])[0]?.[0];
          if (!ring || ring.length === 0) return null;
          let x = 0, y = 0;
          for (const p of ring) { x += p[0]; y += p[1]; }
          return [x / ring.length, y / ring.length];
        };
        const states: { id: string; sold: boolean }[] = [
          ...liveStates,
          ...(HOME ? [{ id: HOME.id, sold: false }] : []),
        ];
        for (const s of states) {
          const node = nodesRef.current.find(n => n.id === s.id);
          if (!node) continue;
          let best: { f: FsFeature; d: number } | null = null;
          for (const f of q) {
            const cpt = centroid(f);
            if (!cpt) continue;
            const dx = (cpt[0] - node.coordinates[0]) * 111320 * Math.cos(node.coordinates[1] * Math.PI / 180);
            const dy = (cpt[1] - node.coordinates[1]) * 111320;
            const d = Math.hypot(dx, dy);
            if (d < 45 && (!best || d < best.d)) best = { f, d };
          }
          if (best) {
            (map as unknown as { setFeatureState: (f: unknown, s: unknown) => void })
              .setFeatureState(best.f, s.sold ? { select: true } : { highlight: true });
          }
        }
      } catch { /* featureset API unavailable -> halos carry the state */ }
    };
    paint();
    map.on("moveend", paint);
    return () => { map.off("moveend", paint); };
  }, [ready, liveStates, HOME]);

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
  const selected = selectedId ? nodes.find(n => n.id === selectedId) ?? null : null;
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

        {/* ── Rich hover card: name, state, rate, mini-map ────── */}
        <AnimatePresence>
          {!locked && !suppressPopups && hovered && hp && !expanded ? (
            <RichHover key={hovered.id} node={hovered}
              comp={compById[hovered.id] ?? null} median={medianTonight} x={hp.x} y={hp.y} />
          ) : null}
        </AnimatePresence>

        {/* ── Detailed asset dashboard: characteristics + actions, grouped by domain ── */}
        <AnimatePresence>
          {selected && expanded && !suppressPopups ? (
            <AssetDashboard key={"dash-" + selected.id} node={selected} live={null}
              onClose={() => setExpanded(false)}
              onAction={(label) => toast(label)}
              onOpenOps={() => setOpsOpen(true)} />
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {selected && opsOpen && !suppressPopups ? (
            <OperationsConsole key={"ops-" + selected.id} propertyName={selected.name}
              onClose={() => setOpsOpen(false)} />
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

// ── RichHover: the glance card - name, tonight''s state, rate vs median, mini-map ──
const ronFmt = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

function RichHover({ node, comp, median, x, y }: {
  node: PropertyIntelligenceNode;
  comp: { sold: boolean; rate: number | null; rooms: number | null } | null;
  median: number | null; x: number; y: number;
}) {
  const own = node.isOwn;
  const rate = own ? node.adrRon : comp?.rate ?? null;
  const delta = !own && rate != null && median != null ? Math.round(rate - median) : null;
  const mini = mapboxgl.accessToken
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${node.coordinates[0]},${node.coordinates[1]},14.5,0/196x84@2x?access_token=${mapboxgl.accessToken}&attribution=false&logo=false`
    : null;
  return (
    <div className="gx gx-matte pointer-events-none absolute z-30 w-[212px] -translate-x-1/2 rounded-[16px] p-2"
         style={{ left: x, top: y - 14, transform: "translate(-50%, -100%)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] font-medium text-white/90">{node.name}</span>
        <span className="shrink-0 rounded-full border border-white/[.12] px-1.5 py-px text-[8px] font-semibold uppercase tracking-[.08em]"
              style={{ color: own ? C.live : comp?.sold ? "rgba(255,255,255,0.4)" : C.live }}>
          {own ? "activ propriu" : comp?.sold ? "epuizat" : "disponibil"}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="num text-[18px] font-light leading-none text-white/95">
          {comp?.sold && !own ? "—" : rate != null ? ronFmt.format(rate) : "-"}
        </span>
        {(!comp?.sold || own) && rate != null ? <span className="text-[9px] text-white/35">RON</span> : null}
        {delta != null ? (
          <span className="num ml-auto text-[10px]" style={{ color: delta > 0 ? C.money : "rgba(255,255,255,0.5)" }}>
            {delta > 0 ? "+" : ""}{ronFmt.format(delta)} vs median
          </span>
        ) : comp?.rooms != null && !comp.sold ? (
          <span className="num ml-auto text-[10px] text-white/40">{comp.rooms} cam.</span>
        ) : null}
      </div>
      {mini ? (
        <img src={mini} alt="" width={196} height={84}
             className="mt-1.5 w-full rounded-[10px] border border-white/[.07] object-cover" />
      ) : null}
      <div className="mt-1 text-[8.5px] uppercase tracking-[.1em] text-white/30">click pentru detalii pe domenii</div>
    </div>
  );
}