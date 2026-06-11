// Lightweight global toast trigger. Call toast("...") from anywhere; the
// <Toaster/> component (components/spatial/Toast.tsx) listens for this event.
// Kept separate from the component so editing either stays Fast-Refresh-friendly.

export const TOAST_EVENT = "aether:toast";

export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}
