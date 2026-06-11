// Aether - OSM/Overpass amenities ingestion (FREE, cached to Supabase).
// Server-side only (service role key). Run:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/ingest-amenities.ts
// Populates public.local_amenities (coast / wellness / attraction / city).

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

// CORRECTED bbox: covers the real Neptun-Olimp hotel cluster (lat ~43.79-43.81).
// (The original 43.84-43.91 sat ~5km north of the hotels.) Order: south,west,north,east
const BBOX = "43.775,28.575,43.825,28.625";

type Tags = Record<string, string>;
interface El { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags; }

function categorize(tags: Tags): string {
  const a = tags.amenity || "", l = tags.leisure || "", n = tags.natural || "", t = tags.tourism || "", c = tags.cuisine || "";
  const name = (tags.name || "").toLowerCase();
  if (n === "beach" || l === "marina" || a === "boat_rental" || c === "seafood" || (a === "bar" && (name.includes("beach") || name.includes("plaja")))) return "coast";
  if (a === "spa" || l === "sauna" || t === "spa" || a === "massage" || tags.healthcare === "rehabilitation" || tags.sanatorium === "yes") return "wellness";
  if (t === "attraction" || t === "museum" || t === "artwork" || a === "nightclub" || a === "theatre" || l === "water_park" || l === "amusement_arcade") return "attraction";
  return "city";
}

async function run() {
  const q = `[out:json][timeout:90];(node["amenity"](${BBOX});way["amenity"](${BBOX});node["leisure"](${BBOX});way["leisure"](${BBOX});node["tourism"](${BBOX});way["tourism"](${BBOX});node["natural"="beach"](${BBOX}););out center;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "text/plain" }, body: q });
  const data = await res.json();
  const els: El[] = data.elements || [];
  console.log(`Overpass returned ${els.length} elements.`);

  const rows = els
    .filter((e) => e.tags && (e.tags.name || e.tags.amenity || e.tags.natural))
    .map((e) => {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (lat == null || lon == null) return null;
      const tags = e.tags as Tags;
      return {
        osm_id: `${e.type}/${e.id}`,                       // collision-safe (node/way share id space)
        name: tags.name || tags.amenity || tags.natural || "Unnamed",
        amenity_type: tags.amenity || tags.natural || tags.leisure || tags.tourism || "node",
        environment_category: categorize(tags),
        geom: `SRID=4326;POINT(${lon} ${lat})`,            // EWKT -> PostGIS geometry on insert
        meta_jsonb: { osm_tags: tags, batch: "neptun_coast_v1" },
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`Upserting ${rows.length} amenities...`);
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from("local_amenities").upsert(rows.slice(i, i + 100), { onConflict: "osm_id" });
    if (error) console.error(`Batch ${i / 100 + 1} error:`, error.message);
    else console.log(`Batch ${i / 100 + 1} ok (${Math.min(100, rows.length - i)} rows).`);
  }
  console.log("Ingestion complete. Cached to Supabase - no repeat API cost.");
}

run().catch((e) => { console.error("Ingestion failed:", e); process.exit(1); });
