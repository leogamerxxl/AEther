-- =============================================================================
-- Project Aether — Macro Corridor Data Schema
-- Migration: 001_macro_tables.sql
-- Compatible: PostgreSQL 15+ / Supabase
--
-- PRIVACY DESIGN: Zero-PII
-- Toate tabelele conțin exclusiv date agregate de piață, anonimizate.
-- Niciun identificator personal nu intră în acest strat de date.
--
-- Context geografic: Litoralul Românesc — axa Neptun/Costinești (DN39)
-- Coridorul de competiție: Bulgaria (Nisipurile de Aur, Sunny Beach)
--                          Grecia (Halkidiki)
-- =============================================================================

-- Activăm extensia pentru UUID dacă nu există deja
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. MACRO_FUEL_PRICES
--    Evoluția prețurilor la combustibil (indice regional, date agregate)
-- =============================================================================
CREATE TABLE IF NOT EXISTS macro_fuel_prices (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_month     DATE        NOT NULL,   -- prima zi a lunii (ex: 2024-06-01)
  fuel_price_ron   NUMERIC(6,3) NOT NULL,  -- RON / litru benzină 95, medie națională
  fuel_price_index NUMERIC(7,4) NOT NULL,  -- indexat față de baseline (Iun 2024 = 1.0000)
  fuel_delta_pct   NUMERIC(7,4) NOT NULL,  -- variație față de luna anterioară (ex: -0.0182)
  diesel_price_ron NUMERIC(6,3),           -- RON / litru motorină (opțional)
  region           VARCHAR(60)  NOT NULL DEFAULT 'romania_national',
  data_source      VARCHAR(120) NOT NULL DEFAULT 'simulated_macro_v1',
  is_prediction    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fuel_period_region UNIQUE (period_month, region)
);

COMMENT ON TABLE macro_fuel_prices IS
  'Indici lunari ai prețurilor la combustibil — sursa macro, fără PII. '
  'Folosit în calculul presiunii bugetare asupra deciziei de vacanță.';

-- =============================================================================
-- 2. COMPETITOR_ADR_INDEX
--    ADR mediu al destinațiilor concurente (Bulgaria, Grecia) vs. baseline român
-- =============================================================================
CREATE TABLE IF NOT EXISTS competitor_adr_index (
  id                  UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_month        DATE         NOT NULL,
  destination_key     VARCHAR(60)  NOT NULL,  -- 'nisipurile_de_aur' | 'sunny_beach' | 'albena' | 'greek_halkidiki'
  destination_label   VARCHAR(120) NOT NULL,
  country             CHAR(2)      NOT NULL,  -- ISO 3166-1 alpha-2: BG, GR, RO
  segment             VARCHAR(20)  NOT NULL DEFAULT '4star',  -- '3star' | '4star' | '5star'
  adr_eur             NUMERIC(8,2) NOT NULL,  -- Average Daily Rate în EUR
  adr_ron             NUMERIC(10,2),          -- ADR în RON (conversie la rata lunii)
  adr_index           NUMERIC(7,4) NOT NULL,  -- competitor_adr / romanian_neptun_baseline
                                              -- < 1.0 = competitor mai ieftin → risc de migrare
  occupancy_pct       NUMERIC(5,2),           -- Rata de ocupare estimată (0.00 – 100.00)
  revpar_eur          NUMERIC(8,2),           -- RevPAR = adr_eur × (occupancy_pct/100)
  booking_lead_days   INTEGER,                -- Advance booking lead time mediu (zile)
  is_prediction       BOOLEAN      NOT NULL DEFAULT FALSE,
  data_source         VARCHAR(120) NOT NULL DEFAULT 'simulated_macro_v1',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_competitor_period_dest UNIQUE (period_month, destination_key, segment)
);

COMMENT ON TABLE competitor_adr_index IS
  'Indicii de preț ADR ai competitorilor din Bulgaria și Grecia față de baseline-ul '
  'hotelier din Neptun. adr_index < 1.0 semnalează presiune de migrare a clienților.';

-- =============================================================================
-- 3. ROMANIAN_NEPTUN_ADR_BASELINE
--    Baseline-ul ADR pentru segmentul hotelier din Neptun (referință internă)
-- =============================================================================
CREATE TABLE IF NOT EXISTS romanian_neptun_adr_baseline (
  id            UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_month  DATE         NOT NULL,
  segment       VARCHAR(20)  NOT NULL DEFAULT '4star',
  adr_eur       NUMERIC(8,2) NOT NULL,
  adr_ron       NUMERIC(10,2),
  occupancy_pct NUMERIC(5,2),
  revpar_eur    NUMERIC(8,2),
  season        VARCHAR(20)  NOT NULL,  -- 'peak' | 'shoulder' | 'off'
  is_prediction BOOLEAN      NOT NULL DEFAULT FALSE,
  data_source   VARCHAR(120) NOT NULL DEFAULT 'simulated_macro_v1',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_neptun_baseline_period UNIQUE (period_month, segment)
);

