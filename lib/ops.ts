// Verticalized hotel operations + per-zone operational intelligence.
// Each zone carries a god's-eye "situation" read, AI recommendations that
// cross-reference weather / stock / wait-time, who is on shift, live stats,
// and role-scoped tools. Mock data — awaiting PMS / POS / HORECA / weather /
// camera feeds + WorkOS role auth (then RLS enforces the lanes server-side).

export type Role = "owner" | "manager" | "chef" | "bartender" | "reception" | "waiter";
export type ZoneId = "rooms" | "spa" | "restaurant" | "kitchen" | "bar" | "lobby" | "terrace" | "pool" | "kids";
export type Severity = "info" | "warn" | "critical";

export const ROLES: { id: Role; label: string; scope: string; full: boolean }[] = [
  { id: "owner", label: "Owner", scope: "Full property", full: true },
  { id: "manager", label: "Manager", scope: "Operations & staff", full: true },
  { id: "chef", label: "Chef", scope: "Kitchen & supply", full: false },
  { id: "bartender", label: "Bartender", scope: "Bar stock", full: false },
  { id: "reception", label: "Reception", scope: "Front desk & cameras", full: false },
  { id: "waiter", label: "Service", scope: "Tables & orders", full: false },
];

export const ZONES: { id: ZoneId; label: string; level: number }[] = [
  { id: "rooms", label: "Guest Rooms", level: 3 },
  { id: "spa", label: "Spa & Wellness", level: 2 },
  { id: "restaurant", label: "Restaurant", level: 1 },
  { id: "kitchen", label: "Kitchen", level: 1 },
  { id: "bar", label: "Bar", level: 1 },
  { id: "lobby", label: "Lobby", level: 0 },
  { id: "terrace", label: "Terrace", level: 0 },
  { id: "pool", label: "Pool Deck", level: 0 },
  { id: "kids", label: "Kids Club", level: 0 },
];

export const ROLE_ZONES: Record<Role, ZoneId[] | "all"> = {
  owner: "all",
  manager: "all",
  chef: ["kitchen", "restaurant"],
  bartender: ["bar"],
  reception: ["lobby", "rooms"],
  waiter: ["terrace", "restaurant", "bar"],
};

export function zonesForRole(role: Role): ZoneId[] {
  const z = ROLE_ZONES[role];
  return z === "all" ? ZONES.map((x) => x.id) : z;
}

export interface ZoneStat { label: string; value: string; accent?: string }
export interface Recommendation { id: string; severity: Severity; title: string; detail: string }
export interface ShiftMember { name: string; role: string }
export interface ZoneState {
  occupancy: number;
  staffOnShift: number;
  situation: string;
  stats: ZoneStat[];
  recommendations: Recommendation[];
  shift: ShiftMember[];
  modules: string[];
}

export const AMBER = "#e6b566", GREEN = "#5fd0a0", RED = "#ef8b7a";
export const SEV_COLOR: Record<Severity, string> = { info: GREEN, warn: AMBER, critical: RED };
export const zoneLabel = (id: ZoneId) => ZONES.find((z) => z.id === id)?.label ?? id;

