// Landmark buildings - HIGH-FIDELITY crafted models for the important buildings
// (named hotels), rendered above the map to locally REPLACE Mapbox's generic
// low-poly extrusion. Mapbox still renders every other building; ours only take
// over the landmarks. The crafted geometry is opaque and slightly inflated so it
// cleanly occludes the Mapbox extrusion underneath (no z-fighting, no API
// dependency). This is the honest equivalent of Mapbox's proprietary landmark
// models (which exist for major cities only, not coastal resorts).
//
// Fidelity: massing + a cornice cap + rooftop units + a shader facade (recessed
// dark glass by day, lit windows at night, a taller glazed ground floor) + an
// on-building sign board with the hotel name and a generated monogram mark (like
// the BRD rooftop sign). Real brand logos are not used (IP); name + monogram is ours.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ScenePalette } from "@/lib/world/daylight";

const FLOOR_M = 3.1;

export interface LandmarkFeat {
  id: number;
  properties: { name: string | null; levels: string | null; height: string | null; building: string | null };
  geometry: { type: string; coordinates: number[][][] };
}

function hash(n: number): number { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

function heightFor(f: LandmarkFeat): number {
  const h = f.properties.height ? parseFloat(f.properties.height) : NaN;
  if (!Number.isNaN(h) && h > 2) return h;
  const lv = f.properties.levels ? parseInt(f.properties.levels, 10) : NaN;
  if (!Number.isNaN(lv) && lv > 0) return lv * FLOOR_M + 1.5;
  const name = (f.properties.name ?? "").toLowerCase();
  if (name.includes("hotel") || (f.properties.building ?? "") === "hotel") return (7 + Math.round(hash(f.id) * 4)) * FLOOR_M;
  return (3 + Math.round(hash(f.id) * 2)) * FLOOR_M;
}

/** Named hotels / resorts get the high-fidelity treatment. */
export function isLandmark(f: LandmarkFeat): boolean {
  const n = (f.properties.name ?? "");
  return !!n && (/hotel|resort|vila|palas|palace/i.test(n) || (f.properties.building ?? "") === "hotel");
}

function cleanRing(ring: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > 1e-4 || Math.abs(last[1] - p[1]) > 1e-4) out.push(p);
  }
  while (out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4) out.pop(); else break;
  }
  return out;
}

/** Grow a ring outward from its centroid so the crafted mass occludes Mapbox's. */
function inflate(ring: [number, number][], meters: number): [number, number][] {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return ring.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return [x + (dx / d) * meters, y + (dy / d) * meters] as [number, number];
  });
}

function toShape(ring: [number, number][]): THREE.Shape | null {
  const r = cleanRing(ring);
  if (r.length < 3) return null;
  return new THREE.Shape(r.map(([x, y]) => new THREE.Vector2(x, y)));
}

// HIGH-FIDELITY facade shader: recessed dark glass (day) + lit windows (night),
// a taller glazed ground floor. World-position driven (no UVs).
function facade(mat: THREE.MeshStandardMaterial, winColor: string, nightIntensity: number, litRatio: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWin = { value: new THREE.Color(winColor) };
    shader.uniforms.uNight = { value: nightIntensity };
    shader.uniforms.uLit = { value: litRatio };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp;\nvarying vec3 vWn;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(position,1.0)).xyz;\nvWn = normalize(mat3(modelMatrix) * normal);");
    const head = `#include <common>
      varying vec3 vWp; varying vec3 vWn;
      uniform vec3 uWin; uniform float uNight; uniform float uLit;
      float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      vec3 aetherFacade(){
        float wall = 1.0 - abs(vWn.z);
        float fz = vWp.z / ${FLOOR_M.toFixed(2)};
        float fr = fract(fz);
        float u = dot(vWp.xy, normalize(vec2(-vWn.y, vWn.x)));
        float uc = fract(u / 2.35);
        float wv = smoothstep(0.16,0.24,fr) * (1.0 - smoothstep(0.74,0.82,fr));
        float wh2 = smoothstep(0.14,0.22,uc) * (1.0 - smoothstep(0.78,0.86,uc));
        float win = wv * wh2 * wall;
        float ground = 1.0 - smoothstep(0.9, 1.1, fz);
        float lit = step(1.0 - uLit, wh(vec2(floor(u/2.35), floor(fz))));
        return vec3(win, lit, ground * wall);
      }`;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", head)
      .replace("#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 f = aetherFacade();
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.4, f.x * 0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + 0.02, f.z * 0.5);
        }`)
      .replace("#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 f = aetherFacade();
          totalEmissiveRadiance += uWin * f.x * (f.y * uNight + f.z * 0.5 * max(uNight, 0.15));
        }`);
  };
}

