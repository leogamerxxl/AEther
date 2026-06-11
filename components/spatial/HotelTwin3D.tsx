"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import { ZONE_STATE, type ZoneId } from "@/lib/ops";
import { TERRA_FLOORS, WING_X, type Wing } from "@/lib/terra-building";

// Hotel Terra REAL OSM footprint (way 234012993), converted to centered scene units.
const TERRA_FP: [number, number][] = [[-3.264, 0.948], [-3.24, 0.2], [-3.207, -0.809], [-3.197, -1.132], [3.6, -0.912], [3.561, 0.291], [2.888, 0.269], [2.859, 1.145]];
const SLAB = 0.16, GAP_OPEN = 1.9, GAP_CLOSED = 0.9;
const FP_MINX = Math.min(...TERRA_FP.map((p) => p[0])), FP_MAXX = Math.max(...TERRA_FP.map((p) => p[0]));

type ZoneDef = { id: ZoneId; label: string; wing: Wing };
type FloorDef = { level: number; zones: ZoneDef[] };
function buildFloors(): FloorDef[] {
  return TERRA_FLOORS
    .map((f) => ({ level: f.level, zones: f.zones.map((z) => ({ id: z.id, label: z.label, wing: z.wing })) }))
    .sort((a, b) => a.level - b.level);
}

const ZONE_COLOR: Partial<Record<ZoneId, string>> = {
  kitchen: "#f59e0b", bar: "#a78bfa", terrace: "#34d399", pool: "#38bdf8", lobby: "#22d3ee",
  restaurant: "#5eead4", rooms: "#93c5fd", spa: "#f0abfc", kids: "#fbbf24",
};

function useTerraShape() {
  return useMemo(() => {
    const s = new THREE.Shape();
    TERRA_FP.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
  }, []);
}

function ZoneMesh({ zone, position, size, color, selected, onSelect }: { zone: ZoneDef; position: [number, number, number]; size: [number, number, number]; color: string; selected: boolean; onSelect: (z: ZoneId) => void }) {
  const [hover, setHover] = useState(false);
  const lit = hover || selected;
  return (
    <group position={position}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(zone.id); }} onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHover(false); document.body.style.cursor = "default"; }}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={lit ? 2.2 : 0.7} transparent opacity={lit ? 0.96 : 0.72} metalness={0.3} roughness={0.4} />
      </mesh>
      {hover ? (
        <Html center distanceFactor={9} position={[0, size[1] / 2 + 0.35, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ whiteSpace: "nowrap", padding: "4px 10px", borderRadius: 9, background: "rgba(9,11,14,.92)", border: "1px solid rgba(255,255,255,.14)", color: "#fff", font: "600 11px ui-sans-serif" }}>{zone.label}</div>
        </Html>
      ) : null}
    </group>
  );
}

function Floor({ floor, maxLevel, explode, shape, selectedZone, onSelect }: { floor: FloorDef; maxLevel: number; explode: boolean; shape: THREE.Shape; selectedZone: ZoneId | null; onSelect: (z: ZoneId) => void }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const gap = explode ? GAP_OPEN : GAP_CLOSED;
    const target = floor.level * gap - (maxLevel * gap) / 2;
    ref.current.position.y += (target - ref.current.position.y) * 0.09;
  });
  // Place each zone in its real wing (west/center/east); zones sharing a wing
  // are spread front-to-back across the building depth.
  const placed = useMemo(() => {
    const byWing = new Map<Wing, ZoneDef[]>();
    for (const z of floor.zones) { const a = byWing.get(z.wing) ?? []; a.push(z); byWing.set(z.wing, a); }
    const usable = (FP_MAXX - FP_MINX) - 1.2;
    const zDepth = 1.9;
    const out: { z: ZoneDef; pos: [number, number, number]; size: [number, number, number]; color: string }[] = [];
    for (const [wing, zs] of byWing) {
      const gn = zs.length;
      zs.forEach((z, gi) => {
        const x = FP_MINX + 0.6 + WING_X[wing] * usable;
        const zz = gn > 1 ? -zDepth / 2 + (gi + 0.5) * (zDepth / gn) : 0;
        const h = 0.3 + (ZONE_STATE[z.id].occupancy / 100) * 0.6;
        const d = gn > 1 ? (zDepth / gn) - 0.22 : 1.4;
        out.push({ z, pos: [x, SLAB + h / 2, zz], size: [1.25, h, d], color: ZONE_COLOR[z.id] ?? "#22d3ee" });
      });
    }
    return out;
  }, [floor]);
  return (
    <group ref={ref}>
      {/* glass floor plate in Terra real footprint */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <extrudeGeometry args={[shape, { depth: SLAB, bevelEnabled: false }]} />
        <meshPhysicalMaterial color="#bfe9ff" transparent opacity={0.08} transmission={0.5} thickness={0.4} roughness={0.25} metalness={0} side={THREE.DoubleSide} />
        <Edges threshold={12} color="#39c7e8" />
      </mesh>
      {placed.map(({ z, pos, size, color }) => (
        <ZoneMesh key={z.id} zone={z} position={pos} size={size} color={color} selected={selectedZone === z.id} onSelect={onSelect} />
      ))}
    </group>
  );
}

function Scene({ explode, selectedZone, onSelect }: { explode: boolean; selectedZone: ZoneId | null; onSelect: (z: ZoneId) => void }) {
  const floors = useMemo(() => buildFloors(), []);
  const maxLevel = floors.reduce((m, f) => Math.max(m, f.level), 0);
  const shape = useTerraShape();
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (groupRef.current) groupRef.current.rotation.y += dt * 0.1; });
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 10, 6]} intensity={1.2} color="#bfe4ff" />
      <pointLight position={[-6, 4, -4]} intensity={45} color="#22d3ee" distance={22} />
      <pointLight position={[5, -2, 5]} intensity={24} color="#3b82f6" distance={20} />
      <group ref={groupRef}>
        {floors.map((f) => (
          <Floor key={f.level} floor={f} maxLevel={maxLevel} explode={explode} shape={shape} selectedZone={selectedZone} onSelect={onSelect} />
        ))}
        <mesh position={[0, -(maxLevel * (explode ? GAP_OPEN : GAP_CLOSED)) / 2 - 0.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[16, 12]} />
          <meshStandardMaterial color="#0a0e14" metalness={0.4} roughness={0.6} transparent opacity={0.55} />
        </mesh>
      </group>
      <OrbitControls enablePan={false} enableZoom minDistance={6} maxDistance={20} maxPolarAngle={Math.PI / 2.05} target={[0, 0, 0]} />
    </>
  );
}

export default function HotelTwin3D({ explode, selectedZone, onSelect }: { explode: boolean; selectedZone: ZoneId | null; onSelect: (z: ZoneId) => void }) {
  return (
    <Canvas camera={{ position: [8.5, 6, 9.5], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
      <Scene explode={explode} selectedZone={selectedZone} onSelect={onSelect} />
    </Canvas>
  );
}
