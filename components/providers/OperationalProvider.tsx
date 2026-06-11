"use client";

/**
 * Project Aether — OperationalProvider
 * @file components/providers/OperationalProvider.tsx
 *
 * Provider React care:
 *   1. Gestionează starea mașinii operaționale via useReducer
 *   2. Deschide un canal Supabase Realtime pentru tabelul `operational_incidents`
 *   3. Hidratează starea cu incidentele deja deschise la boot
 *   4. Expune starea și dispatch via React Context
 *
 * ── PREVENIRE MEMORY LEAKS ─────────────────────────────────────────────────
 *
 * Problema: Supabase Realtime folosește WebSocket-uri persistente.
 * Dacă un canal nu este închis corect, conexiunile se acumulează la:
 *   • React StrictMode (mount-demount-mount dublu în dev)
 *   • Navigare Next.js între pagini (component rămâne montat în layout)
 *   • Hot-reload în development
 *
 * Soluția implementată (3 straturi):
 *
 * Stratul 1 — channelRef:
 *   Referința stabilă la canalul curent. La fiecare setup, verificăm dacă
 *   există deja un canal și îl închidem ÎNAINTE de a crea unul nou.
 *   Aceasta rezolvă double-invoke din StrictMode.
 *
 * Stratul 2 — mountedRef:
 *   Flag boolean care previne actualizările de stare după ce componenta
 *   a fost demontată (fereastra de vulnerabilitate: întrucât `subscribe()`
 *   este asincron, pot exista callback-uri în-flight când componenta dispare).
 *
 * Stratul 3 — cleanup în useEffect return:
 *   `supabase.removeChannel()` trimite LEAVE la server și înregistrează
 *   starea WebSocket ca finalizată. Supabase client nu refolosește
 *   un canal închis, deci nu există stale references.
 *
 * Scenariile acoperite:
 *   ✓ StrictMode dev mount-demount-mount
 *   ✓ Navigare Next.js → alt layout
 *   ✓ Hot Module Replacement
 *   ✓ Tab inactiv → reconnect automat Supabase
 *   ✓ Timeout rețea → CHANNEL_ERROR → dispatch REALTIME_ERROR
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import {
  operationalReducer,
  INITIAL_STATE,
  selectCriticalCount,
} from '@/lib/store/operationalMachine';
import type {
  OperationalContextValue,
  OperationalIncident,
} from '@/types/operational';

// ---------------------------------------------------------------------------
// CONTEXT
// ---------------------------------------------------------------------------

const OperationalContext = createContext<OperationalContextValue | null>(null);

// ---------------------------------------------------------------------------
// HOOK DE CONSUM
// ---------------------------------------------------------------------------

export function useOperational(): OperationalContextValue {
  const ctx = useContext(OperationalContext);
  if (!ctx) {
    throw new Error(
      '[useOperational] Folosit în afara <OperationalProvider>. ' +
      'Asigurați-vă că layout.tsx include <OperationalProvider>.'
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// CONSTANTE
// ---------------------------------------------------------------------------

/** Numărul maxim de incidente deschise la boot (interogare SQL LIMIT) */
const HYDRATION_LIMIT = 50;

/** Timeout în ms pentru răspunsul de hydration la boot */
const HYDRATION_TIMEOUT_MS = 5000;

/** Numele canalului Realtime (unic per tab, evită coliziuni) */
const CHANNEL_NAME = 'aether-operational-feed';

/**
 * Feature flag — Supabase Realtime pentru operational_incidents.
 * IMPLICIT OPRIT: tabelul si publicarea Realtime nu exista inca pe proiectul
 * deployat. O subscriere pe un tabel inexistent produce un flux nesfarsit de
 * 'transport failure' care sufoca renderer-ul (HANDOFF gotcha #6).
 * Dupa aplicarea migrarii 002 in Supabase, seteaza
 * NEXT_PUBLIC_OPERATIONAL_REALTIME=true in .env.local pentru a reactiva.
 */
const REALTIME_ENABLED =
  process.env.NEXT_PUBLIC_OPERATIONAL_REALTIME === 'true' &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

// ---------------------------------------------------------------------------
// PROVIDER
// ---------------------------------------------------------------------------

