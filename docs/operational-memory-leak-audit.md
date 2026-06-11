# Audit Memory Leaks — Operational Realtime System
**Project Aether — Hotel Terra Neptun**

## Scenariile de leak analizate

### 1. React StrictMode (Dev) — Mount dublu

**Problema:** În development cu StrictMode, React montează componenta, o demontează imediat, apoi o remontează. Un `useEffect` naiv ar crea 2 canale WebSocket simultane.

**Rezolvare în `OperationalProvider.tsx`:**
```typescript
// La START: dacă există deja un canal din prima invocare, îl distrugem
if (channelRef.current) {
  supabase.removeChannel(channelRef.current).catch(() => {});
  channelRef.current = null;
}
```
✅ **Acoperit** — teardown preventiv înainte de fiecare setup nou.

---

### 2. Unmount în-flight (async gap)

**Problema:** `subscribe()` este asincron. Dacă componenta se demontează între `channel.subscribe()` și primul callback primit, acel callback va apela `dispatch()` pe un component montat anterior.

**Rezolvare:**
```typescript
.subscribe((status) => {
  if (!mountedRef.current) return;  // ← Guard
  // ...
})
// Și în fiecare .on() callback:
(payload) => {
  if (!mountedRef.current) return;  // ← Guard
  dispatchRef.current(...)
}
```
✅ **Acoperit** — `mountedRef.current = false` se setează ÎNAINTE de `removeChannel` în cleanup.

---

### 3. Hydration request după unmount

**Problema:** Query-ul Supabase de hydration la boot (`.select()`) poate fi în-flight când componenta se demontează.

**Rezolvare:**
```typescript
// în useEffect de hydration:
if (!mountedRef.current) return;  // după await
// +
abortController?.abort()  // în cleanup
```
✅ **Acoperit** — AbortController + mountedRef.

---

### 4. `dispatchRef` stale closure

**Problema:** Dacă `dispatch` ar fi direct în dependency array-ul `useEffect`-ului Realtime, orice re-render care schimbă referința `dispatch` ar recrea canalul WebSocket.

**Rezolvare:**
```typescript
const dispatchRef = useRef(dispatch);
useEffect(() => { dispatchRef.current = dispatch; }, []);
// Folosit în callback: dispatchRef.current(...)
```
✅ **Acoperit** — `dispatch` este stabil (din `useReducer`), dar pattern-ul cu ref elimină orice risc.

---

### 5. Navigare Next.js App Router

**Problema:** La navigarea între `page.tsx`-uri, layout-ul rămâne montat (Next.js shared layouts). OperationalProvider **nu** se remontează la navigare normală — canalul Realtime rămâne deschis intenționat.

La navigarea spre o pagină complet nouă (schimb de layout), cleanup-ul `useEffect` se execută:
```typescript
return () => {
  mountedRef.current = false;
  supabase.removeChannel(channelRef.current);
  channelRef.current = null;
};
```
✅ **Acoperit** — cleanup garantat la demontare.

---

### 6. CoastalCommandCenter — canalul `ooda-telemetry`

**Localitate:** `components/spatial/CoastalCommandCenter.tsx`, linia ~99-104.

**Pattern existent:**
```typescript
const chan = supabase.channel("ooda-telemetry").on(...).subscribe();
return () => { mounted = false; supabase.removeChannel(chan); };
```

**Observație:** Callback-ul `.on("postgres_changes")` nu verifică `mounted` înainte de `setLive()`.
În React 18+, acest lucru nu mai cauzează erori pe funcțional components, iar `removeChannel` garantează că callback-ul nu mai e invocat după cleanup.

**Risc:** ⚠️ Minor — callback poate rula o dată în-flight la demontare. Nu cauzează crash sau leak persistent.

**Recomandare (non-blocking):**
```typescript
// Adaugă la linia 100:
const ch_r_cb = (payload) => {
  if (!mounted) return;  // ← adăugat
  const r = payload.new ...
```

---

## Matrix de acoperire

| Scenariu                    | Componentă              | Acoperit | Metodă                             |
|-----------------------------|-------------------------|----------|------------------------------------|
| StrictMode double-mount     | OperationalProvider     | ✅       | `channelRef` teardown preventiv    |
| Async unmount (subscribe)   | OperationalProvider     | ✅       | `mountedRef` în callbacks          |
| Async unmount (hydration)   | OperationalProvider     | ✅       | `AbortController` + `mountedRef`   |
| Stale closure dispatch      | OperationalProvider     | ✅       | `dispatchRef` pattern              |
| Navigare Next.js            | OperationalProvider     | ✅       | `useEffect` cleanup                |
| RAF accumulation            | CoastalCommandCenter    | ✅       | `cancelAnimationFrame(rafRef)`     |
| Mapbox markers leak         | CoastalCommandCenter    | ✅       | `marker.remove()` în cleanup       |
| Supabase ooda-telemetry     | CoastalCommandCenter    | ✅       | `removeChannel(chan)` în cleanup   |
| setState după unmount       | CoastalCommandCenter    | ⚠️ minor | `mounted` check lipsă în cb RT    |

## Concluzie

Sistemul operațional este **sigur de memory leak** în toate scenariile critice. Singura observație minoră (setState în CoastalCommandCenter fără mounted check în callback Realtime) nu produce crash și este acceptabilă pentru React 18+.
