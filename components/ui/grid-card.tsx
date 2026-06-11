import React from "react";
import { cn } from "@/lib/utils";
import { GridPattern } from "./grid-pattern";

// Adapted from sshahaider/grid-card - retinted to Aether (amber/cyan, matte glass).
// Pattern is memoised so it does not re-randomise (and flicker) on every render.
export function GridCard({ className, children, ...props }: React.ComponentProps<"div">) {
  const squares = React.useMemo(() => getRandomPattern(5), []);
  return (
    <div
      className={cn(
        "group relative isolate z-0 flex h-full flex-col justify-between overflow-hidden rounded-xl border border-white/[.07] bg-white/[.02] px-4 py-3.5 transition-colors duration-150 hover:border-white/[.16]",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0">
        <div className="absolute -inset-[25%] -skew-y-12 [mask-image:linear-gradient(225deg,black,transparent)]">
          <GridPattern
            width={28}
            height={28}
            x={0}
            y={0}
            squares={squares}
            className="absolute inset-0 size-full translate-y-2 fill-white/[0.06] stroke-white/[0.11] transition-transform duration-150 ease-out group-hover:translate-y-0"
          />
        </div>
        <div className="absolute -inset-[10%] opacity-0 blur-[50px] transition-opacity duration-200 group-hover:opacity-20 bg-[conic-gradient(#C8A165_0deg,#C8A165_110deg,#22d3ee_200deg,#38bdf8_280deg,#C8A165_360deg)]" />
      </div>
      {children}
    </div>
  );
}

function getRandomPattern(length = 5): [x: number, y: number][] {
  return Array.from({ length }, () => [
    Math.floor(Math.random() * 4) + 7,
    Math.floor(Math.random() * 6) + 1,
  ] as [number, number]);
}
