/**
 * Project Aether — Macro Corridor Correlation Engine
 * @file lib/analytics/correlationEngine.ts
 *
 * Funcție pură TypeScript care procesează vectorii de date macro pentru
 * coridorul Neptun / DN39 și calculează:
 *
 *   1. `occupancyRiskScore`        — scor de risc 0–100
 *   2. `migrationProbability`      — probabilitate de migrare spre Bulgaria/Grecia (0–1)
 *   3. `recommendedAdrAdjustmentPct` — ajustare ADR pentru Hotel Terra Neptun
 *
 * Design:
 *   - Funcție pură (fără side-effects, fără I/O)
 *   - Zero-PII: procesează exclusiv semnale agregate de piață
 *   - Determinism: aceleași inputuri → același output
 *   - Testabilitate completă prin injectare de vectori
 *
 * Model de ponderare (calibrat pe coridorul Neptun–Bulgaria):
 *   ┌─────────────────────────────────┬────────┐
 *   │ Factor                          │ Weight │
 *   ├─────────────────────────────────┼────────┤
 *   │ Presiune preț competitor        │  0.35  │
 *   │ Sentiment social media negativ  │  0.25  │
 *   │ Cerere trafic DN39 (inversă)    │  0.15  │
 *   │ Cost combustibil                │  0.10  │
 *   │ Absența ancorelor de eveniment  │  0.10  │
 *   │ Weekend / sezonalitate          │  0.05  │
 *   └─────────────────────────────────┴────────┘
 */

import type {
  MacroDataVector,
  HotelContext,
  MigrationRiskResult,
  RiskFactor,
  RiskLevel,
} from './types';

// ---------------------------------------------------------------------------
// CONSTANTE DE CALIBRARE
// ---------------------------------------------------------------------------

/** Praguri ADR index sub care competitorul devine semnificativ mai ieftin */
const ADR_INDEX_CRITICAL = 0.80; // competitor cu 20%+ mai ieftin → presiune maximă
const ADR_INDEX_HIGH     = 0.88; // competitor cu 12%+ mai ieftin → presiune ridicată
const ADR_INDEX_MEDIUM   = 0.95; // competitor cu 5%+ mai ieftin  → presiune medie
const ADR_INDEX_PARITY   = 1.02; // paritate de preț ±2%

/** Praguri trafic DN39 */
const TRAFFIC_HIGH   = 0.75; // trafic ridicat → cerere solidă
const TRAFFIC_MEDIUM = 0.45;
const TRAFFIC_LOW    = 0.25; // trafic scăzut → semnal slab de cerere

/** Praguri sentiment */
const SENTIMENT_POSITIVE    =  0.25;
const SENTIMENT_NEUTRAL_LOW = -0.10;
const SENTIMENT_NEGATIVE    = -0.30;

/** Ponderile factorilor de risc */
const WEIGHTS = {
  competitorPrice:  0.35,
  sentiment:        0.25,
  trafficDemand:    0.15,
  fuelCost:         0.10,
  eventAnchor:      0.10,
  calendar:         0.05,
} as const;

/** Multiplicatori sezonali (presiunea de competiție este mai mare în sezon) */
const SEASON_MULTIPLIER: Record<string, number> = {
  peak:     1.20,
  shoulder: 1.00,
  off:      0.65,
};

/** ADR pentru Hotel Terra Neptun în luna curentă (fallback dacă nu se furnizează context) */
const DEFAULT_NEPTUN_ADR_EUR = 95.0;
const DEFAULT_TARGET_OCCUPANCY = 0.82;

// ---------------------------------------------------------------------------
// UTILITĂȚI INTERNE
// ---------------------------------------------------------------------------

/** Normalizează o valoare la intervalul [0, 1] */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Interpolare liniară între două valori */
function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp01(t);
}

