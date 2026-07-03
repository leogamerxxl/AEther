// Digital-twin SAMPLE data for Hotel Terra Neptun - explicitly DEMO until the
// OTB/PMS channel feeds real occupancy/inventory (Truth Doctrine: labeled, never
// passed off as live). Shape is the contract the real twin collectors will fill.

export interface TwinInventoryItem { name: string; qty: number; unit: string; low: boolean }
export interface TwinRole { role: string; state: "in tura" | "pauza" | "liber" }
export interface TwinDepartment { id: string; label: string; roles: TwinRole[]; inventory: TwinInventoryItem[] }
export interface TwinFloor { id: string; label: string; rooms: number; occupied: number }
export interface PropertyTwin {
  demo: true;
  occupancyPct: number;
  floors: TwinFloor[];
  departments: TwinDepartment[];
}

export const TERRA_TWIN: PropertyTwin = {
  demo: true,
  occupancyPct: 82,
  floors: [
    { id: "f3", label: "Etaj 3", rooms: 16, occupied: 14 },
    { id: "f2", label: "Etaj 2", rooms: 18, occupied: 15 },
    { id: "f1", label: "Etaj 1", rooms: 18, occupied: 14 },
  ],
  departments: [
    {
      id: "bar", label: "Bar & Terasa",
      roles: [{ role: "Barman", state: "in tura" }, { role: "Ospatar", state: "in tura" }],
      inventory: [
        { name: "Sirop de casa", qty: 12, unit: "sticle", low: false },
        { name: "Espresso boabe", qty: 3, unit: "kg", low: true },
        { name: "Vin alb (litoral)", qty: 18, unit: "sticle", low: false },
      ],
    },
    {
      id: "housekeeping", label: "Housekeeping",
      roles: [{ role: "Camerista", state: "in tura" }, { role: "Camerista", state: "pauza" }],
      inventory: [{ name: "Lenjerie schimb", qty: 40, unit: "seturi", low: false }],
    },
    {
      id: "reception", label: "Receptie",
      roles: [{ role: "Receptioner", state: "in tura" }],
      inventory: [],
    },
  ],
};