export function OperationalProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(operationalReducer, INITIAL_STATE);

  /**
   * Stratul 1: channelRef — referința stabilă la canalul WebSocket curent.
   * Tip explicit pentru a evita `any`.
   */
  const channelRef = useRef<RealtimeChannel | null>(null);

  /**
   * Stratul 2: mountedRef — flag anti-stale pentru callback-uri async.
   * Setat la true la mount, la false la cleanup.
   */
  const mountedRef = useRef(false);

  /**
   * dispatchRef — permite accesarea dispatch-ului stabil din callback-urile
   * Realtime fără a-l pune în dependency array (ar recrea canalul).
   */
  const dispatchRef = useRef(dispatch);
  useEffect(() => { dispatchRef.current = dispatch; }, []);

  // ── Hydration la boot ────────────────────────────────────────────────────
  useEffect(() => {
    if (!REALTIME_ENABLED) return;
    mountedRef.current = true;
    let abortController: AbortController | null = null;

    async function hydrate() {
      abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController?.abort(), HYDRATION_TIMEOUT_MS);

      try {
        const { data, error } = await supabase
          .from('operational_incidents')
          .select('*')
          .in('status', ['open', 'acknowledged'])
          .order('created_at', { ascending: false })
          .limit(HYDRATION_LIMIT);

        clearTimeout(timeoutId);

        if (!mountedRef.current) return;
        if (error) {
          console.error('[OperationalProvider] Hydration error:', error.message);
          return;
        }

        if (data && data.length > 0) {
          dispatchRef.current({
            type:    'HYDRATE',
            payload: data as OperationalIncident[],
          });
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!mountedRef.current) return;
        console.error('[OperationalProvider] Hydration failed:', err);
      }
    }

    hydrate();

    return () => {
      // Cleanup hydration: cancelăm în-flight requests
      abortController?.abort();
    };
  }, []); // Rulează o singură dată la mount

  // ── Supabase Realtime Subscription ───────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (!REALTIME_ENABLED) {
      dispatchRef.current({ type: 'REALTIME_DISCONNECTED' });
      return;
    }

    /**
     * Stratul 1 — Teardown preventiv:
     * React StrictMode invocă efectul de două ori rapid (mount → cleanup → mount).
     * Dacă primul canal nu este închis înainte de al doilea setup,
     * vom avea două canale active pe același tabel.
     */
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current).catch((err: unknown) => {
        console.warn('[OperationalProvider] Could not remove stale channel:', err);
      });
      channelRef.current = null;
    }

    // Notificăm UI-ul că ne conectăm
    dispatchRef.current({ type: 'REALTIME_CONNECTING' });

    // Creăm canalul nou
    const channel: RealtimeChannel = supabase
      .channel(CHANNEL_NAME, {
        config: {
          broadcast: { self: false }, // Nu primim propriile mesaje broadcast
          presence:  { key: '' },
        },
      })
      // ── INSERT: incident nou raportat ─────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'operational_incidents',
        },
        (payload) => {
          /**
           * Stratul 2 — Verificare montare:
           * Callback-ul poate fi invocat după ce componenta s-a demontat
           * dacă se află în-flight la momentul cleanup-ului.
           */
          if (!mountedRef.current) return;
          dispatchRef.current({
            type:    'INCIDENT_RECEIVED',
            payload: payload.new as OperationalIncident,
          });
        }
      )
      // ── UPDATE: incident acknowledged sau resolved ────────────────────────
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'operational_incidents',
        },
        (payload) => {
          if (!mountedRef.current) return;
          const updated = payload.new as OperationalIncident;
          if (updated.status === 'resolved') {
            dispatchRef.current({
              type:    'INCIDENT_RESOLVED',
              payload: { id: updated.id },
            });
          } else if (updated.status === 'acknowledged') {
            dispatchRef.current({
              type:    'INCIDENT_ACKNOWLEDGED',
              payload: { id: updated.id },
            });
          }
        }
      )
      // ── Status conexiune ──────────────────────────────────────────────────
      .subscribe((status, err) => {
        if (!mountedRef.current) return;

        switch (status) {
          case 'SUBSCRIBED':
            dispatchRef.current({ type: 'REALTIME_CONNECTED' });
            break;
          case 'CHANNEL_ERROR':
            dispatchRef.current({ type: 'REALTIME_ERROR' });
            console.error('[OperationalProvider] Channel error:', err);
            break;
          case 'TIMED_OUT':
            dispatchRef.current({ type: 'REALTIME_DISCONNECTED' });
            console.warn('[OperationalProvider] Channel timed out — Supabase va reîncerca.');
            break;
          case 'CLOSED':
            // Închidere normală (ex: din cleanup). Nu logăm ca eroare.
            break;
          default:
            break;
        }
      });

    channelRef.current = channel;

    /**
     * Stratul 3 — Cleanup la demontare / re-run:
     * `supabase.removeChannel()` trimite LEAVE la server și
     * înregistrează WebSocket-ul ca finalizat în clientul Supabase.
     * Aceasta previne acumularea de conexiuni zombie.
     */
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch((err: unknown) => {
          // removeChannel poate eșua dacă conexiunea s-a pierdut deja
          console.warn('[OperationalProvider] Cleanup removeChannel:', err);
        });
        channelRef.current = null;
      }
    };
  }, []); // Dependency array gol: supabase este singleton stabil

  // ── Valoarea contextului (memoizată) ─────────────────────────────────────
  const activeIncidentsBySeverity = useMemo(
    () => [...state.activeIncidents],
    [state.activeIncidents]
  );

  const criticalCount = useMemo(
    () => selectCriticalCount(state),
    [state]
  );

  const contextValue = useMemo<OperationalContextValue>(
    () => ({
      state,
      dispatch,
      activeIncidentsBySeverity,
      criticalCount,
    }),
    [state, activeIncidentsBySeverity, criticalCount]
  );

  return (
    <OperationalContext.Provider value={contextValue}>
      {children}
    </OperationalContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// HOOK UTILITAR: submitIncident
// Wraps INSERT-ul Supabase și actualizarea locală optimistă.
// ---------------------------------------------------------------------------

export function useIncidentSubmit() {
  const { dispatch } = useOperational();

  const submit = useCallback(async (
    input: Omit<OperationalIncident, 'id' | 'created_at' | 'acknowledged_at' | 'resolved_at' | 'source_client' | 'status'>
  ): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase
      .from('operational_incidents')
      .insert({
        ...input,
        status:        'open',
        source_client: 'incident_dispatcher',
      })
      .select()
      .single();

    if (error) {
      console.error('[useIncidentSubmit] Insert failed:', error.message);
      return { success: false, error: error.message };
    }

    // Optimistic update: nu așteptăm Realtime (poate fi >500ms)
    // Realtime va veni oricum și va face deduplicare via `alreadyExists` check
    dispatch({ type: 'INCIDENT_RECEIVED', payload: data as OperationalIncident });

    return { success: true };
  }, [dispatch]);

  return { submit };
}
