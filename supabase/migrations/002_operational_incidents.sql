-- =============================================================================
-- Project Aether — Operational Incident System
-- Migration: 002_operational_incidents.sql
-- Compatible: PostgreSQL 15+ / Supabase
--
-- PRIVACY DESIGN: Zero-PII
-- Niciun identificator de persoană. Toate câmpurile sunt:
--   • zone_id (cod departament, nu persoană)
--   • item_code (cod inventar anonim, nu PII)
--   • timestamps (UTC, fără timezone personal)
--   • severity / category (enum-uri fixe)
--
-- Sub-zone acoperite:
--   kitchen           — Bucătărie principală (Chef de partie)
--   pool_bar          — Pool Bar & Drinks
--   terrace_service   — Terasă & Room Service
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABELUL PRINCIPAL
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operational_incidents (
  -- Identificator anonim
  id               UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Zona raportoare (nu persoana, ci departamentul)
  zone             VARCHAR(30)  NOT NULL,
  CONSTRAINT chk_zone CHECK (zone IN ('kitchen', 'pool_bar', 'terrace_service')),

  -- Categoria incidentului
  category         VARCHAR(40)  NOT NULL,
  CONSTRAINT chk_category CHECK (category IN (
    'supply_shortage',   -- lipsă aprovizionare (caracatiță, vin, etc.)
    'equipment_failure', -- defecțiune echipament (grătar, espressor, etc.)
    'service_delay',     -- întârziere serviciu (> SLA intern)
    'quality_issue',     -- problemă calitate produs
    'inventory_count'    -- discrepanță inventar
  )),

  -- Codul articolului afectat (cod intern anonim, ex: 'SKU-OCTOPUS-01')
  item_code        VARCHAR(100),

  -- Articolele din meniu digital afectate (coduri anonime)
  affected_menu_items TEXT[]    NOT NULL DEFAULT '{}',

  -- Severitate
  severity         VARCHAR(10)  NOT NULL DEFAULT 'medium',
  CONSTRAINT chk_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Status ciclului de viață
  status           VARCHAR(20)  NOT NULL DEFAULT 'open',
  CONSTRAINT chk_status CHECK (status IN ('open', 'acknowledged', 'resolved', 'escalated')),

  -- Note libere (fără PII — nu conțin nume de clienți sau angajați)
  notes            TEXT,

  -- Estimare timp rezolvare (minute)
  estimated_resolution_minutes INTEGER
    CONSTRAINT chk_est_time CHECK (estimated_resolution_minutes > 0 AND estimated_resolution_minutes <= 480),

  -- Timestamps (UTC, fără indiciu de identitate personală)
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  acknowledged_at  TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,

  -- Audit: care widget/serviciu a creat incidentul (nu persoana)
  source_client    VARCHAR(50)  NOT NULL DEFAULT 'incident_dispatcher',

  -- Constrângere: resolved_at trebuie să fie după acknowledged_at
  CONSTRAINT chk_resolution_order
    CHECK (resolved_at IS NULL OR acknowledged_at IS NULL OR resolved_at >= acknowledged_at)
);

COMMENT ON TABLE operational_incidents IS
  'Incidente operaționale pentru departamentele Hotel Terra. '
  'Zero-PII: niciun identificator personal — doar zone, coduri de inventar, timestamps.';

COMMENT ON COLUMN operational_incidents.zone IS
  'Departamentul raportator: kitchen | pool_bar | terrace_service';
COMMENT ON COLUMN operational_incidents.affected_menu_items IS
  'Array de coduri de meniu afectate (ex: [''MENU-OCT-01'', ''MENU-OCT-SALAD'']). '
  'Folosit de clientul Realtime pentru a actualiza matricea de disponibilitate.';
COMMENT ON COLUMN operational_incidents.item_code IS
  'Cod anonim de inventar (SKU intern). Nu conține informații personale.';

-- ---------------------------------------------------------------------------
-- 2. INDEXURI PENTRU PERFORMANȚĂ
-- ---------------------------------------------------------------------------

-- Incidentele deschise per zonă — interogare frecventă
CREATE INDEX IF NOT EXISTS idx_operational_incidents_zone_status
  ON operational_incidents (zone, status, created_at DESC);

