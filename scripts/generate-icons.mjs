// Generates Aether PWA icons from a path-based SVG (no font dependency) via sharp.
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

// scale = fraction of the tile the mark occupies (smaller = more padding for maskable)
function svg(size, scale) {
  const c = size / 2;
  const half = (size * scale) / 2;
  // Mark geometry within a normalized box, then offset/scaled to center.
  const apexY = c - half;
  const footY = c + half * 0.9;
  const lx = c - half * 0.82;
  const rx = c + half * 0.82;
  const barY = c + half * 0.32;
  const blx = c - half * 0.38;
  const brx = c + half * 0.38;
  const sw = Math.max(8, size * 0.052);
  const dotR = size * 0.022;
  const r = size * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#16130f"/>
      <stop offset="100%" stop-color="#0A0908"/>
    </radialGradient>
    <linearGradient id="amber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E0BE86"/>
      <stop offset="100%" stop-color="#C8A165"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <rect x="${sw*0.5}" y="${sw*0.5}" width="${size-sw}" height="${size-sw}" rx="${r-sw*0.5}" fill="none" stroke="rgba(200,161,101,0.16)" stroke-width="${Math.max(1,size*0.004)}"/>
  <circle cx="${c}" cy="${apexY - half*0.22}" r="${dotR}" fill="url(#amber)"/>
  <path d="M ${lx} ${footY} L ${c} ${apexY} L ${rx} ${footY}" fill="none" stroke="url(#amber)" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M ${blx} ${barY} L ${brx} ${barY}" fill="none" stroke="url(#amber)" stroke-width="${sw*0.86}" stroke-linecap="round"/>
</svg>`;
}

async function out(name, size, scale) {
  const buf = Buffer.from(svg(size, scale));
  await sharp(buf).png().toFile(join(PUBLIC, name));
  console.log("wrote", name, size + "x" + size);
}

await out("icon-192.png", 192, 0.52);
await out("icon-512.png", 512, 0.52);
await out("icon-512-maskable.png", 512, 0.40); // extra padding for maskable safe zone
await out("apple-touch-icon.png", 180, 0.52);
// crisp source SVG for any-size usage
import { writeFileSync } from "node:fs";
writeFileSync(join(PUBLIC, "icon.svg"), svg(512, 0.52));
console.log("wrote icon.svg");
