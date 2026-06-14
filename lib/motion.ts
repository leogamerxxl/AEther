// Aether motion tokens - the code form of NIGHT HARBOR Section 7.
//
// Single source for durations, easings, and the one canonical spring. NO new value
// may be added here without first amending docs/AETHER_DESIGN_LANGUAGE.md
// (governance Section 12). Easings mirror app/globals.css (--ease-spring / --ease-out).

// Durations (ms): 120 instant / 200 quick / 320 standard / 600 cinematic / >=2000 ambient.
export const DURATION = {
  instant: 120,
  quick: 200,
  standard: 320,
  cinematic: 600,
  ambient: 2000,
} as const;

// CSS easing strings (for inline style / className parity with globals.css).
export const EASE = {
  spring: "cubic-bezier(.16,1,.3,1)", // --ease-spring
  out: "cubic-bezier(.22,.61,.36,1)", // --ease-out
} as const;

// framer-motion form of --ease-out (same curve, tuple-typed for the Transition API).
const OUT_BEZIER: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

// The one sanctioned framer spring (Section 7: stiffness 300, damping 28).
export const SPRING = { type: "spring" as const, stiffness: 300, damping: 28 };

// Ready-made framer transitions, built only from the tokens above.
export const TRANSITION = {
  quick: { duration: DURATION.quick / 1000, ease: OUT_BEZIER },
  standard: { duration: DURATION.standard / 1000, ease: OUT_BEZIER },
  spring: SPRING,
};