COMMENT ON TABLE romanian_neptun_adr_baseline IS
  'Referința ADR pentru piața hotelieră din Neptun — baza de calcul pentru adr_index '
  'din tabelul competitor_adr_index.';

-- =============================================================================
-- 4. SOCIAL_SENTIMENT_INDEX
--    Index săptămânal de sentiment social media despre litoralul românesc
-- =============================================================================
CREATE TABLE IF NOT EXISTS social_sentiment_index (
  id                    UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_week_start     DATE         NOT NULL,  -- Lunea săptămânii (ISO week)
  sentiment_score       NUMERIC(6,4) NOT NULL,  -- -1.0000 = maxim negativ, +1.0000 = maxim pozitiv
  positive_signal_count INTEGER      NOT NULL DEFAULT 0,
  negative_signal_count INTEGER      NOT NULL DEFAULT 0,
  neutral_signal_count  INTEGER      NOT NULL DEFAULT 0,
  sentiment_velocity    NUMERIC(6,4),           -- Δ față de săptămâna precedentă
  top_negative_themes   TEXT[]       NOT NULL DEFAULT '{}',  -- ex: ['pret_ridicat','aglomeratie','servicii_slabe']
  top_positive_themes   TEXT[]       NOT NULL DEFAULT '{}',  -- ex: ['plaja_curata','festival','atmosfera']
  region_focus          VARCHAR(100) NOT NULL DEFAULT 'neptun_costinesti_mamaia',
  is_prediction         BOOLEAN      NOT NULL DEFAULT FALSE,
  data_source           VARCHAR(120) NOT NULL DEFAULT 'simulated_macro_v1',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sentiment_week_region UNIQUE (period_week_start, region_focus)
);

COMMENT ON TABLE social_sentiment_index IS
  'Index agregat de sentiment social media (fără conținut individual, fără PII). '
  'Capturat la nivel săptămânal pentru coridorul Neptun–Costinești–Mamaia.';

-- =============================================================================
-- 5. DN39_TRAFFIC_EVENTS
--    Vârfuri de trafic pe DN39 corelate cu weekenduri, sărbători și evenimente
-- =============================================================================
CREATE TABLE IF NOT EXISTS dn39_traffic_events (
  id                    UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date            DATE         NOT NULL,
  traffic_index         NUMERIC(6,4) NOT NULL,  -- 1.0000 = flux normal de referință
  direction             VARCHAR(10)  NOT NULL DEFAULT 'both',  -- 'inbound' | 'outbound' | 'both'
  is_weekend            BOOLEAN      NOT NULL DEFAULT FALSE,
  is_public_holiday     BOOLEAN      NOT NULL DEFAULT FALSE,
  is_festival_adjacent  BOOLEAN      NOT NULL DEFAULT FALSE,
  festival_name         VARCHAR(200),
  congestion_level      VARCHAR(10)  NOT NULL DEFAULT 'low',  -- 'low'|'medium'|'high'|'extreme'
  peak_hour             SMALLINT,                -- ora de vârf (0–23)
  estimated_vehicles    INTEGER,                 -- estimare agregată
  weather_condition     VARCHAR(30),             -- 'sunny'|'cloudy'|'rain'
  is_prediction         BOOLEAN      NOT NULL DEFAULT FALSE,
  data_source           VARCHAR(120) NOT NULL DEFAULT 'simulated_macro_v1',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dn39_date_direction UNIQUE (event_date, direction)
);

COMMENT ON TABLE dn39_traffic_events IS
  'Indici de trafic pe DN39 (Constanța–Mangalia) — date agregate fără identificare vehicule. '
  'Proxy pentru cererea de cazare în zona Neptun–Costinești.';

