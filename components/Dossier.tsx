"use client";

// Aether - Property Dossier (Vercel-OLED, god-tier rebuild). Spacious, grouped,
// readable. REAL: rate / availability / vs-market / range / 14-day trajectory.
// SAMPLE (badged): occupancy, demographics, segments, social, reviews, playbook.

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  X, Star, TrendingUp, TrendingDown, Check, Users, MessageSquare,
  Share2, Activity, ListChecks, Sparkles, ArrowUpRight,
} from "lucide-react";
import { MARKET_AVG, TRAJECTORY, type Point } from "@/lib/corridor";

const HOTEL_IMG = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=520&h=280&fit=crop";
const C = { hi: "#EDEDED", mid: "#A1A1A1", lo: "#6B6B6B", accent: "#22D3EE", pos: "#4ADE80", neg: "#F87171", slate: "#6B8FB8" };

function rng(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const WELL = ["Same-day rate parity across all OTAs", "Replies to every review within 24h", "4+ reels/week drives direct bookings", "Spa + dinner bundles lift ADR", "Pro photography on every room type"];
const WRONG = ["No weekday demand pricing", "Thin EN/DE content for foreign guests", "Slow check-in flagged in reviews", "No booking-pace signal on shoulder weeks", "Weak TikTok presence for under-35s"];

export function buildSample(p: Point) {
  const r = rng(p.id + p.name);
  const ri = (a: number, b: number) => Math.round(a + (b - a) * r());
  const pick = <T,>(arr: T[], n: number) => [...arr].sort(() => r() - 0.5).slice(0, n);
  const occupancy = Array.from({ length: 12 }, () => ri(54, 93));
  const age: [string, number][] = [["25-34", ri(24, 38)], ["35-44", ri(22, 34)], ["45-54", ri(14, 24)], ["55+", ri(8, 18)]];
  const origin: [string, number][] = [["Romania", ri(34, 54)], ["Germany", ri(10, 22)], ["Poland", ri(6, 16)], ["Other", ri(10, 24)]];
  const segment: [string, number][] = [["Couples", ri(60, 86)], ["Families", ri(44, 76)], ["Business", ri(28, 60)], ["Solo", ri(22, 54)]];
  const social = Array.from({ length: 8 }, () => ri(20, 96));
  const bookingsIdx = social.map((s) => Math.round(s * 0.55 + ri(8, 28)));
  const rating = Math.round((3.7 + r() * 1.2) * 10) / 10;
  const reviewCount = ri(180, 2400);
  const sentiment: [string, number][] = [["Service", ri(70, 95)], ["Cleanliness", ri(70, 96)], ["Location", ri(76, 98)], ["Value", ri(54, 86)]];
  return { occupancy, age, origin, segment, social, bookingsIdx, rating, reviewCount, sentiment, well: pick(WELL, 3), wrong: pick(WRONG, 3) };
}

function Area({ data, color = C.accent }: { data: number[]; color?: string }) {
  const w = 380, h = 60, pad = 4;
  const min = Math.min(...data), mx = Math.max(...data);
  const X = (i: number) => pad + (i * (w - 2 * pad)) / (data.length - 1);
  const Y = (v: number) => h - pad - ((v - min) / (mx - min || 1)) * (h - 2 * pad);
  const d = data.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const id = "a" + Math.round(min);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[60px] w-full">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.16" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <line x1={pad} x2={w - pad} y1={h / 2} y2={h / 2} stroke="rgba(255,255,255,.05)" strokeWidth={0.5} />
      <path d={`${d} L${X(data.length - 1)} ${h - pad} L${pad} ${h - pad} Z`} fill={`url(#${id})`} />
      <path className="draw" pathLength={1} d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

function DualLine({ a, b }: { a: number[]; b: number[] }) {
  const w = 380, h = 60, pad = 4; const all = [...a, ...b];
  const min = Math.min(...all), mx = Math.max(...all);
  const X = (i: number) => pad + (i * (w - 2 * pad)) / (a.length - 1);
  const Y = (v: number) => h - pad - ((v - min) / (mx - min || 1)) * (h - 2 * pad);
  const path = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[60px] w-full">
      <path className="draw" pathLength={1} d={path(a)} fill="none" stroke={C.slate} strokeWidth={1.3} strokeDasharray="4 3" />
      <path className="draw" pathLength={1} d={path(b)} fill="none" stroke={C.accent} strokeWidth={1.6} />
    </svg>
  );
}

function Donut({ segments }: { segments: [string, number, string][] }) {
  const total = segments.reduce((s, x) => s + x[1], 0) || 1;
  const R = 28, CC = 2 * Math.PI * R; let acc = 0;
  return (
    <svg viewBox="0 0 72 72" className="size-[72px] shrink-0">
      {segments.map(([label, v, color]) => { const frac = v / total, dash = frac * CC, off = acc * CC; acc += frac; return <circle key={label} cx={36} cy={36} r={R} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${dash} ${CC - dash}`} strokeDashoffset={-off} transform="rotate(-90 36 36)" />; })}
    </svg>
  );
}

function HBars({ items, mounted }: { items: [string, number][]; mounted: boolean }) {
  const max = Math.max(...items.map((i) => i[1]), 1);
  return (
    <div className="space-y-2.5">
      {items.map(([label, v], i) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-[12px] text-[#A1A1A1]">{label}</span>
          <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-white/[.06]">
            <span className="block h-full rounded-full bg-[#22D3EE] transition-[width] duration-700 ease-out" style={{ width: mounted ? `${(v / max) * 100}%` : "0%", transitionDelay: `${i * 60}ms` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-[#EDEDED]">{v}%</span>
        </div>
      ))}
    </div>
  );
}

function Badge({ src }: { src: string }) {
  return <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#6B6B6B]">Sample - {src}</span>;
}

function Section({ icon: Icon, title, badge, children }: { icon: ComponentType<{ className?: string }>; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-[#A1A1A1]" />
        <h3 className="text-[13px] font-medium tracking-tight text-[#EDEDED]">{title}</h3>
        {badge && <span className="ml-auto"><Badge src={badge} /></span>}
      </div>
      {children}
    </section>
  );
}

const ACTIONS: [string, string][] = [
  ["Raise rate 6-8 Jun", "575 to 605 RON - demand over set"],
  ["Rain Thu-Fri forecast", "Email -10% + partner spa to soft bookings"],
  ["Open weekend inventory", "+4 rooms - pace ahead of last year"],
];

export default function Dossier({ point, open, onClose }: { point: Point | null; open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const data = useMemo(() => (point ? buildSample(point) : null), [point]);
  useEffect(() => {
    if (!open) { setMounted(false); return; }
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, [open, point?.id]);

  if (!open || !point || !data) return null;
  const gap = point.rate == null ? null : point.rate - MARKET_AVG;
  const ageSeg: [string, number, string][] = data.age.map((a, i): [string, number, string] => [a[0], a[1], [C.accent, C.slate, C.mid, C.lo][i]]);
  const originSeg: [string, number, string][] = data.origin.map((a, i): [string, number, string] => [a[0], a[1], [C.accent, C.slate, C.mid, C.lo][i]]);

  const kpis: [string, string, string][] = [
    ["Rate", point.rate != null ? `${point.rate}` : "-", C.hi],
    ["Avail", `${point.avail}%`, C.hi],
    ["vs Mkt", gap == null ? "-" : `${gap >= 0 ? "+" : ""}${gap}`, gap == null ? C.mid : gap >= 0 ? C.pos : C.neg],
    ["Range", point.minRate && point.maxRate ? `${point.minRate}-${point.maxRate}` : "-", C.hi],
  ];

  return (
    <div className="absolute inset-0 z-40 flex justify-end">
      <div className="scrim-in absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="dossier-in relative h-full w-[460px] max-w-[94%] overflow-y-auto border-l border-white/10 bg-[#0A0A0A]">
        <div className="relative h-40 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HOTEL_IMG} alt={point.name} className="h-full w-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid size-8 cursor-pointer place-items-center rounded-lg border border-white/10 bg-black/50 text-[#EDEDED] outline-none transition-colors hover:bg-black/70 focus-visible:ring-1 focus-visible:ring-white/40"><X className="size-4" /></button>
          <div className="absolute bottom-4 left-5 right-5">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: point.stars }).map((_, s) => <Star key={s} className="size-3 fill-[#22D3EE] text-[#22D3EE]" />)}
              <span className="ml-1 text-[11px] uppercase tracking-wider text-[#A1A1A1]">{point.city}{point.distanceKm != null ? ` - ${point.distanceKm} km` : " - your property"}</span>
            </div>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-[#EDEDED]">{point.own ? "Hotel Terra Neptun" : point.name}</h2>
          </div>
        </div>

        <div className="grid grid-cols-4 divide-x divide-white/[.08] border-b border-white/[.08]">
          {kpis.map(([k, v, col]) => (
            <div key={k} className="px-3 py-3.5">
              <div className="text-[10px] uppercase tracking-wider text-[#6B6B6B]">{k}</div>
              <div className="mt-1 text-[17px] font-semibold tabular-nums" style={{ color: col }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="space-y-7 p-5">
          <Section icon={Activity} title="Performance">
            <div className="enter" style={{ animationDelay: "40ms" }}>
              <div className="mb-1.5 flex items-baseline justify-between"><span className="text-[12px] text-[#A1A1A1]">Corridor rate</span><span className="text-[11px] tabular-nums text-[#6B6B6B]">598-625 RON - 14d - real</span></div>
              <Area data={TRAJECTORY} />
            </div>
            <div className="enter mt-4" style={{ animationDelay: "90ms" }}>
              <div className="mb-1.5 flex items-center justify-between"><span className="text-[12px] text-[#A1A1A1]">Occupancy - 12 mo</span><Badge src="Booking.com" /></div>
              <Area data={data.occupancy} color={C.slate} />
            </div>
          </Section>

          <Section icon={Users} title="Audience" badge="Google / OTA">
            <div className="grid grid-cols-2 gap-4">
              {([["Age", data.age, ageSeg], ["Origin", data.origin, originSeg]] as [string, [string, number][], [string, number, string][]][]).map(([label, legend, seg]) => (
                <div key={label} className="flex items-center gap-3">
                  <Donut segments={seg} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-[#6B6B6B]">{label}</div>
                    {legend.map(([l, v], i) => (
                      <div key={l} className="flex items-center gap-1.5 text-[11px]"><span className="size-2 shrink-0 rounded-sm" style={{ background: [C.accent, C.slate, C.mid, C.lo][i] }} /><span className="truncate text-[#A1A1A1]">{l}</span><span className="ml-auto tabular-nums text-[#EDEDED]">{v}%</span></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              <div className="text-[12px] text-[#A1A1A1]">Booking rate by segment</div>
              <HBars items={data.segment} mounted={mounted} />
            </div>
          </Section>

          <Section icon={MessageSquare} title="Reputation" badge="Google / TripAdvisor">
            <div className="flex items-center gap-4">
              <div className="text-[30px] font-semibold leading-none tabular-nums text-[#22D3EE]">{data.rating.toFixed(1)}</div>
              <div>
                <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, s) => <Star key={s} className={`size-3.5 ${s < Math.round(data.rating) ? "fill-[#22D3EE] text-[#22D3EE]" : "text-[#3A3A3A]"}`} />)}</div>
                <div className="mt-1 text-[11px] tabular-nums text-[#6B6B6B]">{data.reviewCount.toLocaleString()} reviews</div>
              </div>
            </div>
            <div className="mt-4"><HBars items={data.sentiment} mounted={mounted} /></div>
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[12px] text-[#A1A1A1]"><Share2 className="size-3.5" />Social to bookings</span><Badge src="Instagram / TikTok" /></div>
              <DualLine a={data.social} b={data.bookingsIdx} />
              <div className="flex items-center gap-4 text-[10px] text-[#6B6B6B]"><span className="flex items-center gap-1.5"><span className="inline-block h-px w-3" style={{ background: C.slate }} />Post engagement</span><span className="flex items-center gap-1.5"><span className="inline-block h-px w-3 bg-[#22D3EE]" />Bookings index</span></div>
            </div>
          </Section>

          <Section icon={ListChecks} title="Playbook">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-[#4ADE80]">Adopt</div>
              {data.well.map((w) => <div key={w} className="flex items-start gap-2.5 rounded-lg border border-white/[.07] bg-[#0E0E0E] px-3 py-2.5 text-[12px] leading-snug text-[#D4D4D4]"><Check className="mt-0.5 size-3.5 shrink-0 text-[#4ADE80]" />{w}</div>)}
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-[#F87171]">Avoid</div>
              {data.wrong.map((w) => <div key={w} className="flex items-start gap-2.5 rounded-lg border border-white/[.07] bg-[#0E0E0E] px-3 py-2.5 text-[12px] leading-snug text-[#D4D4D4]"><span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-[#F87171]" />{w}</div>)}
            </div>
          </Section>

          <Section icon={Sparkles} title="Recommended actions">
            <div className="space-y-2">
              {ACTIONS.map(([title, sub]) => (
                <button key={title} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#0E0E0E] px-3.5 py-3 text-left outline-none transition-colors hover:border-[#22D3EE]/40 hover:bg-[#121212] focus-visible:ring-1 focus-visible:ring-white/30">
                  <span className="min-w-0"><span className="block text-[12px] font-medium text-[#EDEDED]">{title}</span><span className="block text-[11px] text-[#8F8F8F]">{sub}</span></span>
                  <ArrowUpRight className="size-4 shrink-0 text-[#22D3EE]" />
                </button>
              ))}
            </div>
          </Section>

          <p className="flex items-start gap-2 border-t border-white/[.08] pt-4 text-[11px] leading-relaxed text-[#6B6B6B]">
            <Sparkles className="mt-0.5 size-3 shrink-0 text-[#22D3EE]" />
            Real: rate, availability, range, corridor trajectory. Sample sections fill live once Booking.com / Google / Apify keys connect - layout is final.
          </p>
        </div>
      </aside>
    </div>
  );
}
