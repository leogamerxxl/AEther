"use client";
// TwinOverlay - the Interior band world treatment (UXP building grammar:
// occupants column left, floor selector + schematic right, the real building
// in the world between them). Truth split is explicit: hotel-level occupancy
// comes from otb_observations (honest empty until the PMS/OTB channel feeds);
// the room-level layout is the TERRA_TWIN contract, labeled SAMPLE.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { C } from "@/lib/command-theme";
import { TRANSITION } from "@/lib/motion";
import { PACE_COLORS } from "@/lib/property-extrusions";
import { TERRA_TWIN } from "@/lib/twin-sample";
import { fetchOtbToday, type OtbToday } from "@/lib/mode-data";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] font-semibold uppercase tracking-[.12em] text-white/40">{children}</div>;
}
function SampleChip() {
  return <span className="rounded-[6px] border border-white/[.12] px-1.5 py-0.5 text-[9px] uppercase tracking-[.08em] text-white/45">sample</span>;
}

export default function TwinOverlay() {
  const [otb, setOtb] = useState<{ loading: boolean; row: OtbToday | null }>({ loading: true, row: null });
  const [floorId, setFloorId] = useState(TERRA_TWIN.floors[0].id);
  useEffect(() => {
    let alive = true;
    fetchOtbToday()
      .then((row) => { if (alive) setOtb({ loading: false, row }); })
      .catch(() => { if (alive) setOtb({ loading: false, row: null }); });
    return () => { alive = false; };
  }, []);
  const floor = TERRA_TWIN.floors.find((f) => f.id === floorId) ?? TERRA_TWIN.floors[0];

  return (
    <>
      {/* left: hotel-level truth + team/inventory */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={TRANSITION.standard}
        className="fixed left-4 top-16 z-[80] hidden w-[264px] flex-col gap-2 lg:flex">
        <div className="gx gx-matte rounded-[14px] p-3">
          <div className="text-[15px] font-semibold text-white">Hotel Terra - interior</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[.1em] text-white/40">digital twin</div>
        </div>
        <div className="gx gx-matte rounded-[14px] p-3">
          <Label>Ocupare azi</Label>
          {otb.loading ? (
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded-[4px] bg-white/[.06]" />
          ) : otb.row && otb.row.rooms_sold != null ? (
            <>
              <div className="num mt-1 text-[24px] font-light tabular-nums text-white/90">
                {otb.row.rooms_sold}
                <span className="text-[13px] text-white/45"> / {(otb.row.rooms_sold ?? 0) + (otb.row.rooms_remaining ?? 0)} camere</span>
              </div>
              {otb.row.adr != null ? (
                <div className="mt-1 text-[11px] tabular-nums text-white/55">ADR {Math.round(Number(otb.row.adr))} RON</div>
              ) : null}
            </>
          ) : (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/50">
              Fara date de ocupare inca - canalul OTB/PMS nu e conectat. Cand hotelul trimite
              datele, cifra de aici e reala, nu estimata.
            </p>
          )}
        </div>
        <div className="gx gx-matte rounded-[14px] p-3">
          <div className="flex items-center justify-between">
            <Label>Echipa in tura</Label>
            <SampleChip />
          </div>
          <div className="mt-1.5 flex flex-col gap-1">
            {TERRA_TWIN.departments.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-[11.5px]">
                <span className="text-white/70">{d.label}</span>
                <span className="tabular-nums text-white/45">{d.roles.filter((r) => r.state === "in tura").length} activi</span>
              </div>
            ))}
          </div>
        </div>
        <div className="gx gx-matte rounded-[14px] p-3">
          <div className="flex items-center justify-between">
            <Label>Inventar critic</Label>
            <SampleChip />
          </div>
          <div className="mt-1.5 flex flex-col gap-1">
            {TERRA_TWIN.departments.flatMap((d) => d.inventory).filter((i) => i.low).map((i) => (
              <div key={i.name} className="flex items-center justify-between text-[11.5px]">
                <span className="text-white/70">{i.name}</span>
                <span className="tabular-nums" style={{ color: C.warn }}>{i.qty} {i.unit}</span>
              </div>
            ))}
            {TERRA_TWIN.departments.flatMap((d) => d.inventory).filter((i) => i.low).length === 0 ? (
              <span className="text-[11.5px] text-white/45">Nimic sub prag.</span>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* right: floor selector + schematic room grid */}
      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={TRANSITION.standard}
        className="fixed right-4 top-16 z-[80] hidden w-[300px] gap-2 lg:flex">
        {/* floor rail */}
        <div className="flex flex-col justify-start gap-1 pt-1">
          {TERRA_TWIN.floors.map((f) => {
            const active = f.id === floorId;
            return (
              <button key={f.id} onClick={() => setFloorId(f.id)} aria-current={active ? "true" : undefined}
                className={"rounded-full px-2.5 py-1.5 text-[11px] tabular-nums transition-colors duration-200 " +
                  (active ? "gx-metal font-medium" : "text-white/45 hover:text-white/80")}>
                {f.label.replace("Etaj ", "E")}
              </button>
            );
          })}
        </div>
        {/* schematic */}
        <div className="gx gx-matte flex-1 rounded-[14px] p-3">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium text-white/90">{floor.label}</div>
            <SampleChip />
          </div>
          <div className="mt-1 text-[10.5px] tabular-nums text-white/45">
            {floor.occupied} / {floor.rooms} camere ocupate
          </div>
          <div className="mt-2.5 grid grid-cols-6 gap-1.5">
            {Array.from({ length: floor.rooms }, (_, i) => {
              const occupied = i < floor.occupied;
              return (
                <div key={i}
                  className="flex h-8 items-center justify-center rounded-[3px] text-[9px] tabular-nums"
                  style={occupied
                    ? { background: "rgba(91,127,166,.4)", color: "rgba(255,255,255,.75)" }
                    : { border: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.35)" }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
              );
            })}
          </div>
          <div className="mt-2.5 flex items-center gap-3 text-[10px] text-white/45">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px]" style={{ background: "rgba(91,127,166,.4)" }} /> ocupata
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] border border-white/[.2]" /> libera
            </span>
            <span className="ml-auto" style={{ color: PACE_COLORS.balanced }} aria-hidden />
          </div>
          <p className="mt-2 border-t border-white/[.06] pt-2 text-[10px] leading-relaxed text-white/40">
            Schema camerelor e contractul twin-ului (SAMPLE) pana cand PMS-ul alimenteaza starea
            reala per camera. Ocuparea de hotel din stanga devine live odata cu canalul OTB.
          </p>
        </div>
      </motion.div>
    </>
  );
}