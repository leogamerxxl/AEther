// Aether Focus + Altitude navigation layer (Doctrine, Article 1).
//
// Pure logic: state types, the 15-cell (focus x altitude) matrix, URL codec,
// and transition functions. No React, no Mapbox, no Supabase - Phase 2 wires
// this to the router and panel orchestrator. Spec: docs/AETHER_FOCUS_ALTITUDE.md
// (which supersedes COMMAND_CENTER s1's altitude definition - see docs/DECISIONS.md).

// == State ====================================================================

export type FocusKind = "place" | "market" | "corridor" | "asset" | "segment";
export type Altitude = "operational" | "strategic" | "executive";

export interface Focus {
  kind: FocusKind;
  id: string;
}

/** Stay-date window (inclusive), the timeline scrubber state. */
export interface ViewWindow {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

/** The ENTIRE navigation state. URL-serializable, restorable, nothing hidden. */
export interface CommandView {
  focus: Focus;
  altitude: Altitude;
  window?: ViewWindow;
  scenario?: string; // scenario id; absent = baseline reality (Graph V4)
}

export const FOCUS_KINDS: readonly FocusKind[] = ["place", "market", "corridor", "asset", "segment"];
export const ALTITUDES: readonly Altitude[] = ["operational", "strategic", "executive"];

// Hotel Terra Neptun - the pilot's own asset (CLAUDE.md hardcoded UUID).
export const OWN_ASSET_ID = "9c382e4f-fcad-4590-83ff-1fcce5a2223c";

/** Landing cell: the pilot owner's morning seat. */
export const DEFAULT_VIEW: CommandView = {
  focus: { kind: "asset", id: OWN_ASSET_ID },
  altitude: "operational",
};

// == Altitude semantics =======================================================

export interface AltitudeMeta {
  label: string;
  horizonDays: number;          // forecast/data horizon
  cadence: "daily" | "weekly" | "monthly";
  density: "dense" | "focus" | "ambient";
  alertBudget: number;          // visible at rest
  alertMode: "full" | "digest" | "thresholds";
  recMode: "act" | "plan" | "counts";
  forecastGrain: "stay-date" | "curve" | "aggregate";
}

export const ALTITUDE_META: Record<Altitude, AltitudeMeta> = {
  operational: { label: "Operational", horizonDays: 14, cadence: "daily",   density: "focus",   alertBudget: 3, alertMode: "full",       recMode: "act",    forecastGrain: "stay-date" },
  strategic:   { label: "Strategic",   horizonDays: 90, cadence: "weekly",  density: "focus",   alertBudget: 2, alertMode: "digest",     recMode: "plan",   forecastGrain: "curve" },
  executive:   { label: "Executive",   horizonDays: 365, cadence: "monthly", density: "ambient", alertBudget: 1, alertMode: "thresholds", recMode: "counts", forecastGrain: "aggregate" },
};

// == Panel registry ===========================================================
// Shared vocabulary with docs/AETHER_FOCUS_ALTITUDE.md s2. Each id maps to an
// ontology query + provenance envelope in the Article-7 query layer (Phase 2+).

export type PanelId =
  | "today_pulse" | "weather_horizon" | "sellout_cascade" | "dp_curve" | "event_window"
  | "corridor_inflow" | "narrative_weather" | "mh_composite" | "season_pace" | "sibling_benchmark"
  | "leakage_waterfall" | "rate_ladder" | "market_velocity" | "cp_web" | "mix_composition"
  | "supply_pipeline" | "ro_aggregate" | "share_trajectory" | "corridor_flow_live" | "segment_pace"
  | "disruption_feed" | "corridor_capacity" | "booking_window_dist" | "price_sensitivity"
  | "corridor_concentration" | "corridor_ltv" | "corridor_growth" | "today_digest" | "pickup_pace"
  | "dp_readout" | "cp_readout" | "ro_readout" | "rec_queue" | "otb_vs_forecast" | "forecast_curves"
  | "ro_decomposition" | "segment_mix" | "positioning_panel" | "season_pnl" | "calibration_scorecard"
  | "segment_pace_window" | "conversion_proxies" | "channel_activity" | "segment_profile"
  | "segment_yield_compare" | "resonance_row" | "segment_growth" | "mix_value" | "diversification"
  | "bets_tracking";

export const PANEL_LABELS: Record<PanelId, string> = {
  today_pulse: "Today's pulse", weather_horizon: "Weather horizon", sellout_cascade: "Sellout cascade",
  dp_curve: "Demand pressure", event_window: "Event windows", corridor_inflow: "Corridor inflow",
  narrative_weather: "Narrative weather", mh_composite: "Market health", season_pace: "Season pace vs LY",
  sibling_benchmark: "Sibling benchmark", leakage_waterfall: "Demand leakage", rate_ladder: "Rate ladder",
  market_velocity: "Booking velocity", cp_web: "Competitive pressure", mix_composition: "Demand mix",
  supply_pipeline: "Supply pipeline", ro_aggregate: "Revenue opportunity", share_trajectory: "Share trajectory",
  corridor_flow_live: "Live corridor flow", segment_pace: "Segment pace", disruption_feed: "Disruptions",
  corridor_capacity: "Capacity vs demand", booking_window_dist: "Booking windows",
  price_sensitivity: "Price sensitivity", corridor_concentration: "Corridor concentration",
  corridor_ltv: "Corridor LTV", corridor_growth: "Corridor growth", today_digest: "Morning digest",
  pickup_pace: "Pickup vs pace", dp_readout: "Demand pressure", cp_readout: "Competitive pressure",
  ro_readout: "Revenue opportunity", rec_queue: "Recommendations", otb_vs_forecast: "OTB vs forecast",
  forecast_curves: "Forecast curves", ro_decomposition: "Opportunity breakdown", segment_mix: "Segment mix",
  positioning_panel: "Positioning", season_pnl: "Season trajectory", calibration_scorecard: "Calibration",
  segment_pace_window: "In-window pace", conversion_proxies: "Conversion", channel_activity: "Channel activity",
  segment_profile: "Segment profile", segment_yield_compare: "Yield comparison", resonance_row: "Narrative resonance",
  segment_growth: "Segment growth", mix_value: "Mix value", diversification: "Diversification",
  bets_tracking: "Strategic bets",
};

// == Cell specs ===============================================================

export interface CameraSpec {
  /** Semantic framing token - visuals translate this, never raw zoom levels. */
  framing: "tight" | "context" | "network" | "origin" | "arc" | "region" | "portfolio";
  emphasis: string; // what the map foregrounds in this cell
}

export interface AlertPolicy {
  mode: AltitudeMeta["alertMode"];
  budget: number;
  triggers: readonly string[]; // scoped to the focus subgraph
}

export interface RecPolicy {
  /** "act" cells are the only Article-5 surfaces; "none" = observed/foreign scope. */
  mode: "act" | "plan" | "counts" | "none";
  note: string;
}

export interface ForecastPolicy {
  grain: AltitudeMeta["forecastGrain"];
  horizonDays: number;
  intervals: boolean;
  compare?: "ly" | "scenario";
}

export interface CellSpec {
  camera: CameraSpec;
  visible: readonly PanelId[];
  /** Reachable in one gesture, never rendered at rest (computed: pool minus visible). */
  hidden: readonly PanelId[];
  alerts: AlertPolicy;
  recommendations: RecPolicy;
  forecasts: ForecastPolicy;
}

type CellInput = Omit<CellSpec, "hidden">;

// Per-focus panel pools: everything this focus kind can show across altitudes.
const POOL: Record<FocusKind, readonly PanelId[]> = {
  place: ["today_pulse", "weather_horizon", "sellout_cascade", "dp_curve", "event_window", "corridor_inflow", "narrative_weather", "mh_composite", "season_pace", "sibling_benchmark", "leakage_waterfall"],
  market: ["rate_ladder", "market_velocity", "sellout_cascade", "cp_web", "dp_curve", "mix_composition", "leakage_waterfall", "supply_pipeline", "mh_composite", "ro_aggregate", "share_trajectory"],
  corridor: ["corridor_flow_live", "segment_pace", "disruption_feed", "corridor_capacity", "booking_window_dist", "price_sensitivity", "narrative_weather", "corridor_concentration", "corridor_ltv", "corridor_growth"],
  asset: ["today_digest", "pickup_pace", "dp_readout", "cp_readout", "ro_readout", "rec_queue", "otb_vs_forecast", "forecast_curves", "ro_decomposition", "segment_mix", "positioning_panel", "event_window", "season_pnl", "calibration_scorecard", "ro_aggregate", "mh_composite"],
  segment: ["segment_pace_window", "conversion_proxies", "channel_activity", "segment_profile", "segment_yield_compare", "resonance_row", "segment_growth", "mix_value", "diversification", "bets_tracking"],
};

function cell(kind: FocusKind, input: CellInput): CellSpec {
  const hidden = POOL[kind].filter((p) => !input.visible.includes(p));
  return { ...input, hidden };
}

export const MATRIX: Record<FocusKind, Record<Altitude, CellSpec>> = {
  place: {
    operational: cell("place", {
      camera: { framing: "tight", emphasis: "asset extrusions, occupancy emissive, today's weather, event pulses" },
      visible: ["today_pulse", "sellout_cascade", "weather_horizon"],
      alerts: { mode: "full", budget: 3, triggers: ["weather/maritime", "event-day", "place-wide sellout cascade"] },
      recommendations: { mode: "counts", note: "none place-native; count chip of own-asset recs within place" },
      forecasts: { grain: "stay-date", horizonDays: 7, intervals: true },
    }),
    strategic: cell("place", {
      camera: { framing: "context", emphasis: "feeding corridors, DP tint 30-90d, event windows" },
      visible: ["dp_curve", "event_window", "corridor_inflow", "narrative_weather"],
      alerts: { mode: "digest", budget: 2, triggers: ["narrative lifecycle changes", "event announcements", "corridor capacity changes"] },
      recommendations: { mode: "plan", note: "season-prep positioning, batched" },
      forecasts: { grain: "curve", horizonDays: 90, intervals: true },
    }),
    executive: cell("place", {
      camera: { framing: "region", emphasis: "place among siblings, MH chips, outward leakage arcs" },
      visible: ["mh_composite", "season_pace", "sibling_benchmark", "leakage_waterfall"],
      alerts: { mode: "thresholds", budget: 1, triggers: ["MH threshold crossings"] },
      recommendations: { mode: "counts", note: "allocation-grade placeholder (post-pilot)" },
      forecasts: { grain: "aggregate", horizonDays: 365, intervals: true, compare: "ly" },
    }),
  },
  market: {
    operational: cell("market", {
      camera: { framing: "tight", emphasis: "comp-set extrusions (height=ADR, emissive=availability), own asset harbor-lit" },
      visible: ["rate_ladder", "market_velocity", "sellout_cascade", "cp_web"],
      alerts: { mode: "full", budget: 3, triggers: ["rival price moves > threshold", "sellout events", "velocity spikes"] },
      recommendations: { mode: "act", note: "market-triggered pricing recs targeting own asset" },
      forecasts: { grain: "stay-date", horizonDays: 14, intervals: true },
    }),
    strategic: cell("market", {
      camera: { framing: "context", emphasis: "market vs neighbors, substitution edges" },
      visible: ["dp_curve", "mix_composition", "leakage_waterfall", "supply_pipeline"],
      alerts: { mode: "digest", budget: 2, triggers: ["leakage trend breaks", "narrative FRAMES changes", "comp-set composition changes"] },
      recommendations: { mode: "plan", note: "channel/positioning, seasonal min-stay policy" },
      forecasts: { grain: "curve", horizonDays: 90, intervals: true },
    }),
    executive: cell("market", {
      camera: { framing: "network", emphasis: "market as node in coastal flows, leakage arcs to external sinks" },
      visible: ["mh_composite", "ro_aggregate", "share_trajectory"],
      alerts: { mode: "thresholds", budget: 1, triggers: ["MH crossings", "structural shifts (new route)"] },
      recommendations: { mode: "counts", note: "enter/exit/reweight (post-pilot)" },
      forecasts: { grain: "aggregate", horizonDays: 365, intervals: true, compare: "ly" },
    }),
  },
  corridor: {
    operational: cell("corridor", {
      camera: { framing: "arc", emphasis: "animated particle flow, origin pulse, chokepoint sensors" },
      visible: ["corridor_flow_live", "segment_pace", "disruption_feed"],
      alerts: { mode: "full", budget: 3, triggers: ["disruption events", "pace break vs expected"] },
      recommendations: { mode: "act", note: "origin-targeted offer timing (campaign)" },
      forecasts: { grain: "stay-date", horizonDays: 14, intervals: true },
    }),
    strategic: cell("corridor", {
      camera: { framing: "context", emphasis: "competing corridors into same market, capacity ceilings" },
      visible: ["corridor_capacity", "booking_window_dist", "price_sensitivity", "narrative_weather"],
      alerts: { mode: "digest", budget: 2, triggers: ["scheduled capacity changes", "origin narrative shifts", "sustained pace divergence"] },
      recommendations: { mode: "plan", note: "channel/market development, corridor-segment rate fences" },
      forecasts: { grain: "curve", horizonDays: 90, intervals: true },
    }),
    executive: cell("corridor", {
      camera: { framing: "network", emphasis: "all corridors ranked, concentration (Herfindahl) visual" },
      visible: ["corridor_concentration", "corridor_ltv", "corridor_growth"],
      alerts: { mode: "thresholds", budget: 1, triggers: ["concentration threshold breach", "structural origin shifts (FX/macro)"] },
      recommendations: { mode: "counts", note: "diversification priorities" },
      forecasts: { grain: "aggregate", horizonDays: 365, intervals: true },
    }),
  },
  asset: {
    operational: cell("asset", {
      camera: { framing: "tight", emphasis: "asset luminescent, comp set dimmed-visible" },
      visible: ["today_digest", "pickup_pace", "dp_readout", "cp_readout", "ro_readout", "rec_queue", "otb_vs_forecast"],
      alerts: { mode: "full", budget: 3, triggers: ["rate moves", "sellouts", "pace breaks", "weather windows", "rec deadlines"] },
      recommendations: { mode: "act", note: "full lifecycle, deadline-sorted - the Article 5 home surface" },
      forecasts: { grain: "stay-date", horizonDays: 14, intervals: true },
    }),
    strategic: cell("asset", {
      camera: { framing: "context", emphasis: "asset within market, capture/fair-share visual" },
      visible: ["forecast_curves", "ro_decomposition", "segment_mix", "positioning_panel", "event_window"],
      alerts: { mode: "digest", budget: 2, triggers: ["positioning narratives", "event announcements in window", "calibration drift"] },
      recommendations: { mode: "plan", note: "product/packaging/channel + season posture, batched weekly" },
      forecasts: { grain: "curve", horizonDays: 90, intervals: true, compare: "ly" },
    }),
    executive: cell("asset", {
      camera: { framing: "portfolio", emphasis: "asset as node in portfolio (pilot: single asset + market context)" },
      visible: ["season_pnl", "calibration_scorecard", "ro_aggregate", "mh_composite"],
      alerts: { mode: "thresholds", budget: 1, triggers: ["calibration breaches", "season-pace thresholds"] },
      recommendations: { mode: "counts", note: "investment-grade hints (post-pilot)" },
      forecasts: { grain: "aggregate", horizonDays: 365, intervals: true, compare: "ly" },
    }),
  },
  segment: {
    operational: cell("segment", {
      camera: { framing: "origin", emphasis: "origin-geography heat + carrying corridors (no asset zoom)" },
      visible: ["segment_pace_window", "conversion_proxies", "channel_activity"],
      alerts: { mode: "full", budget: 3, triggers: ["in-window pace breaks", "resonant narrative spikes"] },
      recommendations: { mode: "act", note: "segment-targeted campaign/offer, rate fences" },
      forecasts: { grain: "stay-date", horizonDays: 30, intervals: true },
    }),
    strategic: cell("segment", {
      camera: { framing: "origin", emphasis: "origin regions + narrative resonance overlay" },
      visible: ["segment_profile", "segment_yield_compare", "resonance_row", "segment_growth"],
      alerts: { mode: "digest", budget: 2, triggers: ["origin structural changes (FX/macro)", "narrative lifecycle affecting segment"] },
      recommendations: { mode: "plan", note: "packaging/product-market fit, channel investment" },
      forecasts: { grain: "curve", horizonDays: 90, intervals: true },
    }),
    executive: cell("segment", {
      camera: { framing: "portfolio", emphasis: "all segments as weighted flows into the portfolio" },
      visible: ["mix_value", "diversification", "bets_tracking"],
      alerts: { mode: "thresholds", budget: 1, triggers: ["mix concentration", "LTV trend breaks"] },
      recommendations: { mode: "counts", note: "segment portfolio allocation" },
      forecasts: { grain: "aggregate", horizonDays: 365, intervals: true },
    }),
  },
};

export function cellFor(view: CommandView): CellSpec {
  return MATRIX[view.focus.kind][view.altitude];
}

// == URL codec ================================================================
// /c/{altitude}/{kind}/{id}?w=YYYY-MM-DD..YYYY-MM-DD&scn={scenarioId}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isAltitude(x: string): x is Altitude {
  return (ALTITUDES as readonly string[]).includes(x);
}
function isFocusKind(x: string): x is FocusKind {
  return (FOCUS_KINDS as readonly string[]).includes(x);
}

