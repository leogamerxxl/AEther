/**
 * Project Aether — Operational Incident System: Type Contracts
 * @file types/operational.ts
 *
 * Zero-PII: niciun câmp nu conține identificatori personali.
 * Toate entitățile reprezintă stări de sistem și coduri de inventar.
 */

// ---------------------------------------------------------------------------
// ENUMS & CONSTANTE
// ---------------------------------------------------------------------------

export type OperationalZone =
  | 'kitchen'
  | 'pool_bar'
  | 'terrace_service';

export type IncidentCategory =
  | 'supply_shortage'
  | 'equipment_failure'
  | 'service_delay'
  | 'quality_issue'
  | 'inventory_count';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus = 'open' | 'acknowledged' | 'resolved' | 'escalated';

/** Status-ul conexiunii WebSocket Supabase Realtime */
export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

// ---------------------------------------------------------------------------
// INCIDENT (corespunde tabelului `operational_incidents`)
// ---------------------------------------------------------------------------

export interface OperationalIncident {
  id: string;                         // UUID anonim
  zone: OperationalZone;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  item_code: string | null;           // Cod SKU anonim
  affected_menu_items: string[];      // Coduri meniu afectate (ex: 'MENU-OCT-01')
  notes: string | null;               // Text liber, fără PII
  estimated_resolution_minutes: number | null;
  created_at: string;                 // ISO 8601 UTC
  acknowledged_at: string | null;
  resolved_at: string | null;
  source_client: string;
}

// ---------------------------------------------------------------------------
// MATRICEA DE DISPONIBILITATE MENIU
// Starea curentă a articolelor din meniul digital al oaspeților.
// Actualizată automat când apar incidente cu `affected_menu_items`.
// ---------------------------------------------------------------------------

export interface MenuAvailabilityEntry {
  itemCode: string;
  isAvailable: boolean;
  /** ID-ul incidentului care a cauzat indisponibilitatea */
  blockedByIncidentId: string | null;
  /** Minutele estimate până la reactivare */
  estimatedRestoreMinutes: number | null;
}

export type MenuAvailabilityMatrix = Record<string, MenuAvailabilityEntry>;

// ---------------------------------------------------------------------------
// PAYLOAD ALERTĂ TERASĂ
// Trimis de OperationalProvider către TerraceAdminPanel
// când un incident afectează timpii de așteptare.
// ---------------------------------------------------------------------------

export interface TerraceAlertPayload {
  incidentId: string;
  zone: OperationalZone;
  severity: IncidentSeverity;
  category: IncidentCategory;
  affectedItemCount: number;
  estimatedDelayMinutes: number | null;
  message: string;          // Text generat automat, fără PII
  issuedAt: string;         // ISO 8601 UTC
}

// ---------------------------------------------------------------------------
// MAȘINA DE STĂRI OPERAȚIONALE
// ---------------------------------------------------------------------------

/**
 * Stările posibile ale mașinii.
 *
 * Flux:
 *   MONITORING
 *     → [INCIDENT_RECEIVED]
 *   INCIDENT_DETECTED
 *     → [DISPATCH_STARTED]  (auto, 400ms)
 *   DISPATCHING
 *     → [MATRIX_UPDATED + TERRACE_NOTIFIED]  (auto, 200ms)
 *   NOTIFYING
 *     → [INCIDENT_ACKNOWLEDGED]
 *   ACKNOWLEDGED
 *     → [INCIDENT_RESOLVED]
 *   MONITORING   ← reset
 *
 * La orice moment, un INCIDENT_RECEIVED suplimentar
 * se acumulează în `activeIncidents` fără a reseta starea.
 */
export type MachineStatus =
  | 'MONITORING'
  | 'INCIDENT_DETECTED'
  | 'DISPATCHING'
  | 'NOTIFYING'
  | 'ACKNOWLEDGED';

/** Context complet al mașinii de stări */
export interface OperationalMachineContext {
  status: MachineStatus;
  /** Lista incidentelor active (open / acknowledged) */
  activeIncidents: OperationalIncident[];
  /** Matricea de disponibilitate a meniului digital */
  menuAvailabilityMatrix: MenuAvailabilityMatrix;
  /** Payload trimis terasei (null dacă nu există alertă activă) */
  terraceAlertPayload: TerraceAlertPayload | null;
  /** Status conexiune Realtime */
  realtimeStatus: RealtimeConnectionStatus;
  /** Timestamp-ul ultimului eveniment primit */
  lastEventAt: string | null;
}

