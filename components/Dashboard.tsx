"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ALL_POINTS,
  COMPETITORS_WITH_DIST,
  OWN,
  MARKET_AVG,
  METRICS,
  type Point,
} from "@/lib/corridor";

const CorridorMap = dynamic(() => import("./CorridorMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading corridor…</div>,
});

const SEGMENTS = ["Today", "Rates", "Comp Set", "Actions"];

function Arrow() {
  return (
    <svg className="ico" viewBox="0 0 24 24">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Dashboard() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [seg, setSeg] = useState("Today");
  const [selected, setSelected] = useState<Point | null>(null);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }

  const ladder = useMemo(() => {
    const rated = ALL_POINTS.filter((p) => p.rate != null);
    const max = Math.max(...rated.map((p) => p.rate as number));
    return [...rated]
      .sort((a, b) => (b.rate as number) - (a.rate as number))
      .map((p) => ({ ...p, pct: Math.round(((p.rate as number) / max) * 100) }));
  }, []);

  return (
    <div className="shell">
      {/* Top bar */}
      <div className="topbar">
        <div>
          <div className="eyebrow">Luni, 1 Iunie 2026 · 07:00 EEST</div>
          <div className="large-title">Today</div>
        </div>
        <div className="topbar-right">
          <div className="segmented" role="tablist">
            {SEGMENTS.map((s) => (
              <button
                key={s}
                className="seg"
                role="tab"
                aria-selected={seg === s}
                onClick={() => setSeg(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="live">
            <span className="dot" /> Live · acum 3 min
          </div>
          <button className="btn" onClick={toggleTheme}>
            <svg className="ico" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.5 6.5-1.4-1.4M6.9 6.9 5.5 5.5m13 0-1.4 1.4M6.9 17.1l-1.4 1.4" />
            </svg>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="stage">
        <CorridorMap
          points={ALL_POINTS}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />

        {/* LEFT: brief + actions */}
        <div className="panel left">
          <h2>
            <svg className="ico" viewBox="0 0 24 24">
              <path d="M4 5h16M4 12h16M4 19h10" />
            </svg>
            Briefing de dimineață
          </h2>
          <p className="insight">
            Setul tău competitiv stă la <b>~{MARKET_AVG} RON</b>. Ești sub piață
            cu <b>{MARKET_AVG - (OWN.rate as number)} RON</b> — ai spațiu să
            crești ADR fără să pierzi din ritm.
          </p>
          <div className="metrics">
            <div className="metric">
              <div className="k">ADR</div>
              <div className="v num">{METRICS.adr}</div>
              <div className="d up">▲ {METRICS.adrDelta}%</div>
            </div>
            <div className="metric">
              <div className="k">RevPAR</div>
              <div className="v num">{METRICS.revpar}</div>
              <div className="d up">▲ {METRICS.revparDelta}%</div>
            </div>
            <div className="metric">
              <div className="k">Ocupare</div>
              <div className="v num">{METRICS.occupancy}%</div>
              <div className="d down">▼ {Math.abs(METRICS.occupancyDelta)}%</div>
            </div>
          </div>

          <h2 style={{ marginTop: 18 }}>
            <svg className="ico" viewBox="0 0 24 24">
              <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
            </svg>
            Today&apos;s Actions
          </h2>
          <div className="actions">
            <div className="action">
              <div className="a-top">
                <div className="a-title">Crește prețul 6–8 Iun</div>
                <span className="conf high">88%</span>
              </div>
              <div className="a-sub">
                <span className="rec">575 → 605 RON</span> · cerere peste set
              </div>
              <span className="swipe">
                Swipe <Arrow />
              </span>
            </div>
            <div className="action">
              <div className="a-top">
                <div className="a-title">Deschide weekend</div>
                <span className="conf high">81%</span>
              </div>
              <div className="a-sub">
                <span className="rec">+4 camere</span> · ritm peste anul trecut
              </div>
              <span className="swipe">
                Swipe <Arrow />
              </span>
            </div>
            <div className="action">
              <div className="a-top">
                <div className="a-title">Aliniază tariful de luni</div>
                <span className="conf med">64%</span>
              </div>
              <div className="a-sub">
                <span className="rec">575 → 559 RON</span> · cerere slabă
              </div>
              <span className="swipe">
                Swipe <Arrow />
              </span>
            </div>
          </div>
          <p className="illus">
            ADR / RevPAR / occupancy + own rate are illustrative until PMS data
            connects. Coordinates & competitor rates are real (seeded).
          </p>
        </div>

        {/* RIGHT: rate ladder */}
        <div className="panel right">
          <h2>
            <svg className="ico" viewBox="0 0 24 24">
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
            Rate ladder · {COMPETITORS_WITH_DIST.length} competitori
          </h2>
          <div className="ladder">
            {ladder.map((p) => (
              <div
                key={p.id}
                className={`rung${p.own ? " you" : ""}${
                  selected?.id === p.id ? " sel" : ""
                }`}
                onClick={() => setSelected(p)}
              >
                <div className="nm">
                  {p.own ? "Hotel Terra (tu)" : p.name}
                </div>
                <div className="pr num">{p.rate}</div>
                <div className="bar">
                  <span style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drill-down sheet */}
        {selected && (
          <>
            <div className="scrim" onClick={() => setSelected(null)} />
            <div className="sheet">
              <div className="grab" />
              <h3>{selected.own ? "Hotel Terra Neptun" : selected.name}</h3>
              <div className="meta">
                <span className="stars">{"★".repeat(selected.stars)}</span>
                <span>{selected.city}</span>
                {!selected.own && (
                  <span className="num">{selected.distanceKm} km</span>
                )}
                {selected.own && <span style={{ color: "var(--accent)" }}>your property</span>}
              </div>
              <div className="grid">
                <div className="cell">
                  <div className="k">RATE · AVG</div>
                  <div className="v num">{selected.rate ?? "—"}</div>
                </div>
                <div className="cell">
                  <div className="k">RANGE</div>
                  <div className="v num" style={{ fontSize: 16 }}>
                    {selected.minRate && selected.maxRate
                      ? `${selected.minRate}–${selected.maxRate}`
                      : "—"}
                  </div>
                </div>
                <div className="cell">
                  <div className="k">AVAIL</div>
                  <div className="v num">{selected.avail}%</div>
                </div>
                <div className="cell">
                  <div className="k">VS MARKET</div>
                  <div
                    className="v num"
                    style={{
                      color:
                        selected.rate == null
                          ? "var(--text-2)"
                          : (selected.rate as number) - MARKET_AVG >= 0
                          ? "var(--positive)"
                          : "var(--negative)",
                    }}
                  >
                    {selected.rate == null
                      ? "—"
                      : `${(selected.rate as number) - MARKET_AVG > 0 ? "+" : ""}${
                          (selected.rate as number) - MARKET_AVG
                        }`}
                  </div>
                </div>
              </div>

              <div className="src-head">Intelligence sources</div>
              <div className="sources">
                {[
                  ["Reviews & rating", "Connect Google · TripAdvisor"],
                  ["Booking pace", "Connect Booking.com"],
                  ["Social posts", "Connect Instagram · TikTok"],
                  ["Photos & amenities", "Connect Google Places"],
                ].map(([n, s]) => (
                  <div className="src" key={n}>
                    <span className="src-n">{n}</span>
                    <span className="src-s">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