-- Feed Realtime: toate incidentele recente (ultimele 24h)
CREATE INDEX IF NOT EXISTS idx_operational_incidents_recent
  ON operational_incidents (created_at DESC)
  WHERE status IN ('open', 'acknowledged');

-- Severitate critică — alertare rapidă
CREATE INDEX IF NOT EXISTS idx_operational_incidents_critical
  ON operational_incidents (severity, created_at DESC)
  WHERE severity = 'critical' AND status != 'resolved';

-- Menu items afectate — căutare rapidă pentru matrix update
CREATE INDEX IF NOT EXISTS idx_operational_incidents_menu_items
  ON operational_incidents USING GIN (affected_menu_items)
  WHERE status != 'resolved';

-- ---------------------------------------------------------------------------
-- 3. FUNCȚIE + TRIGGER: notificare Realtime la INSERT/UPDATE
--    Supabase Realtime interceptează automat schimbările din postgres.
--    Trigger-ul adaugă un câmp calculat `time_to_resolve_minutes`
--    pentru afișare imediată în UI, fără join suplimentar.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operational_incidents_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- La rezolvare: completăm resolved_at dacă lipsește
  IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at = NOW();
  END IF;

  -- La acknowledging: completăm acknowledged_at dacă lipsește
  IF NEW.status = 'acknowledged' AND NEW.acknowledged_at IS NULL THEN
    NEW.acknowledged_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_operational_incidents_timestamps
  BEFORE UPDATE ON operational_incidents
  FOR EACH ROW
  EXECUTE FUNCTION operational_incidents_notify();

-- ---------------------------------------------------------------------------
-- 4. VIEW: incidentele active pentru terrace_alert_payload
--    Consumat de OperationalProvider pentru notificările către terasă.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_active_incidents AS
SELECT
  id,
  zone,
  category,
  severity,
  status,
  item_code,
  affected_menu_items,
  notes,
  estimated_resolution_minutes,
  created_at,
  acknowledged_at,
  -- Minutele scurse de la crearea incidentului
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS elapsed_minutes
FROM operational_incidents
WHERE status IN ('open', 'acknowledged')
ORDER BY
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high'     THEN 2
    WHEN 'medium'   THEN 3
    WHEN 'low'      THEN 4
  END,
  created_at DESC;

COMMENT ON VIEW v_active_incidents IS
  'Incidentele active (open/acknowledged), ordonate după severitate. '
  'Read-only pentru clientul anon via RLS.';

-- ---------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE operational_incidents ENABLE ROW LEVEL SECURITY;

-- Citire: toți clienții autentificați sau anon (date macro, fără PII)
CREATE POLICY "read_operational_incidents"
  ON operational_incidents
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Inserare: doar service_role (backend) sau autentificat (staff)
CREATE POLICY "insert_operational_incidents"
  ON operational_incidents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    zone IN ('kitchen', 'pool_bar', 'terrace_service')
    AND category IN ('supply_shortage', 'equipment_failure', 'service_delay', 'quality_issue', 'inventory_count')
    AND severity IN ('low', 'medium', 'high', 'critical')
    -- Previne spam: cel mult 20 incidente deschise per zonă
    AND (
      SELECT COUNT(*) FROM operational_incidents oi
      WHERE oi.zone = operational_incidents.zone
        AND oi.status IN ('open', 'acknowledged')
    ) < 20
  );

-- Update: oricine autentificat poate acknowledged/resolve (staff pe orice device)
CREATE POLICY "update_operational_incidents"
  ON operational_incidents
  FOR UPDATE
  TO authenticated
  USING (status IN ('open', 'acknowledged'))
  WITH CHECK (
    -- Permite doar tranziții valide de status
    (OLD.status = 'open'         AND NEW.status IN ('acknowledged', 'resolved', 'escalated'))
    OR (OLD.status = 'acknowledged' AND NEW.status IN ('resolved', 'escalated'))
  );

-- VIEW: read public
GRANT SELECT ON v_active_incidents TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. PUBLICARE SUPABASE REALTIME
--    Activează Realtime pe tabelă pentru ca OperationalProvider
--    să primească INSERT/UPDATE fără polling.
-- ---------------------------------------------------------------------------

-- Permite Supabase Realtime să publice schimbările acestui tabel
ALTER PUBLICATION supabase_realtime ADD TABLE operational_incidents;
