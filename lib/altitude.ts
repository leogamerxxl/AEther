// The Altitude Engine - the world model's vertical axis. One continuous camera;
// discrete information bands. Content density changes with altitude, never screens.
// Pure and framework-free: the map reports zoom, everything else derives from it.

export type AltitudeBand = "globe" | "country" | "region" | "market" | "property" | "twin";

export interface BandMeta {
  id: AltitudeBand;
  label: string;        // RO, owner-facing
  trail: string;        // breadcrumb up to and including this band
  zoomTarget: number;   // where the ladder flies you
  center: [number, number] | null; // null = keep the home anchor (the property)
  pitch: number;
  bearing: number;
}

export const BANDS: BandMeta[] = [
  { id: "globe",    label: "Glob",     trail: "Lume",                              zoomTarget: 2.4,  center: null,             pitch: 0,  bearing: 0 },
  { id: "country",  label: "Tara",     trail: "Lume - Romania",                    zoomTarget: 5.6,  center: [25.3, 45.8],     pitch: 0,  bearing: 0 },
  { id: "region",   label: "Regiune",  trail: "Romania - Litoral",                 zoomTarget: 9.35, center: [28.615, 43.96],  pitch: 52, bearing: -12 },
  { id: "market",   label: "Piata",    trail: "Litoral - Neptun-Olimp",            zoomTarget: 12.6, center: [28.606, 43.873], pitch: 55, bearing: -20 },
  { id: "property", label: "Hotel",    trail: "Neptun-Olimp - Hotel Terra Neptun", zoomTarget: 15.6, center: null,             pitch: 62, bearing: -20 },
  { id: "twin",     label: "Interior", trail: "Hotel Terra - interior (twin)",     zoomTarget: 17.4, center: null,             pitch: 55, bearing: -35 },
];

export function bandForZoom(zoom: number): AltitudeBand {
  if (zoom < 4) return "globe";
  if (zoom < 7) return "country";
  if (zoom < 10.5) return "region";
  if (zoom < 14) return "market";
  if (zoom < 16.5) return "property";
  return "twin";
}

export function bandMeta(band: AltitudeBand): BandMeta {
  return BANDS.find((b) => b.id === band) ?? BANDS[3];
}