/** Rotunjire la N zecimale */
function round(value: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// CALCULATOARE INDIVIDUALE DE PRESIUNE
// ---------------------------------------------------------------------------

/**
 * Presiunea de preț a competitorului.
 * adr_index < 1.0 → competitor mai ieftin → presiune mai mare
 */
function computeCompetitorPricePressure(adrIndex: number): {
  pressure: number;
  severity: RiskFactor['severity'];
  label: string;
} {
  if (adrIndex <= ADR_INDEX_CRITICAL) {
    // Competitor cu 20%+ mai ieftin → presiune critică
    const excess = ADR_INDEX_CRITICAL - adrIndex;
    const pressure = clamp01(0.85 + excess * 2);
    return { pressure, severity: 'critical', label: `Competitor cu ${((1 - adrIndex) * 100).toFixed(1)}% mai ieftin` };
  }
  if (adrIndex <= ADR_INDEX_HIGH) {
    const t = (ADR_INDEX_HIGH - adrIndex) / (ADR_INDEX_HIGH - ADR_INDEX_CRITICAL);
    return { pressure: lerp(0.60, 0.85, t), severity: 'high', label: `Avantaj de preț competitor semnificativ` };
  }
  if (adrIndex <= ADR_INDEX_MEDIUM) {
    const t = (ADR_INDEX_MEDIUM - adrIndex) / (ADR_INDEX_MEDIUM - ADR_INDEX_HIGH);
    return { pressure: lerp(0.30, 0.60, t), severity: 'medium', label: `Competitor ușor mai ieftin` };
  }
  if (adrIndex <= ADR_INDEX_PARITY) {
    const t = (ADR_INDEX_PARITY - adrIndex) / (ADR_INDEX_PARITY - ADR_INDEX_MEDIUM);
    return { pressure: lerp(0.05, 0.30, t), severity: 'low', label: `Paritate de preț cu competitorii` };
  }
  // România mai competitivă
  return { pressure: 0.02, severity: 'info', label: `România mai competitivă ca preț` };
}

/**
 * Presiunea de sentiment.
 * Sentiment negativ → turiști mai tentați să caute alternative.
 */
function computeSentimentPressure(
  score: number,
  velocity: number = 0
): { pressure: number; severity: RiskFactor['severity']; label: string } {
  // Conversia scorului (-1…+1) în presiune (0…1)
  let basePressure = clamp01((1 - score) / 2);

  // Amplificator dacă sentimentul se deteriorează rapid
  const velocityPenalty = velocity < -0.15 ? 0.10 : velocity < -0.05 ? 0.05 : 0;
  const pressure = clamp01(basePressure + velocityPenalty);

  if (score <= SENTIMENT_NEGATIVE) {
    return { pressure, severity: 'high', label: `Sentiment social media puternic negativ (${score.toFixed(2)})` };
  }
  if (score <= SENTIMENT_NEUTRAL_LOW) {
    return { pressure, severity: 'medium', label: `Sentiment social media slab (${score.toFixed(2)})` };
  }
  if (score >= SENTIMENT_POSITIVE) {
    return { pressure, severity: 'info', label: `Sentiment social media pozitiv (${score.toFixed(2)})` };
  }
  return { pressure, severity: 'low', label: `Sentiment social media neutru (${score.toFixed(2)})` };
}

/**
 * Factorul de cerere bazat pe traficul DN39.
 * Trafic ridicat = cerere solidă = risc de migrare mai mic.
 * Returnează presiunea INVERSĂ față de cerere.
 */
function computeTrafficDemandPressure(
  trafficIndex: number
): { pressure: number; severity: RiskFactor['severity']; label: string } {
  const inverseDemand = 1 - trafficIndex;

  if (trafficIndex >= TRAFFIC_HIGH) {
    return { pressure: inverseDemand * 0.4, severity: 'info', label: `Cerere puternică — trafic DN39 ridicat (${(trafficIndex * 100).toFixed(0)}%)` };
  }
  if (trafficIndex >= TRAFFIC_MEDIUM) {
    return { pressure: inverseDemand * 0.7, severity: 'low', label: `Cerere moderată pe DN39 (${(trafficIndex * 100).toFixed(0)}%)` };
  }
  if (trafficIndex >= TRAFFIC_LOW) {
    return { pressure: inverseDemand * 0.85, severity: 'medium', label: `Cerere slabă — trafic DN39 redus (${(trafficIndex * 100).toFixed(0)}%)` };
  }
  return { pressure: inverseDemand * 0.95, severity: 'high', label: `Cerere foarte slabă pe DN39 (${(trafficIndex * 100).toFixed(0)}%)` };
}

/**
 * Presiunea costului de combustibil.
 * Creșterile de preț → buget mai sensibil → căutare de oferte mai ieftine.
 */
function computeFuelPressure(
  deltaPct: number,
  priceIndex: number
): { pressure: number; severity: RiskFactor['severity']; label: string } {
  // Efectul principal vine din creșterea lunară
  const deltaPressure = clamp01(Math.max(0, deltaPct) * 4); // +5% fuel → +0.20 presiune

  // Efectul secundar vine din nivelul absolut față de baseline
  const indexPressure = clamp01(Math.max(0, priceIndex - 1.0) * 1.5);

  const pressure = clamp01(deltaPressure * 0.6 + indexPressure * 0.4);

  if (deltaPct > 0.05 || priceIndex > 1.10) {
    return { pressure, severity: 'high', label: `Combustibil scump — presiune bugetară ridicată (+${(deltaPct * 100).toFixed(1)}% MoM)` };
  }
  if (deltaPct > 0.02 || priceIndex > 1.04) {
    return { pressure, severity: 'medium', label: `Combustibil în creștere (+${(deltaPct * 100).toFixed(1)}% MoM)` };
  }
  if (deltaPct < -0.02) {
    return { pressure: 0.02, severity: 'info', label: `Combustibil în scădere — presiune bugetară redusă` };
  }
  return { pressure: pressure * 0.5, severity: 'low', label: `Prețul combustibilului stabil` };
}

/**
 * Factorul de eveniment.
 * Evenimentele majore (Beach Please!, Neversea) ancorează cererea și reduc migrarea.
 */
function computeEventAnchorFactor(
  daysToNearestEvent: number,
  eventName?: string
): { pressure: number; severity: RiskFactor['severity']; label: string } {
  if (daysToNearestEvent <= 2) {
    return { pressure: 0.02, severity: 'info', label: `Eveniment activ: ${eventName ?? 'eveniment major'} — cerere ancorată` };
  }
  if (daysToNearestEvent <= 7) {
    return { pressure: 0.08, severity: 'info', label: `${eventName ?? 'Eveniment major'} în ${daysToNearestEvent} zile` };
  }
  if (daysToNearestEvent <= 21) {
    return { pressure: 0.25, severity: 'low', label: `Eveniment la ${daysToNearestEvent} zile` };
  }
  if (daysToNearestEvent <= 45) {
    return { pressure: 0.55, severity: 'medium', label: `Niciun eveniment major în curând (${daysToNearestEvent} zile)` };
  }
  return { pressure: 0.80, severity: 'high', label: `Fără evenimente majore în zona apropiată` };
}

/**
 * Factorul calendar (weekend + sezon).
 */
function computeCalendarFactor(
  isWeekendOrHoliday: boolean,
  season: string
): { pressure: number; severity: RiskFactor['severity']; label: string } {
  // În weekend, clienții sunt prezenți fizic sau rezervă → risc mai mic
  const weekendBonus = isWeekendOrHoliday ? -0.15 : 0.10;
  const basePressure = season === 'off' ? 0.15 : season === 'shoulder' ? 0.35 : 0.50;
  const pressure = clamp01(basePressure + weekendBonus);

  const label = isWeekendOrHoliday
    ? `Weekend / sărbătoare — cerere spontană activă`
    : `Zi de lucru — dinamică tipică de rezervare`;

  return { pressure, severity: 'info', label };
}

// ---------------------------------------------------------------------------
// CALCULATORUL DE ADR ADJUSTMENT
// ---------------------------------------------------------------------------

/**
 * Calculează ajustarea recomandată a ADR pe baza probabilității de migrare
 * și a contextului de ocupare.
 *
 * Logică:
 *  - Probabilitate mare + ocupare slabă → reducere agresivă de preț
 *  - Probabilitate mare + ocupare bună  → reducere moderată (nu sacrifica RevPAR)
 *  - Probabilitate mică + ocupare bună  → creștere de preț (captează surplus de cerere)
 */
function computeAdrAdjustment(
  migrationProbability: number,
  context?: HotelContext
): number {
  const currentOccupancy = context?.currentOccupancy ?? 0.65;
  const targetOccupancy  = context?.targetOccupancy  ?? DEFAULT_TARGET_OCCUPANCY;
  const occupancyGap = targetOccupancy - currentOccupancy; // pozitiv = sub target

  let baseAdjustment: number;

  if (migrationProbability >= 0.75) {
    // Risc critic: reducere semnificativă
    baseAdjustment = occupancyGap > 0.20 ? -0.15 : -0.10;
  } else if (migrationProbability >= 0.55) {
    // Risc ridicat: reducere moderată
    baseAdjustment = occupancyGap > 0.15 ? -0.09 : -0.06;
  } else if (migrationProbability >= 0.40) {
    // Risc mediu: ajustare fină
    baseAdjustment = occupancyGap > 0.10 ? -0.04 : -0.02;
  } else if (migrationProbability >= 0.25) {
    // Risc scăzut: menține sau ușoară creștere
    baseAdjustment = occupancyGap < -0.05 ? 0.03 : 0.00;
  } else {
    // Cerere puternică: creșteți prețul
    const surplusOccupancy = Math.max(0, currentOccupancy - targetOccupancy);
    baseAdjustment = 0.04 + surplusOccupancy * 0.25; // max ~+0.12
  }

  // Corectare pentru ocupare sub target în perioadă de risc
  if (occupancyGap > 0.25 && migrationProbability > 0.50) {
    baseAdjustment = Math.min(baseAdjustment, -0.12);
  }

  return round(clamp01WithNegative(baseAdjustment, -0.20, 0.15), 4);
}

function clamp01WithNegative(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// GENERATORUL DE TEXT RECOMANDAT
// ---------------------------------------------------------------------------

function generateRecommendation(
  migrationProbability: number,
  adjustmentPct: number,
  riskLevel: RiskLevel,
  factors: RiskFactor[],
  context?: HotelContext
): { recommendation: string; primaryAction: string } {
  const hotelName = context?.name ?? 'Hotel Terra Neptun';
  const topFactor = factors[0];
  const adjustPctDisplay = `${adjustmentPct >= 0 ? '+' : ''}${(adjustmentPct * 100).toFixed(1)}%`;

  const primaryAction = adjustmentPct <= -0.08
    ? `Reduceți ADR cu ${Math.abs(adjustmentPct * 100).toFixed(0)}% imediat și activați pachete de valoare adăugată`
    : adjustmentPct <= -0.03
    ? `Ajustați ADR cu ${adjustPctDisplay} și monitorizați zilnic indicii de sentiment`
    : adjustmentPct >= 0.05
    ? `Creșteți ADR cu ${(adjustmentPct * 100).toFixed(0)}% — cerere solidă, captați surplus`
    : 'Mențineți prețul curent și monitorizați indicii macro săptămânal';

  const riskTexts: Record<RiskLevel, string> = {
    safe: `Piața arată favorabil pentru ${hotelName}. Indicii macro sunt în parametri normali — ${primaryAction.toLowerCase()}.`,
    watch: `Atenție recomandată pentru ${hotelName}. ${topFactor?.label ?? 'Indicii macro'}  sugerează o ușoară presiune. Ajustare ADR de ${adjustPctDisplay} poate stabiliza cererea.`,
    alert: `Risc ridicat de migrare a clienților spre Bulgaria/Grecia detectat pentru ${hotelName} (probabilitate: ${(migrationProbability * 100).toFixed(0)}%). Factor dominant: ${topFactor?.label ?? 'presiune competitivă'}. ${primaryAction}.`,
    critical: `ALERTĂ CRITICĂ — ${(migrationProbability * 100).toFixed(0)}% probabilitate de pierdere masivă de rezervări pentru ${hotelName}. Factor critic: ${topFactor?.label ?? 'avantaj competitiv masiv al Bulgariei'}. Acțiune imediată necesară: ${primaryAction}.`,
  };

  return {
    recommendation: riskTexts[riskLevel],
    primaryAction,
  };
}

function classifyRiskLevel(score: number): RiskLevel {
  if (score >= 72) return 'critical';
  if (score >= 52) return 'alert';
  if (score >= 32) return 'watch';
  return 'safe';
}

function computeConfidence(vector: MacroDataVector, riskFactors: RiskFactor[]): number {
  // Încrederea scade dacă avem date lipsă sau predicții
  let confidence = 0.85;

  // Lipsa velocității sentimentului reduce certitudinea
  if (vector.sentimentVelocity === undefined) confidence -= 0.05;

  // Predicțiile au incertitudine mai mare
  const today = new Date();
  if (vector.date > today) {
    const daysAhead = (vector.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    confidence -= Math.min(0.25, daysAhead / 120); // -0.25 max la 4 luni distanță
  }

  // Factori cu severitate critică multiple = mai multă incertitudine (piața e volatilă)
  const criticalFactors = riskFactors.filter(f => f.severity === 'critical').length;
  if (criticalFactors >= 2) confidence -= 0.08;

  return round(clamp01(confidence), 4);
}

// ---------------------------------------------------------------------------
// FUNCȚIA PRINCIPALĂ — EXPORT PUBLIC
// ---------------------------------------------------------------------------

/**
 * Calculează probabilitatea de migrare a clienților și recomandarea de preț ADR
 * pentru coridorul hotelier Neptun (axa DN39 / Beach Please! Costinești).
 *
 * @param vector         - Vectorul de date macro pentru data analizată (Zero-PII)
 * @param context        - Contextul hotelier opțional (Hotel Terra Neptun)
 * @returns              - Scor de risc, probabilitate de migrare, recomandare ADR
 *
 * @example
 * ```ts
 * const result = calculateMigrationProbability({
 *   date: new Date('2025-07-15'),
 *   fuelPriceRon: 7.28,
 *   fuelPriceDeltaPct: 0.028,
 *   fuelPriceIndex: 1.022,
 *   competitorAdrEur: 90.00,
 *   competitorDestination: 'nisipurile_de_aur',
 *   romanianBaseAdrEur: 108.00,
 *   competitorAdrIndex: 0.833,
 *   sentimentScore: -0.15,
 *   dn39TrafficIndex: 0.72,
 *   daysToNearestMajorEvent: 4,
 *   nearestEventName: 'Beach Please! 2025',
 *   isWeekendOrHoliday: true,
 *   season: 'peak',
 *   month: 7,
 * }, { name: 'Hotel Terra Neptun', segment: '4star', currentOccupancy: 0.71 });
 *
 * // result.migrationProbability ≈ 0.38 (evenimentul Beach Please! ancorează cererea)
 * // result.recommendedAdrAdjustmentPct ≈ -0.04
 * // result.riskLevel === 'watch'
 * ```
 */
export function calculateMigrationProbability(
  vector: MacroDataVector,
  context?: HotelContext,
): MigrationRiskResult {
  // ── 1. Calculăm presiunile individuale ────────────────────────────────────
  const competitorResult = computeCompetitorPricePressure(vector.competitorAdrIndex);
  const sentimentResult  = computeSentimentPressure(vector.sentimentScore, vector.sentimentVelocity);
  const trafficResult    = computeTrafficDemandPressure(vector.dn39TrafficIndex);
  const fuelResult       = computeFuelPressure(vector.fuelPriceDeltaPct, vector.fuelPriceIndex);
  const eventResult      = computeEventAnchorFactor(vector.daysToNearestMajorEvent, vector.nearestEventName);
  const calendarResult   = computeCalendarFactor(vector.isWeekendOrHoliday, vector.season);

  // ── 2. Scor ponderat brut ─────────────────────────────────────────────────
  const rawScore =
    competitorResult.pressure * WEIGHTS.competitorPrice +
    sentimentResult.pressure  * WEIGHTS.sentiment       +
    trafficResult.pressure    * WEIGHTS.trafficDemand   +
    fuelResult.pressure       * WEIGHTS.fuelCost        +
    eventResult.pressure      * WEIGHTS.eventAnchor     +
    calendarResult.pressure   * WEIGHTS.calendar;

  // ── 3. Aplicăm multiplicatorul sezonier ───────────────────────────────────
  const seasonMult = SEASON_MULTIPLIER[vector.season] ?? 1.0;
  const migrationProbability = round(clamp01(rawScore * seasonMult), 4);

  // ── 4. Scor de risc ocupare (0–100) ──────────────────────────────────────
  const occupancyRiskScore = round(migrationProbability * 100, 2);

  // ── 5. Construim lista de factori de risc (sortați descrescător) ──────────
  const riskFactors: RiskFactor[] = [
    {
      key: 'competitor_price_pressure',
      label: competitorResult.label,
      contribution: round(competitorResult.pressure * WEIGHTS.competitorPrice, 4),
      severity: competitorResult.severity,
      description: `ADR index competitor: ${vector.competitorAdrIndex.toFixed(4)} | ${vector.competitorDestination}`,
    },
    {
      key: 'negative_sentiment',
      label: sentimentResult.label,
      contribution: round(sentimentResult.pressure * WEIGHTS.sentiment, 4),
      severity: sentimentResult.severity,
      description: `Scor sentiment: ${vector.sentimentScore.toFixed(4)} | Velocitate: ${(vector.sentimentVelocity ?? 0).toFixed(4)}`,
    },
    {
      key: 'low_traffic_demand',
      label: trafficResult.label,
      contribution: round(trafficResult.pressure * WEIGHTS.trafficDemand, 4),
      severity: trafficResult.severity,
      description: `Index trafic DN39: ${vector.dn39TrafficIndex.toFixed(4)}`,
    },
    {
      key: 'high_fuel_cost',
      label: fuelResult.label,
      contribution: round(fuelResult.pressure * WEIGHTS.fuelCost, 4),
      severity: fuelResult.severity,
      description: `RON/L: ${vector.fuelPriceRon.toFixed(3)} | Δ MoM: ${(vector.fuelPriceDeltaPct * 100).toFixed(2)}%`,
    },
    {
      key: 'no_event_anchor',
      label: eventResult.label,
      contribution: round(eventResult.pressure * WEIGHTS.eventAnchor, 4),
      severity: eventResult.severity,
      description: `Zile până la eveniment: ${vector.daysToNearestMajorEvent} | ${vector.nearestEventName ?? 'necunoscut'}`,
    },
    {
      key: vector.isWeekendOrHoliday ? 'off_season' : 'peak_season_competition',
      label: calendarResult.label,
      contribution: round(calendarResult.pressure * WEIGHTS.calendar, 4),
      severity: calendarResult.severity,
      description: `Sezon: ${vector.season} | Weekend/Sărbătoare: ${vector.isWeekendOrHoliday}`,
    },
  ];
  riskFactors.sort((a, b) => b.contribution - a.contribution);

  // ── 6. Recomandare ADR ────────────────────────────────────────────────────
  const recommendedAdrAdjustmentPct = computeAdrAdjustment(migrationProbability, context);

  const baseAdr = context?.currentAdrEur ?? DEFAULT_NEPTUN_ADR_EUR;
  const suggestedAdrEur = round(baseAdr * (1 + recommendedAdrAdjustmentPct), 2);

  // ── 7. Nivel de risc și text recomandat ───────────────────────────────────
  const riskLevel = classifyRiskLevel(occupancyRiskScore);
  const { recommendation, primaryAction } = generateRecommendation(
    migrationProbability,
    recommendedAdrAdjustmentPct,
    riskLevel,
    riskFactors,
    context,
  );

  // ── 8. Scor de încredere ──────────────────────────────────────────────────
  const confidence = computeConfidence(vector, riskFactors);

  return {
    occupancyRiskScore,
    migrationProbability,
    recommendedAdrAdjustmentPct,
    suggestedAdrEur,
    riskLevel,
    recommendation,
    primaryAction,
    confidence,
    riskFactors,
    analysisTimestamp: new Date().toISOString(),
    inputVector: vector,
  };
}

// ---------------------------------------------------------------------------
// UTILITAR: PROCESARE BATCH (serie temporală)
// ---------------------------------------------------------------------------

/**
 * Procesează o serie de vectori macro (ex: 27 luni) și returnează
 * trendul de risc complet pentru analize istorice și previzionale.
 */
export function analyzeTimeSeries(
  vectors: MacroDataVector[],
  context?: HotelContext,
): MigrationRiskResult[] {
  return vectors
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(v => calculateMigrationProbability(v, context));
}

/**
 * Returnează rezumatul statistic al unei serii de rezultate.
 */
export function summarizeTimeSeries(results: MigrationRiskResult[]) {
  if (results.length === 0) return null;

  const scores = results.map(r => r.occupancyRiskScore);
  const probs  = results.map(r => r.migrationProbability);

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const max = (arr: number[]) => Math.max(...arr);
  const min = (arr: number[]) => Math.min(...arr);

  const peakRiskResult = results.reduce((prev, curr) =>
    curr.occupancyRiskScore > prev.occupancyRiskScore ? curr : prev
  );

  const alertDays = results.filter(r => r.riskLevel === 'alert' || r.riskLevel === 'critical');

  return {
    periodStart:              results[0].inputVector.date.toISOString().slice(0, 10),
    periodEnd:                results[results.length - 1].inputVector.date.toISOString().slice(0, 10),
    avgOccupancyRiskScore:    round(avg(scores), 2),
    maxOccupancyRiskScore:    round(max(scores), 2),
    minOccupancyRiskScore:    round(min(scores), 2),
    avgMigrationProbability:  round(avg(probs), 4),
    peakRiskDate:             peakRiskResult.inputVector.date.toISOString().slice(0, 10),
    peakRiskScore:            peakRiskResult.occupancyRiskScore,
    alertDaysCount:           alertDays.length,
    totalDaysAnalyzed:        results.length,
  };
}
