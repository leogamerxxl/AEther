"use client";
// ModeHost - routes the active non-map mode to its pane. One host, one pane at a
// time; the map (and its chrome) stays alive beneath every mode.

import type { IntelligenceObject } from "@/lib/intelligence-map";
import type { WorldMode } from "@/lib/mode-data";
import ObserveMode from "./ObserveMode";
import BriefMode from "./BriefMode";
import ActMode from "./ActMode";
import SimulateMode from "./SimulateMode";

export default function ModeHost({ mode, onPick, onClose }: {
  mode: Exclude<WorldMode, "map">;
  onPick: (io: IntelligenceObject) => void;
  onClose: () => void;
}) {
  if (mode === "observe") return <ObserveMode onClose={onClose} />;
  if (mode === "brief") return <BriefMode onClose={onClose} />;
  if (mode === "act") return <ActMode onPick={onPick} onClose={onClose} />;
  return <SimulateMode onClose={onClose} />;
}