// Deterministic weekly forecast for an asset (occupancy + ADR), Mon..Sun.
// Hospitality horizons are weekly/seasonal, not hourly - this replaces the
// 6AM-11PM scrubber from the transit reference.

export interface DayPoint {
  day: string;
  occ: number; // occupancy %
  adr: number; // RON
  today: boolean;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weeklyForecast(seed: string, baseOcc: number, baseAdr: number): DayPoint[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const dow = new Date().getDay();
  const todayIdx = dow === 0 ? 6 : dow - 1; // Mon=0

  return DAYS.map((day, i) => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const rnd = (h % 1000) / 1000;
    const weekendLift = i >= 4 ? 12 : 0; // Fri-Sun
    const occ = Math.max(38, Math.min(99, Math.round(baseOcc - 6 + weekendLift + (rnd - 0.5) * 16)));
    const adr = Math.round(baseAdr * (0.9 + (occ / 100) * 0.26));
    return { day, occ, adr, today: i === todayIdx };
  });
}

export function avgOcc(f: DayPoint[]): number {
  return Math.round(f.reduce((s, d) => s + d.occ, 0) / f.length);
}
