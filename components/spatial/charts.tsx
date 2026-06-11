"use client";

/* Restrained, Apple-grade primitives. Monochrome by default — white ink on
   matte dark, color reserved for the rare semantic accent. No boxes: elements
   are separated by whitespace, not borders. */

export function Sparkline({ data, w = 120, h = 40, stroke = "rgba(255,255,255,0.45)", fill = true }: { data: number[]; w?: number; h?: number; stroke?: string; fill?: boolean }) {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const dx = w / (data.length - 1);
  const pts = data.map((v, i) => [i * dx, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  const id = "sp" + Math.round(min + max + data.length + h);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block w-full">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.16" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? <path d={area} fill={`url(#${id})`} /> : null}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function StatBlock({ label, value, unit, delta, spark }: { label: string; value: string; unit?: string; delta?: { v: string; up: boolean } | null; spark?: number[]; sparkColor?: string; valueColor?: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-white/40">{label}</span>
        {delta ? <span className="text-[11.5px] tabular-nums text-white/45">{delta.up ? "↑" : "↓"} {delta.v}</span> : null}
      </div>
      <div className="flex items-end gap-1">
        <span className="text-[31px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white">{value}</span>
        {unit ? <span className="mb-1 text-[12px] text-white/35">{unit}</span> : null}
      </div>
      {spark ? <div className="mt-1.5 h-8"><Sparkline data={spark} h={32} /></div> : null}
    </div>
  );
}

export type LadderRow = { name: string; value: number; own?: boolean };

export function RateLadder({ rows }: { rows: LadderRow[] }) {
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  const min = Math.min(...rows.map((r) => r.value));
  const lo = Math.floor(min * 0.94);
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => {
        const pct = ((r.value - lo) / (max - lo || 1)) * 100;
        return (
          <div key={r.name} className="flex items-center gap-3.5">
            <span className={`w-[44%] shrink-0 truncate text-[12.5px] ${r.own ? "font-medium text-white" : "text-white/45"}`}>{r.name}</span>
            <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[.06]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(5, pct)}%`, background: r.own ? "#ffffff" : "rgba(255,255,255,0.26)" }} />
            </div>
            <span className={`w-9 shrink-0 text-right text-[12.5px] tabular-nums ${r.own ? "font-medium text-white" : "text-white/65"}`}>{r.value}</span>
          </div>
        );
      })}
    </div>
  );
}
