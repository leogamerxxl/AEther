"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Point } from "@/lib/corridor";

type RGB = [number, number, number];
const AMBER: RGB = [200, 161, 101];
const BLUE: RGB = [120, 150, 185];
const RED: RGB = [196, 77, 77];
const RING: [number, number, number, number] = [245, 242, 238, 210];

const STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const LABELS = [
  { name: "MAMAIA", lng: 28.627, lat: 44.255 },
  { name: "EFORIE NORD", lng: 28.64, lat: 44.082 },
  { name: "OLIMP", lng: 28.621, lat: 43.818 },
  { name: "NEPTUN", lng: 28.61, lat: 43.782 },
];

const colorOf = (d: Point): RGB =>
  d.alert ? RED : d.own ? AMBER : BLUE;

export default function CorridorMap({
  points,
  selectedId,
  onSelect,
}: {
  points: Point[];
  selectedId: string | null;
  onSelect: (p: Point | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [28.655, 44.03],
        zoom: 8.7,
        pitch: 38,
        bearing: -12,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
    } catch (e) {
      setErr("init: " + (e instanceof Error ? e.message : String(e)));
      return;
    }
    mapRef.current = map;
    map.on("error", (ev: { error?: Error }) =>
      console.warn("[CorridorMap] basemap:", ev?.error?.message ?? ev)
    );

    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    overlayRef.current = overlay;
    map.addControl(overlay);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    const t = setTimeout(() => map.resize(), 300);

    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, [points.length]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const pick = (info: { object?: Point }) => {
      onSelectRef.current(info.object ?? null);
      return true;
    };

    // soft halo
    const halo = new ScatterplotLayer<Point>({
      id: "halo",
      data: points,
      radiusUnits: "pixels",
      getPosition: (d) => [d.lng, d.lat],
      getRadius: (d) => (d.own ? 22 : d.id === selectedId ? 20 : 14),
      getFillColor: (d) => {
        const c = colorOf(d);
        return [c[0], c[1], c[2], d.id === selectedId ? 70 : 38];
      },
      updateTriggers: { getFillColor: [selectedId], getRadius: [selectedId] },
      pickable: false,
    });

    // solid pin core + ring
    const core = new ScatterplotLayer<Point>({
      id: "pins",
      data: points,
      radiusUnits: "pixels",
      stroked: true,
      filled: true,
      lineWidthUnits: "pixels",
      getPosition: (d) => [d.lng, d.lat],
      getRadius: (d) => (d.own ? 8 : d.id === selectedId ? 8 : 5.5),
      getFillColor: (d) => {
        const c = colorOf(d);
        return [c[0], c[1], c[2], 255];
      },
      getLineColor: (d) => (d.id === selectedId ? [255, 255, 255, 255] : RING),
      getLineWidth: (d) => (d.id === selectedId ? 2.5 : 1.5),
      pickable: true,
      onClick: pick,
      updateTriggers: {
        getRadius: [selectedId],
        getLineColor: [selectedId],
        getLineWidth: [selectedId],
      },
    });

    const labels = new TextLayer<(typeof LABELS)[number]>({
      id: "labels",
      data: LABELS,
      getPosition: (d) => [d.lng, d.lat],
      getText: (d) => d.name,
      getSize: 11,
      getColor: [138, 131, 120, 230],
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      fontFamily: "monospace",
      characterSet: "auto",
      billboard: true,
    });

    overlay.setProps({
      layers: [halo, core, labels],
      getTooltip: ({ object }: { object?: Point }) =>
        object
          ? {
              className: "deck-tooltip",
              html: `${object.name} Â· ${
                object.rate ? object.rate + " RON" : "no data"
              }`,
            }
          : null,
    });
  }, [points, selectedId]);

  return (
    <>
      <div
        ref={containerRef}
        className="corridor-canvas"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {err && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            maxWidth: 460,
            padding: "14px 16px",
            background: "var(--sheet)",
            border: "1px solid var(--negative)",
            borderRadius: 12,
            color: "var(--text)",
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: 12,
            zIndex: 5,
          }}
        >
          map error â€” {err}
        </div>
      )}
    </>
  );
}
