// Resort scene - the property/twin band world treatment: the REAL Neptun
// footprints (OSM, lib/world/neptun-osm.json) rebuilt as a crafted 3D scene in
// a Mapbox custom layer (three.js sharing the map GL context). The UXP look is
// materials + lighting, not textures: dark matte beveled massing, shader-
// computed emissive window grids (no UVs), the pilot hotel hero-lit cyan.
//
// WORLD MATERIAL PALETTE - scene asset colors (like map-style colors, these are
// world pigment, not UI chrome; UI accents still come from command-theme).
import * as THREE from "three";
import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import { C } from "@/lib/command-theme";
import osm from "@/lib/world/neptun-osm.json";

const WORLD = {
  body: "#141821",       // dark matte massing
  bodyHero: "#1a2130",   // the pilot hotel reads one step lighter
  roofEdge: C.live,      // hero rim - live accent (semantic: the instrumented asset)
  windowWarm: "#ffd9a0", // occupied-window glow (warm, dim)
  windowCool: "#bfe9f5", // sparse cool windows
} as const;

const ANCHOR: [number, number] = [28.59612, 43.86944]; // Hotel Terra Neptun (corridor.ts OWN)
const FLOOR_M = 3.1;

interface Feat {
  id: number;
  properties: { name: string | null; levels: string | null; height: string | null; building: string | null };
  geometry: { type: string; coordinates: number[][][] };
}

// deterministic per-building variation (no Math.random - stable world)
function hash(n: number): number { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

function heightFor(f: Feat): number {
  const h = f.properties.height ? parseFloat(f.properties.height) : NaN;
  if (!Number.isNaN(h) && h > 2) return h;
  const lv = f.properties.levels ? parseInt(f.properties.levels, 10) : NaN;
  if (!Number.isNaN(lv) && lv > 0) return lv * FLOOR_M + 1.5;
  const name = (f.properties.name ?? "").toLowerCase();
  const kind = (f.properties.building ?? "").toLowerCase();
  if (name.includes("hotel") || kind === "hotel") return (7 + Math.round(hash(f.id) * 4)) * FLOOR_M; // 7-11 floors
  if (name.includes("biseric")) return 11;
  if (name.includes("teatr")) return 9;
  if (kind === "apartments") return 5 * FLOOR_M;
  return (2 + Math.round(hash(f.id) * 2)) * FLOOR_M; // vile: 2-4 floors
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

// Shader-computed window grid: emissive bands per floor, windows hashed on/off,
// walls only (normal.z ~ 0). Injected into MeshStandardMaterial - no UVs needed.
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

export function createResortLayer(): CustomLayerInterface {
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

      // lighting - cool key from the sea (NE), faint warm fill, low ambient
      scene.add(new THREE.AmbientLight(0x8899bb, 0.55));
      const key = new THREE.DirectionalLight(0xcfe4ff, 1.35);
      key.position.set(400, 300, 600);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffe3b8, 0.28);
      fill.position.set(-300, -200, 250);
      scene.add(fill);

      const feats = (osm as { features: Feat[] }).features;
      for (const f of feats) {
        if (f.geometry.type !== "Polygon") continue;
        const ringLocal = f.geometry.coordinates[0].map(toLocal);
        const isHero = pointInRing([0, 0], ringLocal);
        const shape = new THREE.Shape(ringLocal.map(([x, y]) => new THREE.Vector2(x, y)));
        const h = isHero ? Math.max(heightFor(f), 9 * FLOOR_M) : heightFor(f);
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: h, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.7, bevelSegments: 2,
        });
        const name = (f.properties.name ?? "").toLowerCase();
        const isHotel = isHero || name.includes("hotel") || (f.properties.building ?? "") === "hotel";
        const mat = new THREE.MeshStandardMaterial({
          color: isHero ? WORLD.bodyHero : WORLD.body,
          roughness: 0.88, metalness: 0.12,
        });
        if (isHotel) {
          windowize(mat, isHero ? WORLD.windowCool : WORLD.windowWarm,
            isHero ? 1.6 : 0.9, isHero ? 0.55 : 0.34);
        }
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);
        if (isHero) {
          // hero rim: the instrumented asset carries the live accent
          const edges = new THREE.EdgesGeometry(geo, 32);
          const rim = new THREE.LineSegments(edges,
            new THREE.LineBasicMaterial({ color: WORLD.roofEdge, transparent: true, opacity: 0.75 }));
          scene.add(rim);
        }
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
      mapRef.triggerRepaint();
    },
    onRemove() {
      renderer?.dispose();
      renderer = null;
      mapRef = null;
    },
  };
}