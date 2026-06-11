const bbox = "43.79,28.56,44.28,28.66";
const q = `[out:json][timeout:90];(nwr["tourism"~"hotel|resort"]["name"](${bbox}););out center;`;
const endpoints = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
let j = null;
for (const ep of endpoints) {
  try {
    const r = await fetch(ep, { method: "POST", headers: { "Content-Type": "text/plain" }, body: q });
    const txt = await r.text();
    if (txt.trim().startsWith("{")) { j = JSON.parse(txt); console.log("OK via", ep, "\n"); break; }
    console.log("non-JSON from", ep, "(", r.status, ")");
  } catch (e) { console.log("fail", ep, e.message); }
}
if (!j) { console.log("all endpoints failed"); process.exit(1); }
const hotels = (j.elements || []).map((e) => ({ name: e.tags?.name || "", lon: e.lat ? e.lon : e.center?.lon, lat: e.lat ?? e.center?.lat }))
  .filter((h) => h.name && h.lon && h.lat).sort((a, b) => a.name.localeCompare(b.name));
console.log("Found", hotels.length, "named hotels/resorts:\n");
for (const h of hotels) console.log(`${h.lon.toFixed(5)}, ${h.lat.toFixed(5)}  ${h.name}`);
