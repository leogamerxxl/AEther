"use client";

import { useEffect } from "react";

// Registers the service worker in production for installable/offline PWA.
// In development it does the OPPOSITE: actively unregisters any stale service
// worker and clears its caches, so a refresh always loads fresh code (a lingering
// SW serving cached JS is a classic "my changes don't show up / app is broken").
export default function PWARegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      const onLoad = () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); };
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }

    // DEV kill-switch: remove any stale SW + caches.
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((k) => { if (k !== "mapbox-tiles") caches.delete(k); })).catch(() => {});
    }
  }, []);
  return null;
}
