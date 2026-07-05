// Daylight - ONE clock for the whole world. Every render layer (Mapbox light
// preset, the crafted three.js scene, the deck.gl massing) reads the same
// phase, so the world never disagrees with itself. Phases follow the real
// local hour; palettes are world pigment (scene assets), not UI chrome.

export type DayPhase = "dawn" | "day" | "dusk" | "night";

export function phaseForHour(h: number): DayPhase {
  if (h < 5) return "night";
  if (h < 8) return "dawn";
  if (h < 18) return "day";
  if (h < 21) return "dusk";
  return "night";
}
export function currentPhase(): DayPhase {
  // demo/QA override: localStorage aether.phase = dawn|day|dusk|night
  if (typeof window !== "undefined") {
    try {
      const o = window.localStorage.getItem("aether.phase");
      if (o === "dawn" || o === "day" || o === "dusk" || o === "night") return o;
    } catch { /* noop */ }
  }
  return phaseForHour(new Date().getHours());
}

export const MAPBOX_PRESET: Record<DayPhase, string> = {
  dawn: "dawn", day: "day", dusk: "dusk", night: "night",
};

export interface ScenePalette {
  body: string; bodyHero: string;
  windowWarm: string; windowCool: string;
  winIntensity: number;      // 0 = windows off (daylight)
  winLit: number;            // ratio of lit windows
  ambient: { color: number; intensity: number };
  key: { color: number; intensity: number; pos: [number, number, number] };
  fill: { color: number; intensity: number; pos: [number, number, number] };
  water: string; waterEmissive: number;
  canopy: string; trunk: string;
}

export const SCENE: Record<DayPhase, ScenePalette> = {
  day: {
    body: "#e6e0d3", bodyHero: "#f1ece1",
    windowWarm: "#ffffff", windowCool: "#dff3f9",
    winIntensity: 0, winLit: 0,
    ambient: { color: 0xdfe8f0, intensity: 1.2 },
    key: { color: 0xfff3dd, intensity: 2.1, pos: [320, -220, 720] },
    fill: { color: 0xcfe4ff, intensity: 0.5, pos: [-420, 320, 320] },
    water: "#2e93b8", waterEmissive: 0.05,
    canopy: "#4d7042", trunk: "#6d5843",
  },
  dawn: {
    body: "#c6bdb2", bodyHero: "#d6cec1",
    windowWarm: "#ffd9a0", windowCool: "#bfe9f5",
    winIntensity: 0.5, winLit: 0.16,
    ambient: { color: 0xb0a6c8, intensity: 0.72 },
    key: { color: 0xffc9a3, intensity: 1.45, pos: [640, -160, 210] },
    fill: { color: 0x8ea8d8, intensity: 0.36, pos: [-320, 220, 300] },
    water: "#22758f", waterEmissive: 0.12,
    canopy: "#3d5a38", trunk: "#5a4a3a",
  },
  dusk: {
    body: "#4c434a", bodyHero: "#5d5460",
    windowWarm: "#ffd9a0", windowCool: "#bfe9f5",
    winIntensity: 0.95, winLit: 0.3,
    ambient: { color: 0xc89a86, intensity: 0.66 },                      // sunset ambient
    key: { color: 0xff9e63, intensity: 1.9, pos: [-720, -140, 150] },   // low warm sun, west
    fill: { color: 0x7a8fc0, intensity: 0.42, pos: [420, 320, 320] },   // cool sky counter
    water: "#1b5b74", waterEmissive: 0.22,
    canopy: "#2f4630", trunk: "#4c4038",
  },
  night: {
    body: "#141821", bodyHero: "#1a2130",
    windowWarm: "#ffd9a0", windowCool: "#bfe9f5",
    winIntensity: 1.05, winLit: 0.34,
    ambient: { color: 0x8899bb, intensity: 0.55 },
    key: { color: 0xcfe4ff, intensity: 1.35, pos: [400, 300, 600] },
    fill: { color: 0xffe3b8, intensity: 0.28, pos: [-300, -200, 250] },
    water: "#0e3d4f", waterEmissive: 0.35,
    canopy: "#18251c", trunk: "#242028",
  },
};

export type Rgba = [number, number, number, number];
export const MASSING: Record<DayPhase, { body: Rgba; hotel: Rgba }> = {
  day:   { body: [230, 224, 211, 255], hotel: [241, 236, 225, 255] },  // cream in daylight
  dawn:  { body: [178, 170, 161, 246], hotel: [198, 190, 179, 250] },
  dusk:  { body: [86, 76, 83, 240],    hotel: [104, 94, 104, 245] },
  night: { body: [22, 27, 38, 235],    hotel: [30, 37, 52, 240] },
};