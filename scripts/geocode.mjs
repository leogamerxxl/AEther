const TOKEN = process.env.MB;
const hotels = [
  ["own-hotel-terra", "Hotel Terra", "Neptun"],
  ["3861e12a", "Vega Hotel", "Mamaia"],
  ["f6f67644", "Nayino Resort", "Eforie Nord"],
  ["97d036ec", "Modern Mamaia Resort", "Mamaia"],
  ["318b3067", "Hotel Cocor", "Neptun"],
  ["42dd51f9", "Savoy Hotel", "Mamaia"],
  ["5b9824ec", "Iaki Hotel", "Mamaia"],
  ["2dd372ad", "Hotel Comandor", "Mamaia"],
  ["fef41cc5", "Arena Regia Hotel", "Mamaia"],
  ["8706a3c2", "Zenith Hotel", "Olimp"],
  ["b5149448", "Splendid Hotel", "Mamaia"],
  ["a6077770", "Mera Onyx Hotel", "Neptun"],
  ["91cdc7a3", "Hotel Amfiteatru", "Olimp"],
];
for (const [id, name, town] of hotels) {
  const q = encodeURIComponent(`${name}, ${town}, Romania`);
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${q}&access_token=${TOKEN}&country=ro&proximity=28.61,43.95&limit=1`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    const f = j.features?.[0];
    if (f) {
      const [lng, lat] = f.geometry.coordinates;
      console.log(`${id}\t${lng.toFixed(5)}\t${lat.toFixed(5)}\t${f.properties?.name || ""} | ${f.properties?.place_formatted || ""}`);
    } else {
      console.log(`${id}\tNONE\tNONE\t(${name}, ${town})`);
    }
  } catch (e) {
    console.log(`${id}\tERR\t${e.message}`);
  }
}
