"use client";

/**
 * Project Aether — IncidentDispatcher
 * @file components/dashboard/operational/IncidentDispatcher.tsx
 *
 * Panoul de raportare a incidentelor operaționale pentru Chef și Barman.
 *
 * Design: Hardware Control Panel Premium
 *   • Estetica unui panou de control industrial (submarine / server room)
 *   • Zone iluminate cu neon glow colorat (Kitchen=amber, Bar=cyan, Terrace=emerald)
 *   • Alarm nodes cu animație de puls la severitate high/critical
 *   • Font monospace pentru date operaționale
 *   • Status LED pentru conexiunea Realtime
 *   • Integrat în design token-urile Operational Calm ale proiectului
 *
 * Zero-PII: componenta nu colectează sau afișează date personale.
 */

import React, { useState, useCallback, useId } from 'react';
import { useOperational, useIncidentSubmit } from '@/components/providers/OperationalProvider';
import { supabase } from '@/lib/supabase';
import {
  ZONE_CONFIGS,
  SEVERITY_CONFIGS,
  CATEGORY_LABELS,
  type OperationalZone,
  type IncidentCategory,
  type IncidentSeverity,
} from '@/types/operational';

// ---------------------------------------------------------------------------
// TIPURI LOCALE
// ---------------------------------------------------------------------------

interface FormState {
  zone:                    OperationalZone;
  category:                IncidentCategory;
  severity:                IncidentSeverity;
  item_code:               string;
  affected_menu_items_raw: string; // CSV input: 'MENU-OCT-01, MENU-OCT-SALAD'
  notes:                   string;
  estimated_resolution_minutes: string; // string pentru input[type=number]
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

// ---------------------------------------------------------------------------
// CONSTANTE
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  zone:                         'kitchen',
  category:                     'supply_shortage',
  severity:                     'medium',
  item_code:                    '',
  affected_menu_items_raw:      '',
  notes:                        '',
  estimated_resolution_minutes: '',
};

// ---------------------------------------------------------------------------
// SUB-COMPONENTE
// ---------------------------------------------------------------------------

/** LED de status conexiune Realtime */
function ConnectionLed({ status }: { status: string }) {
  const config = {
    connected:    { color: '#69ff47', label: 'LIVE',       pulse: true  },
    connecting:   { color: '#d4a843', label: 'CONN…',      pulse: true  },
    disconnected: { color: '#c24d4d', label: 'OFFLINE',    pulse: false },
    error:        { color: '#c24d4d', label: 'ERR',        pulse: true  },
  }[status] ?? { color: '#52483c', label: '---', pulse: false };

  return (
    <span className="opd-led-row">
      <span
        className="opd-led"
        style={{
          background:    config.color,
          boxShadow:     config.pulse
            ? `0 0 6px ${config.color}, 0 0 12px ${config.color}`
            : 'none',
          animation:     config.pulse ? 'opd-pulse-led 2.4s infinite' : 'none',
        }}
      />
      <span className="opd-led-label">{config.label}</span>
    </span>
  );
}

/** Alarm node iluminat per incidentele active dintr-o zonă */
function ZoneAlarmNode({
  neonColor,
  neonGlow,
  count,
  hasCritical,
}: {
  neonColor:  string;
  neonGlow:   string;
  count:      number;
  hasCritical: boolean;
}) {
  if (count === 0) {
    return (
      <span
        className="opd-zone-node opd-zone-node--idle"
        style={{ borderColor: 'var(--border)' }}
      />
    );
  }
  return (
    <span
      className={`opd-zone-node opd-zone-node--active ${hasCritical ? 'opd-zone-node--blink' : ''}`}
      style={{
        borderColor: neonColor,
        background:  neonGlow,
        boxShadow:   `0 0 8px ${neonColor}, 0 0 16px ${neonGlow}`,
        color:       neonColor,
      }}
    >
      {count}
    </span>
  );
}

