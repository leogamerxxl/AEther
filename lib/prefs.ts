// Aether user preferences - real, persisted settings backing the Settings panel.
// Stored in localStorage so they survive reloads (same store model as demo auth).
// When a real backend lands, swap load/save for a Supabase `user_preferences` row.

export type Currency = "RON" | "EUR";
export type Cadence = "hourly" | "6h" | "daily";

export interface Prefs {
  // Notifications
  notifyMorningBrief: boolean;
  notifyPriceAlerts: boolean;
  notifyCompetitorMoves: boolean;
  notifyWeeklyDigest: boolean;
  // Display
  currency: Currency;
  reduceMotion: boolean;
  // Data
  briefTime: string; // "HH:MM" local delivery target
  refreshCadence: Cadence;
}

export const DEFAULT_PREFS: Prefs = {
  notifyMorningBrief: true,
  notifyPriceAlerts: true,
  notifyCompetitorMoves: false,
  notifyWeeklyDigest: true,
  currency: "RON",
  reduceMotion: false,
  briefTime: "07:00",
  refreshCadence: "6h",
};

const KEY = "aether.prefs";

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}

/** Live effect: reduce-motion toggles a documentElement attribute that CSS reads. */
export function applyReduceMotion(on: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-reduce-motion", on ? "true" : "false");
}
