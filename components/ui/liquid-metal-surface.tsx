"use client";

import React, { useEffect, useRef, useState } from "react";
import { liquidMetalFragmentShader, ShaderMount } from "@paper-design/shaders";
import { cn } from "@/lib/utils";

// Liquid-metal shader background. minPixelRatio 1 keeps the GPU light when several
// chips share the screen with the map.
export function LiquidMetalSurface({ speed = 0.6, className }: { speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mount = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    mount.current = new ShaderMount(
      el,
      liquidMetalFragmentShader,
      { u_repetition: 4, u_softness: 0.5, u_shiftRed: 0.3, u_shiftBlue: 0.3, u_distortion: 0, u_contour: 0, u_angle: 45, u_scale: 8, u_shape: 0, u_offsetX: 0.1, u_offsetY: -0.1 },
      undefined,
      0.6,
      undefined,
      1,
    );
    return () => { mount.current?.destroy?.(); mount.current = null; };
  }, []);

  useEffect(() => { mount.current?.setSpeed?.(speed); }, [speed]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden [&>canvas]:!absolute [&>canvas]:!inset-0 [&>canvas]:!block [&>canvas]:!h-full [&>canvas]:!w-full",
        className,
      )}
      style={{ background: "linear-gradient(180deg,#202020,#000)" }}
    />
  );
}

const REST_SHADOW =
  "0px 0px 0px 1px rgba(0,0,0,0.35), 0px 30px 14px 0px rgba(0,0,0,0.03), 0px 16px 12px 0px rgba(0,0,0,0.09), 0px 7px 8px 0px rgba(0,0,0,0.13), 0px 2px 5px 0px rgba(0,0,0,0.16)";

// Same liquid-metal look as the original button: shader behind an inset body so the
// metal reads as an edge ring, plus a soft floating shadow. variant:
//   "dark"  -> black body, white text (default)
//   "light" -> bright chrome body, dark text
export function LiquidMetalChip({ children, className, style, variant = "dark", ...props }: React.ComponentProps<"button"> & { variant?: "dark" | "light" }) {
  const [hover, setHover] = useState(false);
  const light = variant === "light";
  return (
    <button
      {...props}
      onMouseEnter={(e) => { setHover(true); props.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); props.onMouseLeave?.(e); }}
      className={cn(
        "group relative isolate inline-flex cursor-pointer items-center overflow-hidden transition-transform duration-150 active:scale-[.985] disabled:pointer-events-none disabled:opacity-50",
        light ? "text-[#0b0b0d]" : "text-white",
        className,
      )}
      style={{ boxShadow: REST_SHADOW, ...style }}
    >
      <LiquidMetalSurface speed={hover ? 1.2 : 0.6} className="z-0" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[2px] z-[1] rounded-[inherit]"
        style={{ background: light ? "linear-gradient(180deg,rgba(249,249,251,.74),rgba(213,213,219,.62))" : "linear-gradient(180deg,#202020 0%,#000000 100%)" }}
      />
      <span className="relative z-[2] flex h-full w-full items-center justify-center gap-2">{children}</span>
    </button>
  );
}