export function encodeView(view: CommandView): string {
  const base = `/c/${view.altitude}/${view.focus.kind}/${encodeURIComponent(view.focus.id)}`;
  const params = new URLSearchParams();
  if (view.window) params.set("w", `${view.window.from}..${view.window.to}`);
  if (view.scenario) params.set("scn", view.scenario);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Strict parse; returns null on any invalid segment (caller falls back to DEFAULT_VIEW). */
export function decodeView(pathname: string, search?: string): CommandView | null {
  const parts = pathname.split("/").filter(Boolean); // ["c", altitude, kind, id]
  if (parts.length !== 4 || parts[0] !== "c") return null;
  const altitude = parts[1];
  const kind = parts[2];
  const rawId = parts[3];
  if (!altitude || !isAltitude(altitude) || !kind || !isFocusKind(kind) || !rawId) return null;

  const view: CommandView = { focus: { kind, id: decodeURIComponent(rawId) }, altitude };

  const params = new URLSearchParams(search ?? "");
  const w = params.get("w");
  if (w) {
    const [from, to] = w.split("..");
    if (from && to && DATE_RE.test(from) && DATE_RE.test(to) && from <= to) {
      view.window = { from, to };
    }
  }
  const scn = params.get("scn");
  if (scn) view.scenario = scn;
  return view;
}

// == Transitions (the preservation laws, doc s3.2) ============================

/** Focus change preserves altitude, window, scenario. */
export function withFocus(view: CommandView, focus: Focus): CommandView {
  return { ...view, focus };
}

/** Altitude change preserves focus, window, scenario. */
export function withAltitude(view: CommandView, altitude: Altitude): CommandView {
  return { ...view, altitude };
}

export function withWindow(view: CommandView, window?: ViewWindow): CommandView {
  const next = { ...view };
  if (window) next.window = window; else delete next.window;
  return next;
}

export function withScenario(view: CommandView, scenario?: string): CommandView {
  const next = { ...view };
  if (scenario) next.scenario = scenario; else delete next.scenario;
  return next;
}

// == Moves (doc s3.3) =========================================================
// The module stays pure: graph lookups are injected. Phase 2 implements this
// resolver over the Article-7 query layer (containment via PART_OF/MEMBER_OF).

export interface GraphResolver {
  /** Containment parent (asset->market->place->parent place); null at the top. */
  parentOf(focus: Focus): Focus | null;
  /** Canonical drill child (place->primary market, market->own asset else top member,
   *  corridor->dest market, segment->top corridor, asset->null). */
  drillTarget(focus: Focus): Focus | null;
  /** Ordered siblings within the parent scope (including focus itself). */
  siblings(focus: Focus): Focus[];
  /** True only for the tenant's own assets (Article 5 gate). */
  isOwnAsset(focus: Focus): boolean;
}

/** Drill: focus := canonical child; altitude unchanged. No-op when childless. */
export function drill(view: CommandView, r: GraphResolver): CommandView {
  const child = r.drillTarget(view.focus);
  return child ? withFocus(view, child) : view;
}

/** Ascend: containment parent; at the top of containment, raise altitude instead. */
export function ascend(view: CommandView, r: GraphResolver): CommandView {
  const parent = r.parentOf(view.focus);
  if (parent) return withFocus(view, parent);
  const i = ALTITUDES.indexOf(view.altitude);
  const up = ALTITUDES[i + 1];
  return up ? withAltitude(view, up) : view;
}

/** Lateral: previous/next sibling, cycling. */
export function lateral(view: CommandView, r: GraphResolver, dir: 1 | -1): CommandView {
  const sibs = r.siblings(view.focus);
  if (sibs.length < 2) return view;
  const i = sibs.findIndex((s) => s.kind === view.focus.kind && s.id === view.focus.id);
  if (i === -1) return view;
  const next = sibs[(i + dir + sibs.length) % sibs.length];
  return next ? withFocus(view, next) : view;
}

// == Policy gates =============================================================

/**
 * Article 5 + Graph V4 scenario law, decided here so components never re-derive it:
 * Act only at operational altitude, only against an own asset, only on baseline.
 * Degraded-truth override (dead core data suppresses Act) is applied by the
 * provenance layer on top of this gate.
 */
export function isActAllowed(view: CommandView, target: Focus, r: GraphResolver): boolean {
  return view.altitude === "operational" && !view.scenario && r.isOwnAsset(target);
}