-- =============================================================================
-- 6. COASTAL_EVENTS_CALENDAR
--    Calendarul evenimentelor majore de pe litoral (festivaluri, sărbători, concerte)
-- =============================================================================
CREATE TABLE IF NOT EXISTS coastal_events_calendar (
  id                        UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name                VARCHAR(200) NOT NULL,
  event_type                VARCHAR(50)  NOT NULL,  -- 'music_festival'|'sports'|'cultural'|'national_holiday'|'concert'
  location                  VARCHAR(100) NOT NULL,
  start_date                DATE         NOT NULL,
  end_date                  DATE         NOT NULL,
  expected_attendance       INTEGER,
  adr_impact_multiplier     NUMERIC(6,4) NOT NULL DEFAULT 1.0000,  -- 1.15 = +15% ADR în perioadă
  occupancy_boost_pct       NUMERIC(5,2),    -- creștere estimată a ocupării (puncte procentuale)
  migration_shield          NUMERIC(5,4) NOT NULL DEFAULT 0.5000,  -- 0-1, cât de mult blochează migrarea
  notes                     TEXT,
  is_confirmed              BOOLEAN      NOT NULL DEFAULT TRUE,
  is_prediction             BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_event_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE coastal_events_calendar IS
  'Calendarul evenimentelor culturale și festivalurilor de pe litoralul românesc. '
  'Evenimentele mari (ex: Beach Please!) reduc probabilitatea de migrare a clienților.';

-- =============================================================================
-- 7. OCCUPANCY_RISK_SNAPSHOTS
--    Instantanee ale scorului de risc calculat de correlationEngine
--    (output stocat, nu date brute)
-- =============================================================================
CREATE TABLE IF NOT EXISTS occupancy_risk_snapshots (
  id                            UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date                 DATE         NOT NULL,
  hotel_segment                 VARCHAR(60)  NOT NULL DEFAULT 'neptun_4star',
  occupancy_risk_score          NUMERIC(5,2) NOT NULL,  -- 0.00 – 100.00
  migration_probability         NUMERIC(6,4) NOT NULL,  -- 0.0000 – 1.0000
  recommended_adr_adjustment_pct NUMERIC(6,4) NOT NULL, -- ex: -0.0800 = -8%
  risk_level                    VARCHAR(10)  NOT NULL,  -- 'safe'|'watch'|'alert'|'critical'
  confidence_score              NUMERIC(5,4) NOT NULL,  -- 0.0000 – 1.0000
  recommendation_text           TEXT         NOT NULL,
  engine_version                VARCHAR(30)  NOT NULL DEFAULT 'correlationEngine_v1',
  vector_snapshot               JSONB,       -- input vectors pentru audit (fără PII)
  is_prediction                 BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_risk_snapshot_date UNIQUE (snapshot_date, hotel_segment)
);

COMMENT ON TABLE occupancy_risk_snapshots IS
  'Output-ul stocat al motorului de corelație macro. Permite compararea recomandărilor '
  'istorice cu rezultatele reale — audit trail complet, fără date personale.';

-- =============================================================================
-- INDEXURI PENTRU PERFORMANȚĂ
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_fuel_period         ON macro_fuel_prices          (period_month DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_period   ON competitor_adr_index       (period_month DESC, destination_key);
CREATE INDEX IF NOT EXISTS idx_neptun_period       ON romanian_neptun_adr_baseline (period_month DESC, segment);
CREATE INDEX IF NOT EXISTS idx_sentiment_week      ON social_sentiment_index     (period_week_start DESC, region_focus);
CREATE INDEX IF NOT EXISTS idx_dn39_date           ON dn39_traffic_events        (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_dn39_festival       ON dn39_traffic_events        (is_festival_adjacent) WHERE is_festival_adjacent = TRUE;
CREATE INDEX IF NOT EXISTS idx_events_dates        ON coastal_events_calendar    (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_type         ON coastal_events_calendar    (event_type);
CREATE INDEX IF NOT EXISTS idx_risk_snapshot_date  ON occupancy_risk_snapshots   (snapshot_date DESC, hotel_segment);
CREATE INDEX IF NOT EXISTS idx_risk_level          ON occupancy_risk_snapshots   (risk_level, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_adr_idx  ON competitor_adr_index       (adr_index ASC)
  WHERE adr_index < 1.0;  -- Index parțial pentru presiunile de migrare

-- =============================================================================
-- ROW LEVEL SECURITY (Supabase)
-- Datele macro sunt read-only pentru serviciul anon.
-- Scrierile se fac exclusiv din service_role (backend / migration scripts).
-- =============================================================================

ALTER TABLE macro_fuel_prices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_adr_index          ENABLE ROW LEVEL SECURITY;
ALTER TABLE romanian_neptun_adr_baseline  ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_sentiment_index        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dn39_traffic_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE coastal_events_calendar       ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupancy_risk_snapshots      ENABLE ROW LEVEL SECURITY;

-- Politici de citire publică (fără PII, datele sunt macro-agregate)
CREATE POLICY "anon_read_macro_fuel"
  ON macro_fuel_prices FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_competitor_adr"
  ON competitor_adr_index FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_neptun_baseline"
  ON romanian_neptun_adr_baseline FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_sentiment"
  ON social_sentiment_index FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_dn39"
  ON dn39_traffic_events FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_events"
  ON coastal_events_calendar FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_risk_snapshots"
  ON occupancy_risk_snapshots FOR SELECT TO anon USING (TRUE);