export const ZONE_STATE: Record<ZoneId, ZoneState> = {
  terrace: {
    occupancy: 92, staffOnShift: 4,
    situation: "Peak service — 14 of 18 tables seated, 3 parties waiting. Drinks at 6 min, food wait climbing to 18.",
    stats: [
      { label: "Tables seated", value: "14" }, { label: "Free", value: "1", accent: AMBER }, { label: "Waiting", value: "3", accent: AMBER },
      { label: "Drink wait", value: "6 min", accent: GREEN }, { label: "Food wait", value: "18 min", accent: AMBER }, { label: "Open orders", value: "11" },
    ],
    recommendations: [
      { id: "t1", severity: "warn", title: "Food wait climbing to 18 min", detail: "Pull one runner from the restaurant and pre-fire bread service for the 3 waiting parties to hold satisfaction." },
      { id: "t2", severity: "info", title: "Steer the upsell to dorada", detail: "Sea bass is 86d in the kitchen; dorada carries higher margin and strong stock." },
    ],
    shift: [{ name: "Ana", role: "Server" }, { name: "Mihai", role: "Server" }, { name: "Elena", role: "Runner" }, { name: "Radu", role: "Host" }],
    modules: ["Tables (drink to food wait)", "AI order translation", "HORECA sync"],
  },
  bar: {
    occupancy: 0, staffOnShift: 1,
    situation: "One bartender on, ~7 pours/min against ~11/min of demand. Blue curacao just hit zero.",
    stats: [
      { label: "Throughput", value: "7 / min", accent: AMBER }, { label: "Demand", value: "11 / min" }, { label: "Drink wait", value: "9 min", accent: AMBER }, { label: "Low / out", value: "3", accent: RED },
    ],
    recommendations: [
      { id: "b1", severity: "critical", title: "Blue curacao out — 2 cocktails unservable", detail: "Green Apple and Blue Lagoon cannot be made; 3 were ordered in the last hour. Mark them unavailable and expedite a restock." },
      { id: "b2", severity: "warn", title: "Send a bar runner", detail: "Demand outpaces pours by ~4/min; a second pair of hands clears the 9-min queue before it hits the terrace." },
      { id: "b3", severity: "warn", title: "Below par: tonic, lime, elderflower syrup", detail: "Short for tonights 120 covers — reorder from distributor before 18:00." },
    ],
    shift: [{ name: "Cosmin", role: "Bartender" }],
    modules: ["Beverage stock", "Low-stock flags", "Pour analytics"],
  },
  pool: {
    occupancy: 68, staffOnShift: 2,
    situation: "54 guests on deck, 12 loungers free. Weather model flags rain in ~90 min (68%).",
    stats: [
      { label: "Guests on deck", value: "54" }, { label: "Loungers free", value: "12" }, { label: "Lifeguard", value: "on duty", accent: GREEN }, { label: "UV index", value: "high", accent: AMBER },
    ],
    recommendations: [
      { id: "p1", severity: "warn", title: "Rain likely in ~90 min (68%)", detail: "Pull 40 loungers and towel stock indoors before 16:30 to avoid soak damage and a scramble." },
      { id: "p2", severity: "info", title: "Save the afternoon F&B spend", detail: "Move the crowd inside with the 17:00 wine tasting and live acoustic set — keeps guests on-property and spending through the washout." },
    ],
    shift: [{ name: "Vlad", role: "Lifeguard" }, { name: "Ioana", role: "Attendant" }],
    modules: ["Guest count", "Weather cross-ref", "Loungers & towels"],
  },
  kitchen: {
    occupancy: 0, staffOnShift: 6,
    situation: "Seafood delivery 90 min late; sea bass off the menu. 180 covers forecast tonight.",
    stats: [
      { label: "Deliveries", value: "7 / 8" }, { label: "Late / flagged", value: "1", accent: RED }, { label: "Off menu", value: "Sea bass", accent: AMBER }, { label: "Top consumed", value: "Grilled dorada" }, { label: "Covers forecast", value: "180", accent: GREEN },
    ],
    recommendations: [
      { id: "k1", severity: "critical", title: "Seafood delivery 90 min late — menu at risk", detail: "Sea bass off. Push the dorada special (strong stock, higher margin) across the 180 covers and notify service." },
      { id: "k2", severity: "warn", title: "Reorder olive oil and butter", detail: "Below par for tomorrow brunch — flag the distributor now to avoid a second shortage." },
    ],
    shift: [{ name: "Andrei", role: "Head chef" }, { name: "+5", role: "Line" }],
    modules: ["Supply tracker", "Delivery flags", "Off-menu board", "Consumption vs occupancy"],
  },
  lobby: {
    occupancy: 40, staffOnShift: 3,
    situation: "32 arrivals today, smooth front desk. One camera down on the east corridor.",
    stats: [
      { label: "Cameras online", value: "7 / 8", accent: AMBER }, { label: "Arrivals today", value: "32" }, { label: "Booking pace", value: "+9%", accent: GREEN }, { label: "Social reach 7d", value: "18.4k" },
    ],
    recommendations: [
      { id: "l1", severity: "warn", title: "Camera 4 (east corridor) offline", detail: "Blind spot on the room corridor — log a maintenance ticket and watch adjacent feeds until restored." },
    ],
    shift: [{ name: "Diana", role: "Front desk" }, { name: "Paul", role: "Concierge" }, { name: "Sorina", role: "Front desk" }],
    modules: ["Cameras", "Check-in / out", "Booking pace", "Social impact"],
  },
  rooms: {
    occupancy: 76, staffOnShift: 8,
    situation: "76% occupied. 32 arrivals / 19 departures today, 14 rooms still to turn.",
    stats: [
      { label: "Occupancy", value: "76%" }, { label: "Arrivals / dep.", value: "32 / 19" }, { label: "To clean", value: "14", accent: AMBER }, { label: "Out of order", value: "1", accent: RED },
    ],
    recommendations: [
      { id: "r1", severity: "warn", title: "14 rooms to turn before 15:00 check-in", detail: "Pace is behind by ~2 rooms; pull one housekeeper from the late shift to clear arrivals on time." },
    ],
    shift: [{ name: "Housekeeping", role: "6 on floor" }, { name: "Maria", role: "Supervisor" }],
    modules: ["Floor & corridor map", "Arrivals / departures", "Housekeeping"],
  },
  spa: {
    occupancy: 55, staffOnShift: 3,
    situation: "11 treatments booked, 55% therapist utilisation. Capacity to upsell a rainy afternoon.",
    stats: [{ label: "Treatments", value: "11" }, { label: "Utilisation", value: "55%" }, { label: "Next slot", value: "15:30", accent: GREEN }],
    recommendations: [{ id: "s1", severity: "info", title: "Open slots this afternoon", detail: "Push a same-day spa offer to in-house guests if the pool closes for rain — converts a washout into treatment revenue." }],
    shift: [{ name: "Carmen", role: "Therapist" }, { name: "Andra", role: "Therapist" }, { name: "Luca", role: "Reception" }],
    modules: ["Bookings", "Therapist load", "Stock"],
  },
  restaurant: {
    occupancy: 74, staffOnShift: 5,
    situation: "62 covers seated, average turn 84 min, two no-shows on the book.",
    stats: [{ label: "Covers", value: "62" }, { label: "Avg turn", value: "84 min" }, { label: "No-shows", value: "2", accent: AMBER }],
    recommendations: [{ id: "re1", severity: "info", title: "Release the 2 no-show tables", detail: "Re-open them to the 3 parties waiting on the terrace to lift covers and cut their wait." }],
    shift: [{ name: "George", role: "Maitre d" }, { name: "+4", role: "Service" }],
    modules: ["Covers", "Table turns", "Menu board"],
  },
  kids: {
    occupancy: 30, staffOnShift: 2,
    situation: "9 children in, 1:5 staff ratio, next activity at 16:00.",
    stats: [{ label: "Children", value: "9" }, { label: "Staff ratio", value: "1:5", accent: GREEN }, { label: "Next activity", value: "16:00" }],
    recommendations: [{ id: "ki1", severity: "info", title: "Bad-weather plan ready", detail: "If the pool closes, the indoor crafts session at 16:00 absorbs pool families — pre-stock materials now." }],
    shift: [{ name: "Bianca", role: "Animator" }, { name: "Tudor", role: "Animator" }],
    modules: ["Check-in", "Staff ratio", "Activity schedule"],
  },
};

