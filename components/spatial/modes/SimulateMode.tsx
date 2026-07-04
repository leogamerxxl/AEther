"use client";
// SimulateMode - honest stub (faza P6). No fake sliders, no invented numbers:
// the pane states the contract the simulator will honor and the real data it
// will run on. Neutral palette - nothing here is live and nothing is an action.

import ModePane, { PaneCard, PaneLabel } from "./ModePane";

const CONTRACT = [
  { q: "Ce-ar fi daca ridic tariful cu X% pe o noapte?", a: "impact estimat pe ocupare si venit, cu interval de incredere" },
  { q: "Ce-ar fi daca tin tariful sub mediana pietei?", a: "volum aditional estimat vs. venit pierdut pe camera" },
  { q: "Cat de sensibila e cererea la pret in aceasta saptamana?", a: "elasticitate invatata din deciziile si rezultatele reale" },
];

const INPUTS = [
  "rate_observations - istoricul complet al preturilor concurentei",
  "otb_observations - ocuparea proprie, pe noapte",
  "outcomes - verdictele deciziilor deja masurate (elasticitatea se invata, nu se inventeaza)",
];

export default function SimulateMode({ onClose }: { onClose: () => void }) {
  return (
    <ModePane title="Simulare" subtitle="faza P6 - in constructie" onClose={onClose}>
      <PaneCard className="mb-3">
        <PaneLabel>De ce nu e inca activ</PaneLabel>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/70">
          Simulatorul raspunde la intrebari contrafactuale. Ca sa nu inventeze cifre, are nevoie de
          suficiente decizii masurate (outcomes) din care sa invete elasticitatea reala a pietei.
          Registrul de decizii tocmai a inceput sa se umple - pana atunci, aici nu afisam nimic fabricat.
        </p>
      </PaneCard>
      <div className="mb-3 flex flex-col gap-2">
        <PaneLabel>Contractul simulatorului</PaneLabel>
        {CONTRACT.map((c) => (
          <PaneCard key={c.q}>
            <div className="text-[12.5px] text-white/85">{c.q}</div>
            <div className="mt-1 text-[11px] text-white/45">{c.a}</div>
          </PaneCard>
        ))}
      </div>
      <PaneLabel>Datele reale pe care va rula</PaneLabel>
      <ul className="mt-2 flex flex-col gap-1.5">
        {INPUTS.map((i) => (
          <li key={i} className="rounded-[10px] border border-white/[.06] bg-white/[.02] px-3 py-2 font-mono text-[11px] text-white/55">{i}</li>
        ))}
      </ul>
    </ModePane>
  );
}