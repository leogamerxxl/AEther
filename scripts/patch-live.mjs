import fs from "fs";
const swap = (p, pairs) => {
  let s = fs.readFileSync(p, "utf8");
  for (const [a, b] of pairs) { if (s.includes(a)) s = s.split(a).join(b); else console.log("MISS in", p, ":", a.slice(0, 50)); }
  fs.writeFileSync(p, s);
};

swap("C:/Users/user/aether/components/spatial/CoastalCommandCenter.tsx", [
  [`import AssetIntelligenceSheet from "./AssetIntelligenceSheet";`,
   `import AssetIntelligenceSheet from "./AssetIntelligenceSheet";\nimport { supabase } from "@/lib/supabase";`],
  [`  const [tokenMissing, setTokenMissing] = useState(false);`,
   `  const [tokenMissing, setTokenMissing] = useState(false);\n  const [live, setLive] = useState<Record<string, { narrative: string; delta: number; alert: string }>>({});`],
  [`  const onAction = (id: string, payload: unknown) => { console.log("[OODA] execute", id, payload); };`,
   `  useEffect(() => {\n    let mounted = true;\n    supabase.from("property_live_telemetry").select("property_ref,narrative,recommended_delta_ron,maritime_alert").then(({ data }) => {\n      if (mounted && data) setLive(Object.fromEntries((data as { property_ref: string; narrative: string; recommended_delta_ron: number; maritime_alert: string }[]).map((d) => [d.property_ref, { narrative: d.narrative, delta: d.recommended_delta_ron, alert: d.maritime_alert }])));\n    });\n    const chan = supabase.channel("ooda-telemetry").on("postgres_changes", { event: "*", schema: "public", table: "property_live_telemetry" }, (payload) => {\n      const r = payload.new as { property_ref?: string; narrative?: string; recommended_delta_ron?: number; maritime_alert?: string };\n      if (r && r.property_ref) setLive((prev) => ({ ...prev, [r.property_ref as string]: { narrative: r.narrative ?? "", delta: r.recommended_delta_ron ?? 0, alert: r.maritime_alert ?? "clear" } }));\n    }).subscribe();\n    return () => { mounted = false; supabase.removeChannel(chan); };\n  }, []);\n\n  const onAction = (id: string, payload: unknown) => { console.log("[OODA] execute", id, payload); };`],
  [`<AssetIntelligenceSheet node={active} onClose={() => setActive(null)} onAction={onAction} />`,
   `<AssetIntelligenceSheet node={active} live={active ? live[active.id] ?? null : null} onClose={() => setActive(null)} onAction={onAction} />`],
]);

swap("C:/Users/user/aether/components/spatial/AssetIntelligenceSheet.tsx", [
  [`export default function AssetIntelligenceSheet({ node, onClose, onAction }: { node: PropertyIntelligenceNode | null; onClose: () => void; onAction?: (id: string, payload: unknown) => void }) {`,
   `export default function AssetIntelligenceSheet({ node, onClose, onAction, live }: { node: PropertyIntelligenceNode | null; onClose: () => void; onAction?: (id: string, payload: unknown) => void; live?: { narrative: string; delta: number; alert: string } | null }) {`],
  [`<OODAEngine insight={node.insight} onAction={onAction} />`,
   `<OODAEngine insight={live ? { ...node.insight, observedContext: live.narrative, computedImpactDeltaRon: live.delta } : node.insight} live={!!live} onAction={onAction} />`],
]);

swap("C:/Users/user/aether/components/spatial/widgets.tsx", [
  [`export function OODAEngine({ insight, onAction }: { insight: TacticalOODAInsight; onAction?: (id: string, payload: unknown) => void }) {`,
   `export function OODAEngine({ insight, onAction, live }: { insight: TacticalOODAInsight; onAction?: (id: string, payload: unknown) => void; live?: boolean }) {`],
  [`<span className="ml-auto font-mono text-[10px] text-slate-500">conf {Math.round(insight.confidenceScore * 100)}%</span>`,
   `{live ? <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-cyan-400"><span className="size-1.5 animate-pulse rounded-full bg-cyan-400" />LIVE</span> : <span className="ml-auto font-mono text-[10px] text-slate-500">conf {Math.round(insight.confidenceScore * 100)}%</span>}`],
]);
console.log("patched live wiring");