// ---------------------------------------------------------------------------
// ACȚIUNILE DISPATCHATE DE REDUCER
// ---------------------------------------------------------------------------

export type OperationalAction =
  | { type: 'REALTIME_CONNECTED' }
  | { type: 'REALTIME_CONNECTING' }
  | { type: 'REALTIME_DISCONNECTED' }
  | { type: 'REALTIME_ERROR' }
  /** Eveniment primit din Supabase Realtime: INSERT */
  | { type: 'INCIDENT_RECEIVED';    payload: OperationalIncident }
  /** Eveniment primit: UPDATE → acknowledged */
  | { type: 'INCIDENT_ACKNOWLEDGED'; payload: { id: string } }
  /** Eveniment primit: UPDATE → resolved */
  | { type: 'INCIDENT_RESOLVED';    payload: { id: string } }
  /** Matricea de disponibilitate a fost actualizată de engine */
  | { type: 'MATRIX_UPDATED' }
  /** Alertele terasei au fost trimise */
  | { type: 'TERRACE_NOTIFIED' }
  /** Reset complet la MONITORING (ex: la logout sau refresh) */
  | { type: 'RESET' }
  /** Injectare date istorice la boot (incidente deja deschise) */
  | { type: 'HYDRATE'; payload: OperationalIncident[] };

// ---------------------------------------------------------------------------
// TIPURI UTILITARE
// ---------------------------------------------------------------------------

/** Proprietățile contextului expus prin React Context */
export interface OperationalContextValue {
  state: OperationalMachineContext;
  dispatch: React.Dispatch<OperationalAction>;
  /** Shortcut: incidentele active sortate după severitate */
  activeIncidentsBySeverity: OperationalIncident[];
  /** Shortcut: count de incidente critice + high deschise */
  criticalCount: number;
}

/** Configurarea zonelor pentru UI */
export interface ZoneConfig {
  key: OperationalZone;
  label: string;
  shortLabel: string;
  icon: string;
  /** Culoarea neon a zonei (CSS color) */
  neonColor: string;
  /** Culoarea neon semi-transparentă pentru glow */
  neonGlow: string;
}

export const ZONE_CONFIGS: ZoneConfig[] = [
  {
    key:        'kitchen',
    label:      'Bucătărie',
    shortLabel: 'KITCHEN',
    icon:       '◈',
    neonColor:  '#ff6b2b',
    neonGlow:   'rgba(255, 107, 43, 0.25)',
  },
  {
    key:        'pool_bar',
    label:      'Pool Bar',
    shortLabel: 'POOL BAR',
    icon:       '◉',
    neonColor:  '#22d3ee',
    neonGlow:   'rgba(34, 211, 238, 0.25)',
  },
  {
    key:        'terrace_service',
    label:      'Terasă',
    shortLabel: 'TERRACE',
    icon:       '◌',
    neonColor:  '#7fb069',
    neonGlow:   'rgba(127, 176, 105, 0.25)',
  },
];

export const SEVERITY_CONFIGS = {
  low:      { label: 'LOW',      color: '#7fb069', pulse: false },
  medium:   { label: 'MED',      color: '#d4a843', pulse: false },
  high:     { label: 'HIGH',     color: '#e07b39', pulse: true  },
  critical: { label: 'CRIT',     color: '#c24d4d', pulse: true  },
} as const;

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  supply_shortage:   'Lipsă Aprovizionare',
  equipment_failure: 'Defecțiune Echipament',
  service_delay:     'Întârziere Serviciu',
  quality_issue:     'Problemă Calitate',
  inventory_count:   'Discrepanță Inventar',
};

/** Ordinea de severitate pentru sortare (1 = cel mai urgent) */
export const SEVERITY_ORDER: Record<IncidentSeverity, number> = {
  critical: 1,
  high:     2,
  medium:   3,
  low:      4,
};
