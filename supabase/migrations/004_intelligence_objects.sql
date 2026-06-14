-- =============================================================================
-- Project Aether — Intelligence Objects (keystone)
-- Migration: 004_intelligence_objects.sql
-- Compatible: PostgreSQL 15+ / Supabase
--
-- DE CE: unifica familia fragmentata de insight (contextual_insights, alerts,
-- *_recommendations) intr-un singur obiect de inteligenta atasabil ORICAREI
-- entitati din modelul lumii (world->region->...->property->room), citit atat de
-- morning brief cat si de UI-ul spatial.
--
-- PRINCIPII: multi-tenant (property_id + RLS, Principiu 1), provenance/evidence
-- pastrat (Principiu 5), determinist (motorul scrie; LLM doar explica, nu inventa).
-- Freshness NU se stocheaza — se calculeaza la citire din observed_at/expires_at.
-- Aplicata via Supabase apply_migration; acest fisier este copia versionata.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS intelligence_objects (
  id                  UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- UNDE in modelul lumii
  altitude_level      TEXT         NOT NULL,   -- world|region|country|coast|city|market|property|department|room
  entity_type         TEXT         NOT NULL,   -- property|scraped_property|competitive_set|market|region|corridor|department|room
  entity_id           UUID,                    -- id-ul entitatii (nullable pentru semnale abstracte)

  -- TENANT scope (Principiu 1)
  property_id         UUID         NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- CE
  signal_type         TEXT         NOT NULL,   -- market_rate_pressure|demand_shift|weather_pressure|anomaly|...
  severity            TEXT         NOT NULL DEFAULT 'info',
  CONSTRAINT chk_io_severity CHECK (severity IN ('info','low','medium','high','critical')),
  confidence          NUMERIC(5,4) NOT NULL,
  CONSTRAINT chk_io_confidence CHECK (confidence >= 0 AND confidence <= 1),

  -- DE CE (provenance + cauzalitate)
  evidence            JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- [{source_id, observation_ids[], observed_at}]
  causal_hypothesis   TEXT,
  forecast_impact     JSONB,                    -- {metric, direction, magnitude, unit, horizon_days}
  recommended_actions JSONB        NOT NULL DEFAULT '[]'::jsonb,

  -- UNDE pe harta
  visual_anchor       JSONB,                    -- {lat,lng} | {kind, property_id} | {corridor_id}

  -- ciclu de viata + freshness (freshness calculat la citire)
  status              TEXT         NOT NULL DEFAULT 'active',
  CONSTRAINT chk_io_status CHECK (status IN ('active','acknowledged','resolved','expired','superseded')),
  observed_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,

  -- idempotenta
  dedupe_key          TEXT,

  -- audit + payload brut (Principiu 5)
  engine_version      TEXT         NOT NULL DEFAULT 'signal_engine_v1',
  raw_jsonb           JSONB,
  acknowledged_at     TIMESTAMPTZ,
  acknowledged_by     UUID,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_io_property_dedupe UNIQUE (property_id, dedupe_key)
);

COMMENT ON TABLE intelligence_objects IS
  'Obiect de inteligenta unificat: orice semnal/anomalie/forecast/recomandare ca interfata catre modelul lumii. Scris de motorul determinist, citit de brief + UI.';
COMMENT ON COLUMN intelligence_objects.altitude_level IS
  'Nivel spatial: world|region|country|coast|city|market|property|department|room.';
COMMENT ON COLUMN intelligence_objects.evidence IS
  'Lant de probe: surse + id-uri de observatii. Fara evidence -> fara recomandare.';
COMMENT ON COLUMN intelligence_objects.dedupe_key IS
  'Cheie logica pentru upsert idempotent (motorul rescrie acelasi semnal, nu acumuleaza).';

CREATE INDEX IF NOT EXISTS idx_io_property_status ON intelligence_objects (property_id, status, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_io_entity          ON intelligence_objects (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_io_altitude        ON intelligence_objects (altitude_level, status);
CREATE INDEX IF NOT EXISTS idx_io_active          ON intelligence_objects (property_id, observed_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_io_expiry          ON intelligence_objects (expires_at) WHERE expires_at IS NOT NULL AND status = 'active';

CREATE OR REPLACE TRIGGER trg_io_updated_at
  BEFORE UPDATE ON intelligence_objects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS — oglindeste pattern-ul din contextual_insights (insight_select / insight_acknowledge)
ALTER TABLE intelligence_objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "io_select" ON intelligence_objects;
CREATE POLICY "io_select"
  ON intelligence_objects FOR SELECT TO authenticated
  USING (property_id IN (SELECT get_user_property_ids()));

DROP POLICY IF EXISTS "io_acknowledge" ON intelligence_objects;
CREATE POLICY "io_acknowledge"
  ON intelligence_objects FOR UPDATE TO authenticated
  USING (property_id IN (SELECT get_user_property_ids()))
  WITH CHECK (property_id IN (SELECT get_user_property_ids()));