export interface OpsFlag { id: string; zone: ZoneId; byRole: Role; notifyRole: Role; severity: Severity; message: string; ago: string }
export const FLAGS: OpsFlag[] = [
  { id: "f5", zone: "terrace", byRole: "waiter", notifyRole: "manager", severity: "info", message: "Terrace at capacity — 14 seated, 3 waiting", ago: "2m" },
  { id: "f1", zone: "bar", byRole: "bartender", notifyRole: "manager", severity: "critical", message: "Blue curacao out — Green Apple and Blue Lagoon unservable", ago: "4m" },
  { id: "f2", zone: "kitchen", byRole: "chef", notifyRole: "manager", severity: "critical", message: "Seafood delivery 90 min late — menu at risk", ago: "18m" },
  { id: "f3", zone: "kitchen", byRole: "chef", notifyRole: "waiter", severity: "info", message: "Sea bass off the menu today — remove from upsell", ago: "24m" },
  { id: "f4", zone: "lobby", byRole: "reception", notifyRole: "manager", severity: "warn", message: "Camera 4 (east corridor) offline", ago: "32m" },
];

export function flagsForRole(role: Role): OpsFlag[] {
  if (role === "owner" || role === "manager") return FLAGS;
  return FLAGS.filter((f) => f.notifyRole === role || f.byRole === role);
}
