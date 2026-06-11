// Real-data snapshot of the Hotel Terra competitive set.
// Captured from Supabase project irmyramqaovmgcktbazy on 2026-06-01.
// REAL: avg/min/max rates, availability %, stars.
// Coordinates corrected 2026-06-03 onto land at each resort (Mamaia sandbar,
// Olimp/Neptun inland, Eforie coast) - they were sitting in the sea.
// Rooftop-exact placement is the Google Places geocode integration (pending key).
// NOT in DB yet: reviews, booking pace, posts, demographics, photos.
// Illustrative: own rate + ADR/RevPAR/occupancy (no OTB/PMS data yet).

export type Point = {
  id: string;
  name: string;
  stars: number;
  city: string;
  lat: number;
  lng: number;
  rate: number | null;
  minRate?: number | null;
  maxRate?: number | null;
  avail: number;
  propertyType?: string;
  own?: boolean;
  distanceKm?: number;
  alert?: boolean;
};

export const OWN: Point = {
  id: "own-hotel-terra",
  name: "Hotel Terra Neptun",
  stars: 4,
  city: "Neptun",
  lat: 43.86944,
  lng: 28.59612,
  rate: 575,
  minRate: 540,
  maxRate: 690,
  avail: 24,
  propertyType: "hotel",
  own: true,
};

export const COMPETITORS: Point[] = [
  { id: "3861e12a", name: "Vega Hotel Mamaia",         stars: 5, city: "Mamaia",      lat: 44.25722, lng: 28.62071, rate: 609, minRate: 458, maxRate: 772, avail: 90, propertyType: "hotel" },
  { id: "f6f67644", name: "Nayino Resort Eforie Nord", stars: 4, city: "Eforie Nord", lat: 44.06550, lng: 28.63700, rate: 608, minRate: 450, maxRate: 771, avail: 76, propertyType: "hotel" },
  { id: "97d036ec", name: "Modern Mamaia Resort",      stars: 4, city: "Mamaia",      lat: 44.25109, lng: 28.62111, rate: 607, minRate: 456, maxRate: 766, avail: 83, propertyType: "hotel" },
  { id: "318b3067", name: "Hotel Cocor Spa",           stars: 4, city: "Neptun",      lat: 43.87874, lng: 28.60378, rate: 607, minRate: 450, maxRate: 761, avail: 69, propertyType: "hotel" },
  { id: "42dd51f9", name: "Savoy Hotel Mamaia",        stars: 4, city: "Mamaia",      lat: 44.26220, lng: 28.61978, rate: 606, minRate: 461, maxRate: 773, avail: 86, propertyType: "hotel" },
  { id: "5b9824ec", name: "Iaki Conference & Spa",     stars: 5, city: "Mamaia",      lat: 44.24375, lng: 28.62243, rate: 606, minRate: 454, maxRate: 774, avail: 93, propertyType: "hotel" },
  { id: "2dd372ad", name: "Hotel Comandor",            stars: 4, city: "Mamaia",      lat: 44.26017, lng: 28.61917, rate: 606, minRate: 453, maxRate: 772, avail: 88, propertyType: "hotel" },
  { id: "fef41cc5", name: "Arena Regia Hotel & Spa",   stars: 4, city: "Mamaia",      lat: 44.27100, lng: 28.61800, rate: 605, minRate: 451, maxRate: 774, avail: 83, propertyType: "hotel" },
  { id: "8706a3c2", name: "Zenith Conference & Spa",   stars: 4, city: "Mamaia",       lat: 44.25445, lng: 28.62087, rate: 605, minRate: 453, maxRate: 774, avail: 90, propertyType: "hotel" },
  { id: "b5149448", name: "Splendid Hotel & Spa",      stars: 4, city: "Mamaia",      lat: 44.25388, lng: 28.61860, rate: 604, minRate: 450, maxRate: 770, avail: 86, propertyType: "hotel" },
  { id: "a6077770", name: "Mera Onyx Hotel Neptun",    stars: 4, city: "Neptun",      lat: 43.87000, lng: 28.59950, rate: 604, minRate: 460, maxRate: 772, avail: 88, propertyType: "hotel" },
  { id: "91cdc7a3", name: "Hotel Amfiteatru Olimp",    stars: 3, city: "Olimp",       lat: 43.88377, lng: 28.60567, rate: null, minRate: null, maxRate: null, avail: 0, propertyType: "hotel", alert: true },
];

export const TRAJECTORY = [
  625, 598, 598, 597, 601, 597, 621, 625, 600, 597, 599, 602, 600, 625,
];

function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const COMPETITORS_WITH_DIST: Point[] = COMPETITORS.map((c) => ({
  ...c,
  distanceKm: Math.round(haversineKm(OWN, c) * 10) / 10,
})).sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

export const ALL_POINTS: Point[] = [OWN, ...COMPETITORS_WITH_DIST];

const ratedComps = COMPETITORS.filter((c) => c.rate != null) as Required<Point>[];
export const MARKET_AVG = Math.round(
  ratedComps.reduce((s, c) => s + (c.rate as number), 0) / ratedComps.length
);
export const OWN_GAP = (OWN.rate as number) - MARKET_AVG;

export const METRICS = {
  adr: OWN.rate as number,
  revpar: 313,
  occupancy: 76,
  adrDelta: 4.2,
  revparDelta: 6.1,
  occupancyDelta: -2.0,
};