// =============================================================================
// HOTEL TERRA NEPTUN - physical building spec  (the "asset twin" semantic layer)
//
// THIS IS THE FILE YOU DESCRIBE THE BUILDING IN.
// Edit the `use` and `scope` lines below to match the real hotel. Whatever you
// write here flows straight into the 3D twin floor/zone callouts and the
// operations console - no other code change needed.
//
//   - The FOOTPRINT (ground-plan polygon) is REAL data - Hotel Terra actual
//     OSM outline (way 234012993, open ODbL licence). We do NOT touch that.
//   - The MEANING of each floor and zone is YOURS to dictate. The lines marked
//     [EXAMPLE] are placeholder guesses from the demo - replace with reality.
//   - `wing` only decides where a zone sits along the building in the 3D view
//     (west / center / east). Pick whichever matches the real layout.
//
// You can edit this directly, or just tell me in chat ("ground floor is X,
// scope is Y") and I will fill it in.
// =============================================================================

import type { ZoneId } from "./ops";

export type Wing = "west" | "center" | "east";

export interface TerraZone {
  id: ZoneId;
  label: string;
  use: string;   // what it is - one plain line
  scope: string; // what it covers / who runs it
  wing: Wing;    // where it sits along the building (3D placement only)
}

export interface TerraFloor {
  level: number;     // 0 = ground floor, counting up
  name: string;      // display name, e.g. "Ground floor"
  use: string;       // what this whole floor is for - one line  [EDIT ME]
  heightM: number;   // floor-to-floor height in metres (for 3D proportions)
  zones: TerraZone[];
}

// -- Describe each floor here -------------------------------------------------
export const TERRA_FLOORS: TerraFloor[] = [
  {
    level: 0,
    name: "Ground floor",
    use: "Arrival, public spaces and the sea-facing F&B / leisure deck.", // [EDIT ME]
    heightM: 4.2,
    zones: [
      { id: "lobby",   label: "Lobby",     wing: "center", use: "Reception, check-in/out and concierge.",       scope: "Front desk - arrivals - cameras - booking pace" }, // [EXAMPLE]
      { id: "terrace", label: "Terrace",   wing: "east",   use: "Sea-facing service terrace, 18 tables.",       scope: "Tables - drink to food wait - order flow" },        // [EXAMPLE]
      { id: "pool",    label: "Pool Deck", wing: "west",   use: "Outdoor pool and sun deck.",                   scope: "Guest count - weather cross-ref - loungers" },      // [EXAMPLE]
      { id: "kids",    label: "Kids Club", wing: "west",   use: "Supervised children activity room.",           scope: "Check-in - staff ratio - activity schedule" },      // [EXAMPLE]
    ],
  },
  {
    level: 1,
    name: "Level 1",
    use: "Dining and beverage - the kitchen and the rooms it feeds.", // [EDIT ME]
    heightM: 3.6,
    zones: [
      { id: "restaurant", label: "Restaurant", wing: "west",   use: "Main indoor restaurant.", scope: "Covers - table turns - menu board" },                // [EXAMPLE]
      { id: "kitchen",    label: "Kitchen",    wing: "center", use: "Production kitchen.",      scope: "Supply - delivery flags - 86 board - consumption" }, // [EXAMPLE]
      { id: "bar",        label: "Bar",        wing: "east",   use: "Cocktail and service bar.", scope: "Beverage stock - low-stock flags - pour rate" },    // [EXAMPLE]
    ],
  },
  {
    level: 2,
    name: "Level 2",
    use: "Wellness floor.", // [EDIT ME]
    heightM: 3.4,
    zones: [
      { id: "spa", label: "Spa & Wellness", wing: "center", use: "Spa, treatment rooms and sauna.", scope: "Bookings - therapist load - stock" }, // [EXAMPLE]
    ],
  },
  {
    level: 3,
    name: "Level 3",
    use: "Guest accommodation.", // [EDIT ME]
    heightM: 3.2,
    zones: [
      { id: "rooms", label: "Guest Rooms", wing: "center", use: "Guest rooms and corridors.", scope: "Occupancy - arrivals/departures - housekeeping" }, // [EXAMPLE]
    ],
  },
];

// -- Lookups used by the twin / console --------------------------------------
const ZONE_INDEX: Record<string, TerraZone> = Object.fromEntries(
  TERRA_FLOORS.flatMap((f) => f.zones.map((z) => [z.id, z]))
);

export const zoneSpec = (id: ZoneId): TerraZone | undefined => ZONE_INDEX[id];
export const floorForLevel = (level: number): TerraFloor | undefined =>
  TERRA_FLOORS.find((f) => f.level === level);

// west / center / east -> normalised x position (0..1) across the footprint.
export const WING_X: Record<Wing, number> = { west: 0.2, center: 0.5, east: 0.8 };
