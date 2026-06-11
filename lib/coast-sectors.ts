// Coastal resort sectors for the sector-monitor view (Romanian Black Sea coast,
// north -> south). Each sector is a glowing region on a tilted map, color-coded
// by demand level. Deterministic blob paths give organic region shapes.

export type SectorLevel = "high" | "medium" | "calm";

export interface CoastSector {
  id: string;
  name: string;
  level: SectorLevel;
  occupancy: number;
  adr: number;
  demandIndex: number;
  cx: number; // viewBox 0..1000
  cy: number; // viewBox 0..620
  r: number;
  seed: number;
}

export const SECTOR_COLORS: Record<SectorLevel, { color: string; soft: string; label: string }> = {
  high: { color: "#ef6a55", soft: "rgba(239,106,85,0.20)", label: "High demand" },
  medium: { color: "#e6b566", soft: "rgba(230,181,102,0.16)", label: "Steady" },
  calm: { color: "#22d3ee", soft: "rgba(34,211,238,0.16)", label: "Soft" },
};

export const COAST_SECTORS: CoastSector[] = [
  { id: "mamaia", name: "Mamaia", level: "high", occupancy: 88, adr: 606, demandIndex: 84, cx: 648, cy: 98, r: 118, seed: 11 },
  { id: "eforie", name: "Eforie", level: "medium", occupancy: 74, adr: 608, demandIndex: 61, cx: 560, cy: 224, r: 98, seed: 23 },
  { id: "costinesti", name: "Costinesti", level: "high", occupancy: 82, adr: 430, demandIndex: 78, cx: 512, cy: 336, r: 92, seed: 37 },
  { id: "olimp", name: "Olimp", level: "calm", occupancy: 60, adr: 540, demandIndex: 42, cx: 470, cy: 436, r: 88, seed: 5 },
  { id: "neptun", name: "Neptun", level: "medium", occupancy: 76, adr: 575, demandIndex: 66, cx: 442, cy: 524, r: 104, seed: 19 },
];

/** Smooth, deterministic organic blob path (y squashed for a ground-plane feel). */
export function blobPath(cx: number, cy: number, r: number, seed: number, points = 10): string {
  let s = seed * 2654435761;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 1000) / 1000; };
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (0.74 + rand() * 0.5);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8]);
  }
  const mid = (p: [number, number], q: [number, number]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as [number, number];
  let d = `M ${mid(pts[points - 1], pts[0])[0].toFixed(1)} ${mid(pts[points - 1], pts[0])[1].toFixed(1)}`;
  for (let i = 0; i < points; i++) {
    const cur = pts[i], next = pts[(i + 1) % points];
    const m = mid(cur, next);
    d += ` Q ${cur[0].toFixed(1)} ${cur[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return d + " Z";
}
