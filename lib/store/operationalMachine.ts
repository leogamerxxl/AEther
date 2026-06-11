/**
 * Project Aether — Operational Incident State Machine
 * @file lib/store/operationalMachine.ts
 *
 * Reducer pur (fără side-effects) care guvernează stările sistemului
 * operațional al Hotel Terra.
 *
 * Design:
 *   • Funcție pură: aceleași acțiuni → același output
 *   • Imutabil: niciun obiect de input nu este mutat
 *   • Tip-safe: discriminated union actions
 *   • Testabil: nu depinde de module externe
 *
 * Fluxul de date:
 *   Supabase Realtime INSERT
 *     → OperationalProvider.dispatch(INCIDENT_RECEIVED)
 *       → reducer → nouă stare
 *         → React re-render → UI actualizat
 *         → menuAvailabilityMatrix actualizat
 *         → terraceAlertPayload setat
 */

import type {
  OperationalMachineContext,
  OperationalAction,
  OperationalIncident,
  MenuAvailabilityMatrix,
  TerraceAlertPayload,
  MachineStatus,
} from '@/types/operational';
import { SEVERITY_ORDER } from '@/types/operational';

// ---------------------------------------------------------------------------
// STAREA INIȚIALĂ
// ---------------------------------------------------------------------------

export const INITIAL_STATE: OperationalMachineContext = {
  status:                  'MONITORING',
  activeIncidents:         [],
  menuAvailabilityMatrix:  {},
  terraceAlertPayload:     null,
  realtimeStatus:          'connecting',
  lastEventAt:             null,
};

// ---------------------------------------------------------------------------
// UTILITĂȚI PURE
// ---------------------------------------------------------------------------

