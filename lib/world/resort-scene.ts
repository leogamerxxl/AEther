// Resort scene v3 - the property/twin band world treatment: REAL Neptun
// footprints rebuilt as a crafted 3D scene in a Mapbox custom layer (three.js
// sharing the map GL context).
//
// PERFORMANCE DOCTRINE: the world is STATIC, so every repeated element is
// batched. Buildings/pools are merged per material (mergeGeometries -> one draw
// call per group); furniture/cars/palms/trees are InstancedMesh. This collapses
// ~600 individual meshes to ~18 draw calls so camera motion holds 60fps.
//
// Look = lighting + shader windows, no textures. Daylight phases
// (lib/world/daylight.ts): cream massing at noon, sunset ambient at dusk, lit
// windows at night. 2.5D bas-relief facades: hotels are stacked floor slabs
// with beveled cornices.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import { C } from "@/lib/command-theme";
import { SCENE, type DayPhase } from "@/lib/world/daylight";
import osm from "@/lib/world/neptun-osm.json";
import details from "@/lib/world/patch-details.json";

const ANCHOR: [number, number] = [28.59612, 43.86944]; // Hotel Terra Neptun (corridor.ts OWN)
const FLOOR_M = 3.1;

interface Feat {
  id: number;
  properties: { name: string | null; levels: string | null; height: string | null; building: string | null };
  geometry: { type: string; coordinates: number[][][] };
}
interface PoolRec { id: number; ring: number[][]; name: string | null }
interface Details { pools: PoolRec[]; trees: number[][]; woods: PoolRec[]; venues: PoolRec[]; parkings?: PoolRec[] }