/** Riga din log-ul de incidente active */
function IncidentRow({
  incident,
  onAcknowledge,
}: {
  incident: import('@/types/operational').OperationalIncident;
  onAcknowledge: (id: string) => void;
}) {
  const zone   = ZONE_CONFIGS.find(z => z.key === incident.zone);
  const sevCfg = SEVERITY_CONFIGS[incident.severity];
  const age    = Math.floor((Date.now() - new Date(incident.created_at).getTime()) / 60000);

  return (
    <div
      className="opd-incident-row"
      style={{
        borderLeft: `2px solid ${sevCfg.color}`,
        boxShadow: sevCfg.pulse
          ? `inset 0 0 20px rgba(0,0,0,0.3), -1px 0 8px ${sevCfg.color}40`
          : undefined,
      }}
    >
      <div className="opd-incident-row__left">
        <span
          className="opd-incident-badge"
          style={{
            color:      sevCfg.color,
            borderColor: sevCfg.color,
            boxShadow:  sevCfg.pulse ? `0 0 6px ${sevCfg.color}` : 'none',
          }}
        >
          {sevCfg.label}
        </span>
        <span
          className="opd-incident-zone"
          style={{ color: zone?.neonColor ?? 'var(--text-2)' }}
        >
          {zone?.shortLabel ?? incident.zone.toUpperCase()}
        </span>
        <span className="opd-incident-category">
          {CATEGORY_LABELS[incident.category]}
        </span>
        {incident.item_code && (
          <span className="opd-incident-item-code num">{incident.item_code}</span>
        )}
      </div>
      <div className="opd-incident-row__right">
        <span className="opd-incident-age num">{age}m</span>
        {incident.status === 'open' && (
          <button
            className="opd-ack-btn"
            onClick={() => onAcknowledge(incident.id)}
            aria-label={`Acknowledge incident ${incident.id}`}
          >
            ACK
          </button>
        )}
        {incident.status === 'acknowledged' && (
          <span className="opd-ack-label">ACK'd</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTA PRINCIPALĂ
// ---------------------------------------------------------------------------

export default function IncidentDispatcher() {
  const { state, dispatch, activeIncidentsBySeverity, criticalCount } = useOperational();
  const { submit } = useIncidentSubmit();

  const [form, setForm]         = useState<FormState>(INITIAL_FORM);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [submitError, setSubmitError]   = useState<string | null>(null);

  const formId = useId();

  // ── Handlers ─────────────────────────────────────────────────────────────
  const setField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleAcknowledge = useCallback(async (id: string) => {
    await supabaseAck(id);
    dispatch({ type: 'INCIDENT_ACKNOWLEDGED', payload: { id } });
  }, [dispatch]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitStatus === 'submitting') return;

    setSubmitStatus('submitting');
    setSubmitError(null);

    const affectedItems = form.affected_menu_items_raw
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    const { success, error } = await submit({
      zone:                         form.zone,
      category:                     form.category,
      severity:                     form.severity,
      item_code:                    form.item_code.trim() || null,
      affected_menu_items:          affectedItems,
      notes:                        form.notes.trim() || null,
      estimated_resolution_minutes: form.estimated_resolution_minutes
        ? parseInt(form.estimated_resolution_minutes, 10)
        : null,
    });

    if (success) {
      setSubmitStatus('success');
      setForm(INITIAL_FORM);
      setTimeout(() => setSubmitStatus('idle'), 2500);
    } else {
      setSubmitStatus('error');
      setSubmitError(error ?? 'Eroare necunoscută');
      setTimeout(() => setSubmitStatus('idle'), 4000);
    }
  }, [form, submit, submitStatus]);

  // ── Stare calculată ───────────────────────────────────────────────────────
  const selectedZoneConfig = ZONE_CONFIGS.find(z => z.key === form.zone)!;

  return (
    <>
      {/* Keyframes și stiluri scoped */}
      <style>{`
        @keyframes opd-pulse-led {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes opd-blink-alarm {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.94); }
        }
        @keyframes opd-success-flash {
          0%   { background: rgba(105, 255, 71, 0.15); }
          100% { background: transparent; }
        }

        .opd-shell {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: var(--text);
        }

        /* ── Header ──────────────────────────────────────────── */
        .opd-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
        }
        .opd-header__title {
          font-size: 11px;
          letter-spacing: 0.12em;
          color: var(--text-2);
          text-transform: uppercase;
        }
        .opd-header__badge {
          font-size: 10px;
          background: var(--elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 2px 7px;
          color: var(--text-3);
        }
        .opd-header__right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .opd-led-row {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .opd-led {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 9999px;
          flex-shrink: 0;
        }
        .opd-led-label {
          font-size: 10px;
          letter-spacing: 0.06em;
          color: var(--text-2);
        }

        /* Critical counter badge */
        .opd-critical-badge {
          font-size: 10px;
          font-weight: 600;
          background: #c24d4d22;
          border: 1px solid #c24d4d44;
          color: #c24d4d;
          border-radius: 4px;
          padding: 2px 8px;
          letter-spacing: 0.06em;
        }

        /* ── Body: form + log side-by-side ───────────────────── */
        .opd-body {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* ── Form (left pane) ─────────────────────────────────── */
        .opd-form-pane {
          flex: 0 0 280px;
          border-right: 1px solid var(--border);
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .opd-section-label {
          font-size: 9px;
          letter-spacing: 0.14em;
          color: var(--text-3);
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        /* Zone selector */
        .opd-zone-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .opd-zone-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 4px 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          font-family: inherit;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--text-2);
        }
        .opd-zone-btn:hover {
          color: var(--text);
          border-color: var(--text-3);
        }
        .opd-zone-btn--active {
          color: var(--text);
        }
        .opd-zone-icon {
          font-size: 18px;
          line-height: 1;
        }
        .opd-zone-node {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          border: 1px solid;
          font-size: 8px;
          font-family: var(--font-geist-mono), monospace;
          font-weight: 700;
          flex-shrink: 0;
        }
        .opd-zone-node--idle { opacity: 0.3; }
        .opd-zone-node--active { opacity: 1; }
        .opd-zone-node--blink {
          animation: opd-blink-alarm 1s infinite;
        }

        /* Category selector */
        .opd-category-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .opd-category-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 9px;
          background: transparent;
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          color: var(--text-2);
          text-align: left;
          transition: all 0.12s;
        }
        .opd-category-btn:hover { color: var(--text); border-color: var(--text-3); }
        .opd-category-btn--active {
          color: var(--text);
          background: var(--elevated);
          border-color: var(--border);
        }
        .opd-cat-dot {
          width: 5px; height: 5px;
          border-radius: 9999px;
          background: var(--accent);
          flex-shrink: 0;
          opacity: 0;
        }
        .opd-category-btn--active .opd-cat-dot { opacity: 1; }

        /* Severity rail */
        .opd-severity-rail {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
        }
        .opd-sev-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 7px 2px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 7px;
          cursor: pointer;
          font-family: inherit;
          font-size: 9px;
          letter-spacing: 0.08em;
          color: var(--text-3);
          transition: all 0.12s;
        }
        .opd-sev-btn:hover { border-color: var(--text-3); color: var(--text-2); }
        .opd-sev-indicator {
          width: 8px; height: 8px;
          border-radius: 9999px;
          border: 1.5px solid currentColor;
        }
        .opd-sev-btn--active .opd-sev-indicator {
          background: currentColor;
        }

        /* Text inputs */
        .opd-input {
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 7px;
          padding: 7px 10px;
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          color: var(--text);
          outline: none;
          transition: border-color 0.12s;
        }
        .opd-input:focus { border-color: var(--accent); }
        .opd-input::placeholder { color: var(--text-3); }
        .opd-textarea {
          resize: vertical;
          min-height: 60px;
          max-height: 120px;
          line-height: 1.5;
        }

        /* Submit button */
        .opd-submit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 11px;
          border-radius: 9px;
          border: 1px solid;
          cursor: pointer;
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          transition: all 0.15s;
        }
        .opd-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .opd-submit-btn--idle {
          background: var(--elevated);
          border-color: var(--border);
          color: var(--text-2);
        }
        .opd-submit-btn--idle:hover:not(:disabled) {
          color: var(--text);
          border-color: var(--text-3);
        }
        .opd-submit-btn--active {
          color: var(--text);
        }
        .opd-submit-btn--submitting { opacity: 0.7; }
        .opd-submit-btn--success {
          color: #69ff47;
          background: rgba(105, 255, 71, 0.08);
          border-color: #69ff47;
          box-shadow: 0 0 10px rgba(105, 255, 71, 0.2);
        }
        .opd-submit-btn--error {
          color: #c24d4d;
          background: rgba(194, 77, 77, 0.08);
          border-color: #c24d4d;
        }
        .opd-error-msg {
          font-size: 10px;
          color: #c24d4d;
          margin-top: 4px;
        }

        /* ── Log (right pane) ─────────────────────────────────── */
        .opd-log-pane {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
        }
        .opd-log-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .opd-log-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: var(--text-3);
          font-size: 11px;
          letter-spacing: 0.06em;
        }
        .opd-log-empty-icon {
          font-size: 28px;
          opacity: 0.4;
        }

        /* Matrix summary */
        .opd-matrix-bar {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 12px;
          flex-shrink: 0;
        }
        .opd-matrix-title {
          font-size: 9px;
          letter-spacing: 0.12em;
          color: var(--text-3);
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .opd-matrix-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .opd-matrix-chip {
          font-size: 9px;
          font-family: var(--font-geist-mono), monospace;
          border-radius: 4px;
          padding: 2px 6px;
          border: 1px solid;
          letter-spacing: 0.05em;
        }
        .opd-matrix-chip--blocked {
          color: #c24d4d;
          border-color: #c24d4d44;
          background: #c24d4d11;
        }

        /* Incident rows */
        .opd-incident-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 9px 10px;
          min-width: 0;
        }
        .opd-incident-row__left {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
          flex: 1;
          flex-wrap: wrap;
        }
        .opd-incident-row__right {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
        }
        .opd-incident-badge {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.10em;
          border: 1px solid;
          border-radius: 4px;
          padding: 1px 5px;
          flex-shrink: 0;
        }
        .opd-incident-zone {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          flex-shrink: 0;
        }
        .opd-incident-category {
          font-size: 11px;
          color: var(--text-2);
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .opd-incident-item-code {
          font-size: 10px;
          color: var(--text-3);
          background: var(--elevated);
          border-radius: 3px;
          padding: 1px 5px;
          flex-shrink: 0;
        }
        .opd-incident-age {
          font-size: 10px;
          color: var(--text-3);
        }
        .opd-ack-btn {
          font-size: 9px;
          font-family: inherit;
          font-weight: 700;
          letter-spacing: 0.10em;
          padding: 3px 7px;
          border: 1px solid var(--accent);
          border-radius: 4px;
          background: var(--accent-soft);
          color: var(--accent);
          cursor: pointer;
          transition: all 0.12s;
        }
        .opd-ack-btn:hover {
          background: var(--accent);
          color: var(--bg);
        }
        .opd-ack-label {
          font-size: 9px;
          color: var(--text-3);
          letter-spacing: 0.08em;
        }

        /* Terrace alert banner */
        .opd-terrace-alert {
          border-radius: 8px;
          border: 1px solid;
          padding: 9px 12px;
          flex-shrink: 0;
        }
        .opd-terrace-alert__header {
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .opd-terrace-alert__msg {
          font-size: 11px;
          line-height: 1.5;
        }
      `}</style>

      <div className="opd-shell">

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="opd-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="opd-header__title">Operations Control</span>
            <span className="opd-header__badge">TERRA NEPTUN</span>
          </div>
          <div className="opd-header__right">
            {criticalCount > 0 && (
              <span className="opd-critical-badge">
                ▲ {criticalCount} ALERT{criticalCount > 1 ? 'S' : ''}
              </span>
            )}
            <ConnectionLed status={state.realtimeStatus} />
          </div>
        </div>

        {/* ── BODY ────────────────────────────────────────────────────── */}
        <div className="opd-body">

          {/* ── FORM PANE (stânga) ─────────────────────────────────── */}
          <form
            id={formId}
            onSubmit={handleSubmit}
            className="opd-form-pane"
            aria-label="Raportare incident operațional"
          >

            {/* Zone selector */}
            <div>
              <div className="opd-section-label">Zona</div>
              <div className="opd-zone-grid">
                {ZONE_CONFIGS.map(zone => {
                  const incidentsInZone = activeIncidentsBySeverity.filter(i => i.zone === zone.key);
                  const hasCrit = incidentsInZone.some(i => i.severity === 'critical' || i.severity === 'high');
                  const isSelected = form.zone === zone.key;
                  return (
                    <button
                      key={zone.key}
                      type="button"
                      className={`opd-zone-btn ${isSelected ? 'opd-zone-btn--active' : ''}`}
                      onClick={() => setField('zone', zone.key)}
                      aria-pressed={isSelected}
                      style={isSelected ? {
                        borderColor: zone.neonColor,
                        boxShadow:   `0 0 0 1px ${zone.neonColor}40, 0 0 12px ${zone.neonGlow}`,
                        background:  zone.neonGlow,
                        color:       zone.neonColor,
                      } : undefined}
                    >
                      <span className="opd-zone-icon">{zone.icon}</span>
                      <span style={{ fontSize: 9, letterSpacing: '0.08em' }}>
                        {zone.shortLabel}
                      </span>
                      <ZoneAlarmNode
                        neonColor={zone.neonColor}
                        neonGlow={zone.neonGlow}
                        count={incidentsInZone.length}
                        hasCritical={hasCrit}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category selector */}
            <div>
              <div className="opd-section-label">Categorie</div>
              <div className="opd-category-list">
                {(Object.entries(CATEGORY_LABELS) as [IncidentCategory, string][]).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`opd-category-btn ${form.category === key ? 'opd-category-btn--active' : ''}`}
                      onClick={() => setField('category', key)}
                      aria-pressed={form.category === key}
                    >
                      <span className="opd-cat-dot" />
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Severity rail */}
            <div>
              <div className="opd-section-label">Severitate</div>
              <div className="opd-severity-rail">
                {(Object.entries(SEVERITY_CONFIGS) as [IncidentSeverity, typeof SEVERITY_CONFIGS[IncidentSeverity]][]).map(
                  ([key, cfg]) => {
                    const isSelected = form.severity === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`opd-sev-btn ${isSelected ? 'opd-sev-btn--active' : ''}`}
                        onClick={() => setField('severity', key)}
                        aria-pressed={isSelected}
                        style={{
                          color:       isSelected ? cfg.color : undefined,
                          borderColor: isSelected ? `${cfg.color}66` : undefined,
                          background:  isSelected ? `${cfg.color}11` : undefined,
                          boxShadow:   isSelected && cfg.pulse
                            ? `0 0 8px ${cfg.color}40`
                            : undefined,
                        }}
                      >
                        <span
                          className="opd-sev-indicator"
                          style={{ color: isSelected ? cfg.color : undefined }}
                        />
                        {cfg.label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Cod articol */}
            <div>
              <div className="opd-section-label">Cod Articol (SKU)</div>
              <input
                className="opd-input"
                placeholder="ex: SKU-OCTOPUS-01"
                value={form.item_code}
                onChange={e => setField('item_code', e.target.value)}
                maxLength={100}
                autoComplete="off"
              />
            </div>

            {/* Meniu afectat */}
            <div>
              <div className="opd-section-label">Meniu Afectat (cod, separare prin virgulă)</div>
              <input
                className="opd-input"
                placeholder="ex: MENU-OCT-01, MENU-OCT-SALAD"
                value={form.affected_menu_items_raw}
                onChange={e => setField('affected_menu_items_raw', e.target.value)}
                maxLength={500}
                autoComplete="off"
              />
            </div>

            {/* Timp estimat */}
            <div>
              <div className="opd-section-label">Timp Estimat Rezolvare (min)</div>
              <input
                className="opd-input"
                type="number"
                placeholder="ex: 30"
                min={1}
                max={480}
                value={form.estimated_resolution_minutes}
                onChange={e => setField('estimated_resolution_minutes', e.target.value)}
              />
            </div>

            {/* Note */}
            <div>
              <div className="opd-section-label">Note (fără date personale)</div>
              <textarea
                className="opd-input opd-textarea"
                placeholder="ex: Stoc epuizat, comanda plasată..."
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                maxLength={500}
              />
            </div>

            {/* Submit */}
            <div>
              <button
                type="submit"
                form={formId}
                disabled={submitStatus === 'submitting'}
                className={`opd-submit-btn opd-submit-btn--${
                  submitStatus === 'idle' && form.zone
                    ? 'active'
                    : submitStatus
                }`}
                style={
                  submitStatus === 'idle'
                    ? {
                        borderColor:  selectedZoneConfig.neonColor,
                        color:        selectedZoneConfig.neonColor,
                        background:   selectedZoneConfig.neonGlow,
                        boxShadow:    `0 0 12px ${selectedZoneConfig.neonGlow}`,
                      }
                    : undefined
                }
              >
                {submitStatus === 'submitting' && '⟳ DISPATCH…'}
                {submitStatus === 'success'    && '✓ INCIDENT DISPATCHED'}
                {submitStatus === 'error'      && '✗ DISPATCH FAILED'}
                {submitStatus === 'idle'       && (
                  <>
                    <span style={{ fontSize: 14 }}>{selectedZoneConfig.icon}</span>
                    DISPATCH INCIDENT
                  </>
                )}
              </button>
              {submitStatus === 'error' && submitError && (
                <div className="opd-error-msg">{submitError}</div>
              )}
            </div>
          </form>

          {/* ── LOG PANE (dreapta) ──────────────────────────────────── */}
          <div className="opd-log-pane">

            {/* Header log */}
            <div className="opd-log-header">
              <span className="opd-section-label" style={{ margin: 0 }}>
                Incidente Active — {activeIncidentsBySeverity.length}
              </span>
            </div>

            {/* Terrace alert banner */}
            {state.terraceAlertPayload && (
              <div
                className="opd-terrace-alert"
                style={{
                  borderColor:  '#7fb06966',
                  background:   'rgba(127, 176, 105, 0.07)',
                }}
                role="alert"
                aria-live="assertive"
              >
                <div
                  className="opd-terrace-alert__header"
                  style={{ color: '#7fb069' }}
                >
                  <span>◌</span>
                  <span>NOTIFICARE TERASĂ</span>
                  <ConnectionLed status="connected" />
                </div>
                <div className="opd-terrace-alert__msg" style={{ color: 'var(--text-2)' }}>
                  {state.terraceAlertPayload.message}
                </div>
              </div>
            )}

            {/* Matricea de disponibilitate */}
            {Object.keys(state.menuAvailabilityMatrix).length > 0 && (
              <div className="opd-matrix-bar">
                <div className="opd-matrix-title">▪ Meniu — Articole Blocate</div>
                <div className="opd-matrix-chips">
                  {Object.values(state.menuAvailabilityMatrix).map(entry => (
                    <span key={entry.itemCode} className="opd-matrix-chip opd-matrix-chip--blocked">
                      {entry.itemCode}
                      {entry.estimatedRestoreMinutes && (
                        <span style={{ opacity: 0.6 }}> ~{entry.estimatedRestoreMinutes}m</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lista incidente */}
            {activeIncidentsBySeverity.length === 0 ? (
              <div className="opd-log-empty">
                <span className="opd-log-empty-icon">◎</span>
                <span>SISTEM OPERAȚIONAL NOMINAL</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>Niciun incident activ</span>
              </div>
            ) : (
              activeIncidentsBySeverity.map(incident => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  onAcknowledge={handleAcknowledge}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// UTILITAR LOCAL: acknowledge un incident în Supabase
// Supabase client este un singleton stabil — import static, fără dynamic import.
// ---------------------------------------------------------------------------
async function supabaseAck(id: string): Promise<void> {
  await supabase
    .from('operational_incidents')
    .update({ status: 'acknowledged' })
    .eq('id', id)
    .eq('status', 'open');
}