/** Sortează incidentele după severitate + created_at (cele mai urgente primul) */
function sortByUrgency(incidents: OperationalIncident[]): OperationalIncident[] {
  return [...incidents].sort((a, b) => {
    const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (diff !== 0) return diff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

/**
 * Actualizează matricea de disponibilitate a meniului.
 * Parcurge toate incidentele active și marchează item-urile afectate.
 *
 * Un item devine disponibil din nou DOAR dacă niciun incident activ
 * nu îl mai referențiază (logică multi-incident safe).
 */
function rebuildMenuMatrix(
  incidents: OperationalIncident[],
): MenuAvailabilityMatrix {
  const matrix: MenuAvailabilityMatrix = {};

  // Colectăm toate blocajele active
  for (const incident of incidents) {
    if (incident.status === 'resolved') continue;
    for (const itemCode of incident.affected_menu_items) {
      // Dacă itemul e deja blocat de un incident mai sever, îl păstrăm
      const existing = matrix[itemCode];
      if (!existing || SEVERITY_ORDER[incident.severity] < SEVERITY_ORDER[
        incidents.find(i => i.id === existing.blockedByIncidentId)?.severity ?? 'low'
      ]) {
        matrix[itemCode] = {
          itemCode,
          isAvailable:              false,
          blockedByIncidentId:      incident.id,
          estimatedRestoreMinutes:  incident.estimated_resolution_minutes,
        };
      }
    }
  }

  return matrix;
}

/**
 * Construiește payload-ul de alertă pentru Terasa când apare un incident nou.
 * Generează un mesaj descriptiv anonim (fără PII).
 */
function buildTerraceAlertPayload(
  incident: OperationalIncident,
): TerraceAlertPayload {
  const zoneLabels: Record<string, string> = {
    kitchen:          'Bucătărie',
    pool_bar:         'Pool Bar',
    terrace_service:  'Terasă',
  };
  const categoryLabels: Record<string, string> = {
    supply_shortage:   'lipsă aprovizionare',
    equipment_failure: 'defecțiune echipament',
    service_delay:     'întârziere serviciu',
    quality_issue:     'problemă calitate',
    inventory_count:   'discrepanță inventar',
  };

  const zone    = zoneLabels[incident.zone]    ?? incident.zone;
  const cat     = categoryLabels[incident.category] ?? incident.category;
  const delay   = incident.estimated_resolution_minutes;
  const itemCnt = incident.affected_menu_items.length;

  const message = itemCnt > 0
    ? `${zone}: ${cat} — ${itemCnt} preparat${itemCnt > 1 ? 'e' : ''} temporar indisponibil${itemCnt > 1 ? 'e' : ''}${delay ? `. Reluare estimată în ~${delay} min.` : '.'}`
    : `${zone}: ${cat} raportat${delay ? `. Estimat: ~${delay} min.` : '.'}`;

  return {
    incidentId:             incident.id,
    zone:                   incident.zone,
    severity:               incident.severity,
    category:               incident.category,
    affectedItemCount:      itemCnt,
    estimatedDelayMinutes:  delay,
    message,
    issuedAt:               new Date().toISOString(),
  };
}

/**
 * Determină starea mașinii pe baza incidentelor active.
 * Logica de tranziție implicită la fiecare re-calcul.
 */
function inferStatus(
  incidents: OperationalIncident[],
  previousStatus: MachineStatus,
): MachineStatus {
  const hasOpen         = incidents.some(i => i.status === 'open');
  const hasAcknowledged = incidents.some(i => i.status === 'acknowledged');
  const allEmpty        = incidents.length === 0;

  if (allEmpty)        return 'MONITORING';
  if (hasOpen)         return previousStatus === 'MONITORING' ? 'INCIDENT_DETECTED' : previousStatus;
  if (hasAcknowledged) return 'ACKNOWLEDGED';
  return 'MONITORING';
}

// ---------------------------------------------------------------------------
// REDUCER PRINCIPAL
// ---------------------------------------------------------------------------

export function operationalReducer(
  state: OperationalMachineContext,
  action: OperationalAction,
): OperationalMachineContext {
  switch (action.type) {

    // ── Realtime Connection Status ─────────────────────────────────────────
    case 'REALTIME_CONNECTED':
      return { ...state, realtimeStatus: 'connected' };

    case 'REALTIME_CONNECTING':
      return { ...state, realtimeStatus: 'connecting' };

    case 'REALTIME_DISCONNECTED':
      return { ...state, realtimeStatus: 'disconnected' };

    case 'REALTIME_ERROR':
      return { ...state, realtimeStatus: 'error' };

    // ── INCIDENT_RECEIVED: INSERT din Supabase Realtime ───────────────────
    case 'INCIDENT_RECEIVED': {
      const incident  = action.payload;
      // Evităm duplicate (idempotent la retry-uri Realtime)
      const alreadyExists = state.activeIncidents.some(i => i.id === incident.id);
      if (alreadyExists) return state;

      const nextIncidents = sortByUrgency([...state.activeIncidents, incident]);
      const nextMatrix    = rebuildMenuMatrix(nextIncidents);
      const nextAlert     = incident.affected_menu_items.length > 0 || incident.zone !== 'terrace_service'
        ? buildTerraceAlertPayload(incident)
        : state.terraceAlertPayload;

      return {
        ...state,
        status:                 'INCIDENT_DETECTED',
        activeIncidents:        nextIncidents,
        menuAvailabilityMatrix: nextMatrix,
        terraceAlertPayload:    nextAlert,
        lastEventAt:            new Date().toISOString(),
      };
    }

    // ── INCIDENT_ACKNOWLEDGED: UPDATE din Supabase Realtime ───────────────
    case 'INCIDENT_ACKNOWLEDGED': {
      const nextIncidents = state.activeIncidents.map(i =>
        i.id === action.payload.id
          ? { ...i, status: 'acknowledged' as const, acknowledged_at: new Date().toISOString() }
          : i
      );
      return {
        ...state,
        status:          'ACKNOWLEDGED',
        activeIncidents: sortByUrgency(nextIncidents),
        lastEventAt:     new Date().toISOString(),
      };
    }

    // ── INCIDENT_RESOLVED: UPDATE din Supabase Realtime ──────────────────
    case 'INCIDENT_RESOLVED': {
      // Scoatem incidentul din lista activă
      const nextIncidents = state.activeIncidents.filter(i => i.id !== action.payload.id);
      const nextMatrix    = rebuildMenuMatrix(nextIncidents);

      // Ștergem alerta terasei dacă nu mai există incidente active care o generau
      const nextAlert = nextIncidents.length === 0
        ? null
        : state.terraceAlertPayload?.incidentId === action.payload.id
          ? nextIncidents.length > 0
            ? buildTerraceAlertPayload(nextIncidents[0])
            : null
          : state.terraceAlertPayload;

      return {
        ...state,
        status:                 inferStatus(nextIncidents, state.status),
        activeIncidents:        nextIncidents,
        menuAvailabilityMatrix: nextMatrix,
        terraceAlertPayload:    nextAlert,
        lastEventAt:            new Date().toISOString(),
      };
    }

    // ── MATRIX_UPDATED: confirmă că UI-ul a procesat actualizarea ─────────
    case 'MATRIX_UPDATED':
      return {
        ...state,
        status: state.status === 'INCIDENT_DETECTED' ? 'DISPATCHING' : state.status,
      };

    // ── TERRACE_NOTIFIED: confirmă trimiterea alertei ─────────────────────
    case 'TERRACE_NOTIFIED':
      return {
        ...state,
        status: state.status === 'DISPATCHING' ? 'NOTIFYING' : state.status,
      };

    // ── HYDRATE: boot cu incidente deja deschise ──────────────────────────
    case 'HYDRATE': {
      const incidents  = sortByUrgency(action.payload);
      const matrix     = rebuildMenuMatrix(incidents);
      const hasOpen    = incidents.some(i => i.status === 'open');
      const alert      = hasOpen ? buildTerraceAlertPayload(incidents[0]) : null;

      return {
        ...state,
        status:                 incidents.length > 0 ? 'ACKNOWLEDGED' : 'MONITORING',
        activeIncidents:        incidents,
        menuAvailabilityMatrix: matrix,
        terraceAlertPayload:    alert,
      };
    }

    // ── RESET: întoarcere la MONITORING ──────────────────────────────────
    case 'RESET':
      return {
        ...INITIAL_STATE,
        realtimeStatus: state.realtimeStatus, // păstrăm conexiunea
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// SELECTORI (pur, fără side-effects)
// ---------------------------------------------------------------------------

export function selectCriticalCount(state: OperationalMachineContext): number {
  return state.activeIncidents.filter(
    i => (i.severity === 'critical' || i.severity === 'high') && i.status !== 'resolved'
  ).length;
}

export function selectIncidentsByZone(
  state: OperationalMachineContext,
  zone: OperationalIncident['zone'],
): OperationalIncident[] {
  return state.activeIncidents.filter(i => i.zone === zone);
}

export function selectMenuItemAvailability(
  state: OperationalMachineContext,
  itemCode: string,
): boolean {
  return state.menuAvailabilityMatrix[itemCode]?.isAvailable ?? true;
}

export function selectHasActiveAlert(state: OperationalMachineContext): boolean {
  return state.terraceAlertPayload !== null;
}