function hash(n: number): number { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

function heightFor(f: Feat): number {
  const h = f.properties.height ? parseFloat(f.properties.height) : NaN;
  if (!Number.isNaN(h) && h > 2) return h;
  const lv = f.properties.levels ? parseInt(f.properties.levels, 10) : NaN;
  if (!Number.isNaN(lv) && lv > 0) return lv * FLOOR_M + 1.5;
  const name = (f.properties.name ?? "").toLowerCase();
  const kind = (f.properties.building ?? "").toLowerCase();
  if (name.includes("hotel") || kind === "hotel") return (7 + Math.round(hash(f.id) * 4)) * FLOOR_M;
  if (name.includes("biseric")) return 11;
  if (name.includes("teatr")) return 9;
  if (kind === "apartments") return 5 * FLOOR_M;
  return (2 + Math.round(hash(f.id) * 2)) * FLOOR_M;
}

function toLocal([lng, lat]: number[]): [number, number] {
  const kx = 111_320 * Math.cos((ANCHOR[1] * Math.PI) / 180);
  const ky = 110_540;
  return [(lng - ANCHOR[0]) * kx, (lat - ANCHOR[1]) * ky];
}

function pointInRing(pt: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Degenerate rings hang THREE.ShapeUtils triangulation - sanitize every ring.
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

function toShape(ringLocal: [number, number][]): THREE.Shape | null {
  const r = cleanRing(ringLocal);
  if (r.length < 3) return null;
  return new THREE.Shape(r.map(([x, y]) => new THREE.Vector2(x, y)));
}

// Shader-computed window grid (no UVs) - walls only, per-floor bands.
function windowize(mat: THREE.MeshStandardMaterial, colorHex: string, intensity: number, litRatio: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWinColor = { value: new THREE.Color(colorHex) };
    shader.uniforms.uWinIntensity = { value: intensity };
    shader.uniforms.uLitRatio = { value: litRatio };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWpos;\nvarying vec3 vWnormal;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWpos = (modelMatrix * vec4(position,1.0)).xyz;\nvWnormal = normalize(mat3(modelMatrix) * normal);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWpos;\nvarying vec3 vWnormal;\nuniform vec3 uWinColor;\nuniform float uWinIntensity;\nuniform float uLitRatio;\nfloat whash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }")
      .replace("#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          float wall = 1.0 - abs(vWnormal.z);
          float fz = vWpos.z / ${FLOOR_M.toFixed(2)};
          float band = smoothstep(0.30, 0.40, fract(fz)) * (1.0 - smoothstep(0.62, 0.72, fract(fz)));
          float u = dot(vWpos.xy, normalize(vec2(-vWnormal.y, vWnormal.x)));
          float colCell = floor(u / 2.4);
          float win = smoothstep(0.25, 0.35, fract(u / 2.4)) * (1.0 - smoothstep(0.72, 0.82, fract(u / 2.4)));
          float lit = step(1.0 - uLitRatio, whash(vec2(colCell, floor(fz))));
          totalEmissiveRadiance += uWinColor * band * win * lit * wall * uWinIntensity;
        }`);
  };
}

// Merge a geometry list into a single mesh (or null if empty). Disposes inputs.
function mergedMesh(geoms: THREE.BufferGeometry[], mat: THREE.Material): THREE.Mesh | null {
  if (geoms.length === 0) return null;
  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  if (!merged) return null;
  return new THREE.Mesh(merged, mat);
}

// Build an InstancedMesh from a base geometry + a transform list.
function instanced(
  geo: THREE.BufferGeometry, mat: THREE.Material,
  xf: { x: number; y: number; z: number; rot?: number; rotAxis?: "z" | "x"; scale?: number; color?: THREE.Color }[],
): THREE.InstancedMesh | null {
  if (xf.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, xf.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const axisZ = new THREE.Vector3(0, 0, 1);
  const axisX = new THREE.Vector3(1, 0, 0);
  let hasColor = false;
  xf.forEach((t, i) => {
    pos.set(t.x, t.y, t.z);
    q.setFromAxisAngle(t.rotAxis === "x" ? axisX : axisZ, t.rot ?? 0);
    const sc = t.scale ?? 1;
    scl.set(sc, sc, sc);
    m4.compose(pos, q, scl);
    mesh.setMatrixAt(i, m4);
    if (t.color) { mesh.setColorAt(i, t.color); hasColor = true; }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (hasColor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export const RESORT_LAYER_ID = "aether-resort-3d";
export const RESORT_MIN_ZOOM = 14.3;

export function createResortLayer(phase: DayPhase): CustomLayerInterface {
  const P = SCENE[phase];
  let camera: THREE.Camera;
  let scene: THREE.Scene;
  let renderer: THREE.WebGLRenderer | null = null;
  let mapRef: MapboxMap | null = null;

  const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: ANCHOR[0], lat: ANCHOR[1] }, 0);
  const s = mc.meterInMercatorCoordinateUnits();

  // reused per-frame matrices (no per-frame allocation)
  const mMat = new THREE.Matrix4();
  const lMat = new THREE.Matrix4()
    .makeTranslation(mc.x, mc.y, mc.z ?? 0)
    .scale(new THREE.Vector3(s, -s, s));

  return {
    id: RESORT_LAYER_ID,
    type: "custom",
    renderingMode: "3d",
    onAdd(map: MapboxMap, gl: WebGLRenderingContext) {
      mapRef = map;
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      scene.add(new THREE.AmbientLight(P.ambient.color, P.ambient.intensity));
      const key = new THREE.DirectionalLight(P.key.color, P.key.intensity);
      key.position.set(...P.key.pos);
      scene.add(key);
      const fill = new THREE.DirectionalLight(P.fill.color, P.fill.intensity);
      fill.position.set(...P.fill.pos);
      scene.add(fill);

      // Shared materials (one per group -> merge-friendly)
      const bodyMat = new THREE.MeshStandardMaterial({ color: P.body, roughness: 0.88, metalness: 0.1 });
      const hotelMat = new THREE.MeshStandardMaterial({ color: P.body, roughness: 0.88, metalness: 0.1 });
      const heroMat = new THREE.MeshStandardMaterial({ color: P.bodyHero, roughness: 0.88, metalness: 0.1 });
      if (P.winIntensity > 0) {
        windowize(hotelMat, P.windowWarm, P.winIntensity * 0.9, P.winLit);
        windowize(heroMat, P.windowCool, P.winIntensity * 1.6, Math.min(0.6, P.winLit * 1.6));
      }

      // Buildings: collect geometries per group, merge to one mesh each
      const bodyGeoms: THREE.BufferGeometry[] = [];
      const hotelGeoms: THREE.BufferGeometry[] = [];
      const heroGeoms: THREE.BufferGeometry[] = [];
      let heroShape: THREE.Shape | null = null;
      let heroH = 0;

      const feats = (osm as { features: Feat[] }).features;
      for (const f of feats) {
        if (f.geometry.type !== "Polygon") continue;
        const ringLocal = f.geometry.coordinates[0].map(toLocal);
        const isHero = pointInRing([0, 0], ringLocal);
        const shape = toShape(ringLocal);
        if (!shape) continue;
        const h = isHero ? Math.max(heightFor(f), 9 * FLOOR_M) : heightFor(f);
        const name = (f.properties.name ?? "").toLowerCase();
        const isHotel = isHero || name.includes("hotel") || (f.properties.building ?? "") === "hotel";

        if (isHotel) {
          const floors = Math.max(2, Math.round(h / FLOOR_M));
          const target = isHero ? heroGeoms : hotelGeoms;
          for (let i = 0; i < floors; i++) {
            const slab = new THREE.ExtrudeGeometry(shape, {
              depth: FLOOR_M * 0.9, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.26, bevelSegments: 1,
            });
            slab.translate(0, 0, i * FLOOR_M);
            target.push(slab);
          }
          if (isHero) { heroShape = shape; heroH = h; }
        } else {
          bodyGeoms.push(new THREE.ExtrudeGeometry(shape, {
            depth: h, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.7, bevelSegments: 2,
          }));
        }
      }
      const bodyMesh = mergedMesh(bodyGeoms, bodyMat); if (bodyMesh) scene.add(bodyMesh);
      const hotelMesh = mergedMesh(hotelGeoms, hotelMat); if (hotelMesh) scene.add(hotelMesh);
      const heroMesh = mergedMesh(heroGeoms, heroMat); if (heroMesh) scene.add(heroMesh);
      if (heroShape) {
        const outline = new THREE.ExtrudeGeometry(heroShape, { depth: heroH, bevelEnabled: false });
        scene.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(outline, 32),
          new THREE.LineBasicMaterial({ color: C.live, transparent: true, opacity: phase === "day" ? 0.5 : 0.75 })));
        outline.dispose();
      }

      // Pools: merged rim / basin / water; furniture and palms instanced
      const det = details as unknown as Details;
      const rimGeoms: THREE.BufferGeometry[] = [];
      const basinGeoms: THREE.BufferGeometry[] = [];
      const waterGeoms: THREE.BufferGeometry[] = [];
      const umbrellaXf: { x: number; y: number; z: number }[] = [];
      const loungerXf: { x: number; y: number; z: number; rot: number }[] = [];
      const palmXf: { x: number; y: number; z: number; rot: number; rotAxis: "x" }[] = [];

      for (const pool of det.pools) {
        const ring = pool.ring.map(toLocal);
        const shape = toShape(ring);
        if (!shape) continue;
        const rim = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false }); rimGeoms.push(rim);
        const basin = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false }); basin.translate(0, 0, -1.6); basinGeoms.push(basin);
        const water = new THREE.ShapeGeometry(shape); water.translate(0, 0, -0.5); waterGeoms.push(water);

        const cx = ring.reduce((s2, q) => s2 + q[0], 0) / ring.length;
        const cy = ring.reduce((s2, q) => s2 + q[1], 0) / ring.length;
        const n = 5 + Math.round(hash(pool.id) * 3);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + hash(pool.id + i) * 0.5;
          const rr = 7 + hash(pool.id * 3 + i) * 4;
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (pointInRing([px, py], ring)) continue;
          umbrellaXf.push({ x: px, y: py, z: 0 });
          for (const k of [-1, 1]) {
            loungerXf.push({
              x: px + k * 1.1 * Math.cos(a + Math.PI / 2), y: py + k * 1.1 * Math.sin(a + Math.PI / 2),
              z: 0.22, rot: a,
            });
          }
        }
        const np = 4 + Math.round(hash(pool.id * 7) * 3);
        for (let i = 0; i < np; i++) {
          const a = (i / np) * Math.PI * 2 + hash(pool.id + i * 3) * 0.8;
          const rr = 11 + hash(pool.id + i) * 5;
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (pointInRing([px, py], ring)) continue;
          palmXf.push({ x: px, y: py, z: 0, rot: (hash(px) - 0.5) * 0.12, rotAxis: "x" });
        }
      }
      const basinMat = new THREE.MeshStandardMaterial({ color: "#0a1418", roughness: 0.9 });
      const waterMat = new THREE.MeshStandardMaterial({
        color: P.water, roughness: 0.12, metalness: 0.08,
        emissive: P.water, emissiveIntensity: P.waterEmissive, transparent: true, opacity: 0.94,
      });
      const rimMat = new THREE.MeshStandardMaterial({ color: P.body, roughness: 0.8 });
      const trunkMat = new THREE.MeshStandardMaterial({ color: P.trunk, roughness: 0.9 });
      const umbrellaMat = new THREE.MeshStandardMaterial({ color: "#d8cfc0", roughness: 0.75, side: THREE.DoubleSide });
      const loungerMat = new THREE.MeshStandardMaterial({ color: "#c8bfae", roughness: 0.7 });
      const palmFrondMat = new THREE.MeshStandardMaterial({ color: P.canopy, roughness: 0.85, side: THREE.DoubleSide });

      const rimMesh = mergedMesh(rimGeoms, rimMat); if (rimMesh) scene.add(rimMesh);
      const basinMesh = mergedMesh(basinGeoms, basinMat); if (basinMesh) scene.add(basinMesh);
      const waterMesh = mergedMesh(waterGeoms, waterMat); if (waterMesh) scene.add(waterMesh);

      const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.1, 5); poleGeo.rotateX(Math.PI / 2); poleGeo.translate(0, 0, 1.05);
      const canopyGeo = new THREE.ConeGeometry(1.5, 0.7, 8); canopyGeo.rotateX(Math.PI / 2); canopyGeo.translate(0, 0, 2.25);
      const poleI = instanced(poleGeo, trunkMat, umbrellaXf); if (poleI) scene.add(poleI);
      const canopyI = instanced(canopyGeo, umbrellaMat, umbrellaXf); if (canopyI) scene.add(canopyI);
      const loungerI = instanced(new THREE.BoxGeometry(1.9, 0.65, 0.35), loungerMat, loungerXf); if (loungerI) scene.add(loungerI);

      const palmTrunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 4.6, 5); palmTrunkGeo.rotateX(Math.PI / 2); palmTrunkGeo.translate(0, 0, 2.3);
      const frondGeo = new THREE.ConeGeometry(2.3, 0.5, 5); frondGeo.rotateX(Math.PI / 2); frondGeo.translate(0, 0, 4.7);
      const palmTrunkI = instanced(palmTrunkGeo, trunkMat, palmXf); if (palmTrunkI) scene.add(palmTrunkI);
      const palmFrondI = instanced(frondGeo, palmFrondMat, palmXf.map((t) => ({ ...t, rot: 0 }))); if (palmFrondI) scene.add(palmFrondI);

      // Cars: one InstancedMesh, per-instance color
      const carXf: { x: number; y: number; z: number; rot: number; color: THREE.Color }[] = [];
      const carColors = ["#3a4150", "#565d66", "#2c3038", "#6b7280", "#8a4a42"].map((c2) => new THREE.Color(c2));
      for (const lot of det.parkings ?? []) {
        const ring = lot.ring.map(toLocal);
        const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]);
        const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
        const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
        let placed = 0;
        for (let gx = x0 + 3; gx < x1 && placed < 9; gx += 7) {
          for (let gy = y0 + 3; gy < y1 && placed < 9; gy += 5) {
            if (hash(lot.id + gx * 3 + gy) < 0.45) continue;
            if (!pointInRing([gx, gy], ring)) continue;
            carXf.push({ x: gx, y: gy, z: 0.7, rot: hash(lot.id + gy) > 0.5 ? 0 : Math.PI / 2,
              color: carColors[Math.floor(hash(gx + gy * 7) * carColors.length)] });
            placed++;
          }
        }
      }
      const carMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 });
      const carI = instanced(new THREE.BoxGeometry(4.2, 1.8, 1.4), carMat, carXf); if (carI) scene.add(carI);

      // Trees: instanced trunk + canopy (deterministic scatter in woods)
      const treeXf: { x: number; y: number; z: number; scale: number }[] =
        det.trees.map(toLocal).map(([x, y], i) => ({ x, y, z: 0, scale: 0.8 + hash(i * 31) * 0.6 }));
      for (const wood of det.woods) {
        const ring = wood.ring.map(toLocal);
        const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
        const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
        const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
        for (let x = x0; x < x1 && treeXf.length < 420; x += 9) {
          for (let y = y0; y < y1 && treeXf.length < 420; y += 9) {
            const jx = x + (hash(x * 7 + y) - 0.5) * 6, jy = y + (hash(x + y * 13) - 0.5) * 6;
            if (pointInRing([jx, jy], ring)) treeXf.push({ x: jx, y: jy, z: 0, scale: 0.8 + hash(jx * 3) * 0.6 });
          }
        }
      }
      const treeTrunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 2.2, 5); treeTrunkGeo.rotateX(Math.PI / 2); treeTrunkGeo.translate(0, 0, 1.1);
      const treeCanopyGeo = new THREE.ConeGeometry(1.9, 3.8, 6); treeCanopyGeo.rotateX(Math.PI / 2); treeCanopyGeo.translate(0, 0, 4.1);
      const treeCanopyMat = new THREE.MeshStandardMaterial({ color: P.canopy, roughness: 0.9 });
      const treeTrunkI = instanced(treeTrunkGeo, trunkMat, treeXf); if (treeTrunkI) scene.add(treeTrunkI);
      const treeCanopyI = instanced(treeCanopyGeo, treeCanopyMat, treeXf); if (treeCanopyI) scene.add(treeCanopyI);

      // 3D signage: hero + tallest named assets only (bounded canvas cost)
      const makeSign = (text: string, x: number, y: number, z: number, hero: boolean) => {
        const cv = document.createElement("canvas");
        cv.width = 512; cv.height = 96;
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        ctx.font = "600 56px Geist, Arial, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = hero ? "#bfe9f5" : "#ffe9c8";
        ctx.shadowColor = hero ? "rgba(34,211,238,.9)" : "rgba(255,217,160,.8)";
        ctx.shadowBlur = 18;
        ctx.fillText(text.toUpperCase(), 256, 48);
        const tex = new THREE.CanvasTexture(cv);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, opacity: P.winIntensity > 0 ? 0.95 : 0.85 }));
        const w = 26;
        sprite.scale.set(w, w * (96 / 512), 1);
        sprite.position.set(x, y, z + 4.5);
        scene.add(sprite);
      };
      const named = feats
        .filter((f) => f.geometry.type === "Polygon" && f.properties.name)
        .map((f) => {
          const ringL = f.geometry.coordinates[0].map(toLocal);
          const cx = ringL.reduce((s2, q) => s2 + q[0], 0) / ringL.length;
          const cy = ringL.reduce((s2, q) => s2 + q[1], 0) / ringL.length;
          const hero2 = pointInRing([0, 0], ringL);
          return { name: f.properties.name as string, cx, cy, h: heightFor(f), hero: hero2 };
        })
        .sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0) || b.h - a.h)
        .slice(0, 7);
      for (const nsg of named) makeSign(nsg.name.replace(/^hotel\s+/i, ""), nsg.cx, nsg.cy, nsg.hero ? Math.max(nsg.h, 9 * FLOOR_M) : nsg.h, nsg.hero);
      makeSign("TERRA", 0, 0, 9 * FLOOR_M + 3, true);

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(), context: gl as WebGL2RenderingContext, antialias: true,
      });
      renderer.autoClear = false;
    },
    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!renderer || !mapRef) return;
      if (mapRef.getZoom() < RESORT_MIN_ZOOM) return;
      camera.projectionMatrix = mMat.fromArray(matrix).multiply(lMat);
      renderer.resetState();
      renderer.render(scene, camera);
      // static scene: no triggerRepaint loop - the map repaints on interaction
    },
    onRemove() {
      // dispose scene resources so a layer re-create (e.g. phase change) does not leak GPU memory
      scene?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m?.dispose?.();
      });
      renderer?.dispose();
      renderer = null;
      mapRef = null;
    },
  };
}