"use client";

import { useEffect, useRef } from "react";

// Ambient auth backdrop - adapted from the 21st.dev "login-signup" scene.
// Retailored to Aether: warm-white rising particles + faint accent grid that
// draws in with an amber shimmer. Pure canvas + CSS, no deps.
export function AuthBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const setSize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    setSize();

    type P = { x: number; y: number; v: number; o: number };
    let ps: P[] = [];
    let raf = 0;
    const make = (): P => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, v: Math.random() * 0.25 + 0.05, o: Math.random() * 0.3 + 0.12 });
    const init = () => { ps = []; const count = Math.floor((canvas.width * canvas.height) / 11000); for (let i = 0; i < count; i++) ps.push(make()); };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of ps) {
        p.y -= p.v;
        if (p.y < 0) { p.x = Math.random() * canvas.width; p.y = canvas.height + Math.random() * 40; p.v = Math.random() * 0.25 + 0.05; p.o = Math.random() * 0.3 + 0.12; }
        ctx.fillStyle = `rgba(245,242,238,${p.o})`;
        ctx.fillRect(p.x, p.y, 0.7, 2.2);
      }
      raf = requestAnimationFrame(draw);
    };
    const onResize = () => { setSize(); init(); };

    window.addEventListener("resize", onResize);
    init();
    raf = requestAnimationFrame(draw);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <style>{`
        .ab-lines{position:absolute;inset:0;opacity:.6}
        .ab-h,.ab-v{position:absolute;background:rgba(255,255,255,.05);will-change:transform,opacity}
        .ab-h{left:0;right:0;height:1px;transform:scaleX(0);transform-origin:50% 50%;animation:abX .8s cubic-bezier(.22,.61,.36,1) forwards}
        .ab-v{top:0;bottom:0;width:1px;transform:scaleY(0);transform-origin:50% 0;animation:abY .9s cubic-bezier(.22,.61,.36,1) forwards}
        .ab-h:nth-child(1){top:18%;animation-delay:.10s}
        .ab-h:nth-child(2){top:50%;animation-delay:.20s}
        .ab-h:nth-child(3){top:82%;animation-delay:.30s}
        .ab-v:nth-child(4){left:22%;animation-delay:.40s}
        .ab-v:nth-child(5){left:50%;animation-delay:.52s}
        .ab-v:nth-child(6){left:78%;animation-delay:.64s}
        .ab-h::after,.ab-v::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(200,161,101,.22),transparent);opacity:0;animation:abShim 1s ease-out forwards}
        .ab-h:nth-child(1)::after{animation-delay:.10s}.ab-h:nth-child(2)::after{animation-delay:.20s}.ab-h:nth-child(3)::after{animation-delay:.30s}
        .ab-v:nth-child(4)::after{animation-delay:.40s}.ab-v:nth-child(5)::after{animation-delay:.52s}.ab-v:nth-child(6)::after{animation-delay:.64s}
        @keyframes abX{0%{transform:scaleX(0);opacity:0}60%{opacity:.9}100%{transform:scaleX(1);opacity:.6}}
        @keyframes abY{0%{transform:scaleY(0);opacity:0}60%{opacity:.9}100%{transform:scaleY(1);opacity:.6}}
        @keyframes abShim{0%{opacity:0}35%{opacity:.25}100%{opacity:0}}
      `}</style>
      <div className="ab-lines">
        <div className="ab-h" /><div className="ab-h" /><div className="ab-h" />
        <div className="ab-v" /><div className="ab-v" /><div className="ab-v" />
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-40 mix-blend-screen" />
    </div>
  );
}
