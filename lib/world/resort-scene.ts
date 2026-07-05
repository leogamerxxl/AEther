// Resort scene v2 - the property/twin band world treatment: REAL Neptun
// footprints rebuilt as a crafted 3D scene in a Mapbox custom layer (three.js
// sharing the map GL context). v2 adds:
//   - daylight phases (lib/world/daylight.ts): cream massing at noon, sunset
//     ambient at dusk, lit windows at night - one clock for the whole world
//   - 2.5D facades: hotels are stacked floor slabs with beveled cornices
//     (bas-relief massing, not flat extrusions)
//   - micro-details from OSM (lib/world/patch-details.json): pools with a dark
//     basin under a water surface, instanced trees, wood clusters
// Materials remain the doctrine: lighting + shader windows, no textures.

import * as THREE from "three";
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

// Degenerate rings (consecutive duplicates after rounding, unclosed slivers)
// hang THREE.ShapeUtils triangulation - sanitize EVERY ring before Shape.
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

// Shader-computed window grid (no UVs) - walls only, per-floor bands
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
        const mat = new THREE.MeshStandardMaterial({
          color: isHero ? P.bodyHero : P.body,
          roughness: 0.88, metalness: 0.1,
        });
        if (isHotel && P.winIntensity > 0) {
          windowize(mat, isHero ? P.windowCool : P.windowWarm,
            isHero ? P.winIntensity * 1.6 : P.winIntensity * 0.9,
            isHero ? Math.min(0.6, P.winLit * 1.6) : P.winLit);
        }
        if (isHotel) {
          // 2.5D facade: stacked floor slabs - beveled cornices read as relief
          const floors = Math.max(2, Math.round(h / FLOOR_M));
          const slab = new THREE.ExtrudeGeometry(shape, {
            depth: FLOOR_M * 0.9, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.26, bevelSegments: 1,
          });
          for (let i = 0; i < floors; i++) {
            const m = new THREE.Mesh(slab, mat);
            m.position.z = i * FLOOR_M;
            scene.add(m);
          }
          if (isHero) {
            const outline = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
            const rim = new THREE.LineSegments(
              new THREE.EdgesGeometry(outline, 32),
              new THREE.LineBasicMaterial({ color: C.live, transparent: true, opacity: phase === "day" ? 0.5 : 0.75 }));
            scene.add(rim);
          }
        } else {
          const geo = new THREE.ExtrudeGeometry(shape, {
            depth: h, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.7, bevelSegments: 2,
          });
          scene.add(new THREE.Mesh(geo, mat));
        }
      }

      // ── Micro-details: pools (dark basin + water plate), trees, woods ──
      const det = details as unknown as Details;
      const basinMat = new THREE.MeshStandardMaterial({ color: "#0a1418", roughness: 0.9 });
      const waterMat = new THREE.MeshStandardMaterial({
        color: P.water, roughness: 0.12, metalness: 0.08,
        emissive: P.water, emissiveIntensity: P.waterEmissive,
        transparent: true, opacity: 0.94,
      });
      const trunkLikeMat = new THREE.MeshStandardMaterial({ color: P.trunk, roughness: 0.9 });
      const umbrellaMat = new THREE.MeshStandardMaterial({ color: "#d8cfc0", roughness: 0.75, side: THREE.DoubleSide });
      const loungerMat = new THREE.MeshStandardMaterial({ color: "#c8bfae", roughness: 0.7 });
      const loungerGeo = new THREE.BoxGeometry(1.9, 0.65, 0.35);
      const rimMat = new THREE.MeshStandardMaterial({ color: P.body, roughness: 0.8 });
      for (const pool of det.pools) {
        const ring = pool.ring.map(toLocal);
        const shape = toShape(ring);
        if (!shape) continue;
        // PIT: thin deck rim at grade, dark basin walls going DOWN, water sunk -0.5m
        const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false }), rimMat);
        scene.add(rim);
        const basin = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false }), basinMat);
        basin.position.z = -1.6;
        scene.add(basin);
        const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), waterMat);
        water.position.z = -0.5;
        scene.add(water);
        // resort furniture around the pool: umbrellas + sun loungers, deterministic
        const cx = ring.reduce((s2, q) => s2 + q[0], 0) / ring.length;
        const cy = ring.reduce((s2, q) => s2 + q[1], 0) / ring.length;
        const n = 5 + Math.round(hash(pool.id) * 3);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + hash(pool.id + i) * 0.5;
          const rr = 7 + hash(pool.id * 3 + i) * 4;
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (pointInRing([px, py], ring)) continue; // never in the water
          // umbrella: pole + cone canopy
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.1, 5), trunkLikeMat);
          pole.rotateX(Math.PI / 2); pole.position.set(px, py, 1.05);
          scene.add(pole);
          const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.7, 8), umbrellaMat);
          canopy.rotateX(Math.PI / 2); canopy.position.set(px, py, 2.25);
          scene.add(canopy);
          // two loungers beside it
          for (const k of [-1, 1]) {
            const lounger = new THREE.Mesh(loungerGeo, loungerMat);
            lounger.position.set(px + k * 1.1 * Math.cos(a + Math.PI / 2), py + k * 1.1 * Math.sin(a + Math.PI / 2), 0.22);
            lounger.rotation.z = a;
            scene.add(lounger);
          }
        }
      }

      // static cars in real parking lots (varied dark paint, deterministic)
      const carGeo = new THREE.BoxGeometry(4.2, 1.8, 1.4);
      const carPaints = ["#3a4150", "#565d66", "#2c3038", "#6b7280", "#8a4a42"].map(
        (c2) => new THREE.MeshStandardMaterial({ color: c2, roughness: 0.35, metalness: 0.5 }));
      for (const lot of det.parkings ?? []) {
        const ring = lot.ring.map(toLocal);
        const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]);
        const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
        const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
        let placed = 0;
        for (let gx = x0 + 3; gx < x1 && placed < 9; gx += 7) {
          for (let gy = y0 + 3; gy < y1 && placed < 9; gy += 5) {
            if (hash(lot.id + gx * 3 + gy) < 0.45) continue; // half-empty lots
            if (!pointInRing([gx, gy], ring)) continue;
            const car = new THREE.Mesh(carGeo, carPaints[Math.floor(hash(gx + gy * 7) * carPaints.length)]);
            car.position.set(gx, gy, 0.7);
            car.rotation.z = hash(lot.id + gy) > 0.5 ? 0 : Math.PI / 2;
            scene.add(car);
            placed++;
          }
        }
      }

      // 3D signage: named assets carry their brand as a glowing rooftop sign
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
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex, transparent: true, depthTest: true,
          opacity: P.winIntensity > 0 ? 0.95 : 0.85,
        }));
        const w = 26;
        sprite.scale.set(w, w * (96 / 512), 1);
        sprite.position.set(x, y, z + 4.5);
        scene.add(sprite);
      };
      for (const f of feats) {
        if (f.geometry.type !== "Polygon") continue;
        const nm = f.properties.name;
        if (!nm) continue;
        const ringL = f.geometry.coordinates[0].map(toLocal);
        const cx = ringL.reduce((s2, q) => s2 + q[0], 0) / ringL.length;
        const cy = ringL.reduce((s2, q) => s2 + q[1], 0) / ringL.length;
        const hero2 = pointInRing([0, 0], ringL);
        makeSign(nm.replace(/^hotel\s+/i, ""), cx, cy, hero2 ? Math.max(heightFor(f), 9 * FLOOR_M) : heightFor(f), hero2);
      }
      makeSign("TERRA", 0, 0, 9 * FLOOR_M + 3, true);

      // trees: two instanced meshes (trunks + canopies), deterministic scatter in woods
      const pts: [number, number][] = det.trees.map(toLocal);
      for (const wood of det.woods) {
        const ring = wood.ring.map(toLocal);
        const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
        const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
        const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
        for (let x = x0; x < x1; x += 9) {
          for (let y = y0; y < y1; y += 9) {
            const jx = x + (hash(x * 7 + y) - 0.5) * 6, jy = y + (hash(x + y * 13) - 0.5) * 6;
            if (pointInRing([jx, jy], ring)) pts.push([jx, jy]);
            if (pts.length > 420) break;
          }
          if (pts.length > 420) break;
        }
      }
      // palms ring the pools (coastal read), conifer cones stay in the woods
      const palmTrunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 4.6, 5);
      palmTrunkGeo.rotateX(Math.PI / 2); palmTrunkGeo.translate(0, 0, 2.3);
      const frondGeo = new THREE.ConeGeometry(2.3, 0.5, 5);
      frondGeo.rotateX(Math.PI / 2); frondGeo.translate(0, 0, 4.7);
      const palmMat = new THREE.MeshStandardMaterial({ color: P.canopy, roughness: 0.85, side: THREE.DoubleSide });
      for (const pool of det.pools) {
        const ring = pool.ring.map(toLocal);
        const cx = ring.reduce((s2, q) => s2 + q[0], 0) / ring.length;
        const cy = ring.reduce((s2, q) => s2 + q[1], 0) / ring.length;
        const n = 4 + Math.round(hash(pool.id * 7) * 3);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + hash(pool.id + i * 3) * 0.8;
          const rr = 11 + hash(pool.id + i) * 5;
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (pointInRing([px, py], ring)) continue;
          const tr = new THREE.Mesh(palmTrunkGeo, trunkLikeMat);
          tr.position.set(px, py, 0);
          tr.rotation.x = (hash(px) - 0.5) * 0.12;
          scene.add(tr);
          const fr = new THREE.Mesh(frondGeo, palmMat);
          fr.position.set(px, py, 0);
          scene.add(fr);
        }
      }

      if (pts.length > 0) {
        const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 2.2, 5);
        trunkGeo.rotateX(Math.PI / 2); trunkGeo.translate(0, 0, 1.1);
        const canopyGeo = new THREE.ConeGeometry(1.9, 3.8, 6);
        canopyGeo.rotateX(Math.PI / 2); canopyGeo.translate(0, 0, 2.2 + 1.9);
        const trunkMat = new THREE.MeshStandardMaterial({ color: P.trunk, roughness: 0.95 });
        const canopyMat = new THREE.MeshStandardMaterial({ color: P.canopy, roughness: 0.9 });
        const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pts.length);
        const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, pts.length);
        const m4 = new THREE.Matrix4();
        pts.forEach(([x, y], i) => {
          const sc = 0.8 + hash(i * 31) * 0.6;
          m4.makeScale(sc, sc, sc).setPosition(x, y, 0);
          trunks.setMatrixAt(i, m4);
          canopies.setMatrixAt(i, m4);
        });
        scene.add(trunks); scene.add(canopies);
      }

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(), context: gl as WebGL2RenderingContext, antialias: true,
      });
      renderer.autoClear = false;
    },
    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!renderer || !mapRef) return;
      if (mapRef.getZoom() < RESORT_MIN_ZOOM) return;
      const m = new THREE.Matrix4().fromArray(matrix);
      const l = new THREE.Matrix4()
        .makeTranslation(mc.x, mc.y, mc.z ?? 0)
        .scale(new THREE.Vector3(s, -s, s));
      camera.projectionMatrix = m.multiply(l);
      renderer.resetState();
      renderer.render(scene, camera);
      // static scene: no triggerRepaint loop - the map repaints on interaction
    },
    onRemove() {
      renderer?.dispose();
      renderer = null;
      mapRef = null;
    },
  };
}