// Rooftop sign board: name + a generated monogram square (BRD-style), emissive.
function signMesh(name: string, hero: boolean, cx: number, cy: number, z: number, P: ScenePalette): THREE.Object3D {
  const cv = document.createElement("canvas");
  cv.width = 640; cv.height = 160;
  const ctx = cv.getContext("2d");
  const grp = new THREE.Group();
  if (!ctx) return grp;
  const mono = name.trim()[0]?.toUpperCase() ?? "H";
  const accent = hero ? "#22D3EE" : "#e6b566";
  ctx.fillStyle = accent;
  ctx.fillRect(18, 40, 80, 80);
  ctx.fillStyle = "#0a0d12";
  ctx.font = "700 56px Geist, Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(mono, 58, 82);
  ctx.fillStyle = P.winIntensity > 0 ? "#eef4f8" : "#1a2028";
  ctx.font = "600 62px Geist, Arial, sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(name.toUpperCase().replace(/^HOTEL\s+/, ""), 118, 84);
  const tex = new THREE.CanvasTexture(cv);
  const w = 22, hh = w * (160 / 640);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(w, hh),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: P.winIntensity > 0 ? 1.1 : 0.35 }));
  board.position.set(cx, cy, z + hh / 2 + 1.2);
  board.rotation.x = Math.PI / 2;
  board.rotation.y = Math.PI;
  grp.add(board);
  return grp;
}

export interface LandmarkResult {
  group: THREE.Group;
  footprints: [number, number][][];
}

export function buildLandmarks(
  feats: LandmarkFeat[],
  toLocal: (p: number[]) => [number, number],
  isHeroRing: (ring: number[][]) => boolean,
  P: ScenePalette,
): LandmarkResult {
  const group = new THREE.Group();
  const footprints: [number, number][][] = [];

  const bodyMat = new THREE.MeshStandardMaterial({ color: P.body, roughness: 0.86, metalness: 0.12 });
  const heroMat = new THREE.MeshStandardMaterial({ color: P.bodyHero, roughness: 0.84, metalness: 0.14 });
  facade(bodyMat, P.windowWarm, P.winIntensity, P.winLit);
  facade(heroMat, P.windowCool, P.winIntensity * 1.4, Math.min(0.6, P.winLit * 1.5));
  const corniceMat = new THREE.MeshStandardMaterial({ color: P.body, roughness: 0.7, metalness: 0.2 });
  const heroCorniceMat = new THREE.MeshStandardMaterial({ color: P.bodyHero, roughness: 0.68, metalness: 0.22 });
  const unitMat = new THREE.MeshStandardMaterial({ color: P.body, roughness: 0.9 });

  const bodyG: THREE.BufferGeometry[] = [];
  const heroG: THREE.BufferGeometry[] = [];
  const corniceG: THREE.BufferGeometry[] = [];
  const heroCorniceG: THREE.BufferGeometry[] = [];
  const unitG: THREE.BufferGeometry[] = [];

  for (const f of feats) {
    if (f.geometry.type !== "Polygon") continue;
    const raw = f.geometry.coordinates[0].map(toLocal);
    const hero = isHeroRing(f.geometry.coordinates[0]);
    const infl = inflate(cleanRing(raw), 0.6);
    const shape = toShape(infl);
    if (!shape) continue;
    footprints.push(cleanRing(raw));
    const h = hero ? Math.max(heightFor(f), 9 * FLOOR_M) : heightFor(f);

    const mass = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    (hero ? heroG : bodyG).push(mass);

    const corniceShape = toShape(inflate(cleanRing(raw), 1.3));
    if (corniceShape) {
      const cornice = new THREE.ExtrudeGeometry(corniceShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 1 });
      cornice.translate(0, 0, h - 0.4);
      (hero ? heroCorniceG : corniceG).push(cornice);
    }

    const cx = raw.reduce((s, p) => s + p[0], 0) / raw.length;
    const cy = raw.reduce((s, p) => s + p[1], 0) / raw.length;
    const units = 1 + Math.round(hash(f.id) * 1.4);
    for (let i = 0; i < units; i++) {
      const box = new THREE.BoxGeometry(3 + hash(f.id + i) * 3, 2.4 + hash(f.id * 2 + i) * 2, 2);
      box.translate(cx + (hash(f.id + i * 3) - 0.5) * 8, cy + (hash(f.id * 5 + i) - 0.5) * 8, h + 1);
      unitG.push(box);
    }

    if (f.properties.name) group.add(signMesh(f.properties.name, hero, cx, cy, h, P));
  }

  const add = (geoms: THREE.BufferGeometry[], mat: THREE.Material) => {
    if (geoms.length === 0) return;
    const merged = mergeGeometries(geoms, false);
    geoms.forEach((g) => g.dispose());
    if (merged) group.add(new THREE.Mesh(merged, mat));
  };
  add(bodyG, bodyMat);
  add(heroG, heroMat);
  add(corniceG, corniceMat);
  add(heroCorniceG, heroCorniceMat);
  add(unitG, unitMat);

  return { group, footprints };
}