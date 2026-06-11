"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TOAST_EVENT as EVENT } from "@/lib/toast";

// Mount <Toaster/> once; call toast("...") from @/lib/toast anywhere.
type ToastItem = { id: number; message: string };

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent<string>).detail;
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, message }]);
      window.setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 2800);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[120] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 14, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="gx gx-bento pointer-events-auto flex items-center gap-2.5 rounded-full px-5 py-3"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-[#5fd0a0]" style={{ boxShadow: "0 0 8px #5fd0a0" }} />
            <span className="text-[13px] font-medium text-white/90">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
