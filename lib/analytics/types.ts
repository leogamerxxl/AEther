/**
 * Project Aether — Macro Corridor Analytics: Shared Types
 *
 * Zero-PII: niciun tip nu conține identificatori personali.
 * Toate structurile reprezintă semnale agregate de piață.
 */

// ---------------------------------------------------------------------------
// INPUT VECTORS
// ---------------------------------------------------------------------------

export type Season = 'peak' | 'shoulder' | 'off';
export type RiskLevel = 'safe' | 'watch' | 'alert' | 'critical';
export type CongestionLevel = 'low' | 'medium' | 'high' | 'extreme';
export type CompetitorDestination =
  | 'nisipurile_de_aur'
  | 'sunny_beach'
  | 'albena'
  | 'greek_halkidiki'
  | 'greek_rhodes';

/**
 * Vectorul macro complet pentru un snapshot de dată.
 * Toate câmpurile sunt semnale agregate — fără PII.
 */
export interface MacroDataVector {
  /** Data de referință a snapshot-ului */
  date: Date;

  // ── Combustibil ─────────────────────────────────────────────────────────
  /** Prețul absolut RON/litru benzină 95, medie națională */
  fuelPriceRon: number;
  /** Variație lunară față de luna precedentă (ex: -0.018 = -1.8%) */
  fuelPriceDeltaPct: number;
  /** Indice față de baseline (Iun 2024 = 1.0000) */
  fuelPriceIndex: number;

  // ── Competitori (Bulgaria / Grecia) ──────────────────────────────────────
  /** ADR mediu al celui mai relevant competitor (EUR) */
  competitorAdrEur: number;
  /** Destinație competitor principal */
  competitorDestination: CompetitorDestination;
  /** ADR baseline Neptun 4★ (EUR) — referință internă */
  romanianBaseAdrEur: number;
  /**
   * Raport competitor_adr / romanian_base.
   * < 1.0 → competitor mai ieftin → presiune de migrare
   * > 1.0 → Romania mai competitivă
   */
  competitorAdrIndex: number;

  // ── Sentiment Social Media ────────────────────────────────────────────────
  /**
   * Scor de sentiment agregat.
   * -1.0 = maxim negativ (servicii slabe, prețuri mari etc.)
   * +1.0 = maxim pozitiv (vacanță perfectă, festival reușit etc.)
   */
  sentimentScore: number;
  /** Velocitatea sentimentului (Δ vs săptămâna precedentă) */
  sentimentVelocity?: number;

  // ── Trafic DN39 ──────────────────────────────────────────────────────────
  /**
   * Indicele de trafic pe DN39 (Constanța–Mangalia).
   * 0.0 = trafic minim, 1.0 = congestionare extremă.
   * Proxy pentru cererea de deplasare spre litoral.
   */
  dn39TrafficIndex: number;

  // ── Context Calendar ─────────────────────────────────────────────────────
  /** Număr de zile până la cel mai apropiat eveniment major */
  daysToNearestMajorEvent: number;
  /** Evenimentul major cel mai apropiat (dacă există) */
  nearestEventName?: string;
  /** Este weekend sau zi de sărbătoare legală? */
  isWeekendOrHoliday: boolean;
  /** Sezon curent */
  season: Season;
  /** Luna calendaristică (1-12) */
  month: number;
}

// ---------------------------------------------------------------------------
// CONTEXT HOTELIER
// ---------------------------------------------------------------------------

export interface HotelContext {
  /** Denumire hotel (ex: 'Hotel Terra Neptun') */
  name: string;
  /** Segment (ex: '4star', '3star') */
  segment: string;
  /** Ocupare curentă reală (0.0 – 1.0), dacă este disponibilă */
  currentOccupancy?: number;
  /** ADR curent setat de hotel (EUR), dacă este disponibil */
  currentAdrEur?: number;
  /** Ținta de ocupare dorită (implicit 0.82) */
  targetOccupancy?: number;
  /** Număr de camere totale (pentru RevPAR context) */
  totalRooms?: number;
}

// ---------------------------------------------------------------------------
// OUTPUT RESULT
// ---------------------------------------------------------------------------

export type RiskFactorKey =
  | 'competitor_price_pressure'
  | 'negative_sentiment'
  | 'low_traffic_demand'
  | 'high_fuel_cost'
  | 'no_event_anchor'
  | 'off_season'
  | 'peak_season_competition'
  | 'rapid_sentiment_deterioration';

export interface RiskFactor {
  key: RiskFactorKey;
  label: string;
  /** Contribuție la scorul final (0.0 – 1.0) */
  contribution: number;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface MigrationRiskResult {
  /** Scor de risc ocupare: 0 = niciun risc, 100 = risc maxim de pierdere clienți */
  occupancyRiskScore: number;
  /** Probabilitatea de migrare a clienților (0.0 – 1.0) */
  migrationProbability: number;
  /**
   * Ajustare recomandată ADR față de prețul curent.
   * -0.12 = reducere 12% | +0.08 = creștere 8%
   */
  recommendedAdrAdjustmentPct: number;
  /** ADR absolut sugerat în EUR (dacă contextul hotelier este furnizat) */
  suggestedAdrEur?: number;
  /** Nivel de risc calificat */
  riskLevel: RiskLevel;
  /** Textul recomandării pentru managerul de hotel */
  recommendation: string;
  /** Acțiunea principală sugerată (scurtă, acționabilă) */
  primaryAction: string;
  /** Încrederea în predicție (0.0 – 1.0) */
  confidence: number;
  /** Factorii de risc identificați, ordonați descrescător după contribuție */
  riskFactors: RiskFactor[];
  /** Timestamp-ul calculului */
  analysisTimestamp: string;
  /** Vectorul de input folosit (pentru auditabilitate) */
  inputVector: MacroDataVector;
}
