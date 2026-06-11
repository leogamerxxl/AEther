/**
 * Project Aether — Macro Seed Data Generator
 * @file scripts/seed-macro-data.ts
 *
 * Generează date macro simulate pentru litoralul românesc:
 *   - 24 luni date istorice (Iun 2024 – Mai 2026)
 *   - 3 luni predicții (Iun 2026 – Aug 2026)
 *
 * Vectori generați:
 *   1. macro_fuel_prices          — prețuri combustibil
 *   2. competitor_adr_index       — ADR competitori Bulgaria / Grecia
 *   3. romanian_neptun_adr_baseline — baseline Neptun
 *   4. social_sentiment_index     — sentiment social media (săptămânal)
 *   5. dn39_traffic_events        — indici trafic DN39 (săptămânal)
 *   6. coastal_events_calendar    — calendarul evenimentelor majore
 *   7. occupancy_risk_snapshots   — scoruri de risc pre-calculate
 *
 * Rulare: npx tsx scripts/seed-macro-data.ts
 * Output: supabase/seed.sql
 *
 * Zero-PII: niciun identificator personal în datele generate.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// TIPURI LOCALE (fără import din lib pentru autonomia scriptului)
// ---------------------------------------------------------------------------

interface FuelRow {
  period_month: string;
  fuel_price_ron: number;
  fuel_price_index: number;
  fuel_delta_pct: number;
  diesel_price_ron: number;
  is_prediction: boolean;
}

interface CompetitorAdrRow {
  period_month: string;
  destination_key: string;
  destination_label: string;
  country: string;
  segment: string;
  adr_eur: number;
  adr_ron: number;
  adr_index: number;
  occupancy_pct: number;
  revpar_eur: number;
  booking_lead_days: number;
  is_prediction: boolean;
}

interface NeptunBaselineRow {
  period_month: string;
  segment: string;
  adr_eur: number;
  adr_ron: number;
  occupancy_pct: number;
  revpar_eur: number;
  season: string;
  is_prediction: boolean;
}

interface SentimentRow {
  period_week_start: string;
  sentiment_score: number;
  positive_signal_count: number;
  negative_signal_count: number;
  neutral_signal_count: number;
  sentiment_velocity: number;
  top_negative_themes: string[];
  top_positive_themes: string[];
  is_prediction: boolean;
}

interface TrafficRow {
  event_date: string;
  traffic_index: number;
  direction: string;
  is_weekend: boolean;
  is_public_holiday: boolean;
  is_festival_adjacent: boolean;
  festival_name: string | null;
  congestion_level: string;
  peak_hour: number;
  estimated_vehicles: number;
  weather_condition: string;
  is_prediction: boolean;
}

interface EventRow {
  event_name: string;
  event_type: string;
  location: string;
  start_date: string;
  end_date: string;
  expected_attendance: number;
  adr_impact_multiplier: number;
  occupancy_boost_pct: number;
  migration_shield: number;
  notes: string;
  is_confirmed: boolean;
  is_prediction: boolean;
}

// ---------------------------------------------------------------------------
// UTILITARE
// ---------------------------------------------------------------------------

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(d: Date, n: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + n);
  result.setDate(1);
  return result;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0) ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function round(v: number, dec: number = 4): number {
  const f = Math.pow(10, dec);
  return Math.round(v * f) / f;
}

function jitter(base: number, maxPct: number = 0.03, seed: number = 0): number {
  // Pseudo-random deterministă (LCG simplu)
  const r = ((seed * 1664525 + 1013904223) & 0xffffffff) / 0xffffffff;
  return base * (1 + (r - 0.5) * 2 * maxPct);
}

function getSeason(month: number): string {
  if (month >= 6 && month <= 8) return 'peak';
  if ((month >= 4 && month <= 5) || (month >= 9 && month <= 10)) return 'shoulder';
  return 'off';
}

function isRomaniaNationalHoliday(d: Date): boolean {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return (m === 1 && day === 1)   // Anul Nou
      || (m === 5 && day === 1)   // 1 Mai
      || (m === 6 && (day === 1 || day === 2)) // Rusalii (aproximat)
      || (m === 8 && day === 15)  // Sfânta Marie Mare
      || (m === 11 && day === 30) // Sf. Andrei
      || (m === 12 && day === 1)  // Ziua Națională
      || (m === 12 && (day === 25 || day === 26)); // Crăciun
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

// ---------------------------------------------------------------------------
// 1. PREȚURI COMBUSTIBIL (lunar, Ian 2024 – Aug 2026)
// ---------------------------------------------------------------------------

const FUEL_DATA: Array<[number, number, number]> = [
  // [month_offset_from_jun2024, ron_per_liter, diesel_price_ron]
  // Iun 2024 = offset 0
  [0,  7.12, 7.05],
  [1,  7.08, 7.01],
  [2,  6.95, 6.88],
  [3,  6.83, 6.74],
  [4,  6.71, 6.62],
  [5,  6.68, 6.59],
  [6,  6.75, 6.67],
  [7,  6.88, 6.80],
  [8,  6.94, 6.86],
  [9,  7.02, 6.93],
  [10, 7.10, 7.01],
  [11, 7.18, 7.09],
  // Iun 2025 = offset 12
  [12, 7.22, 7.12],
  [13, 7.28, 7.17],
  [14, 7.35, 7.24],
  [15, 7.15, 7.04],
  [16, 6.98, 6.87],
  [17, 6.90, 6.79],
  [18, 6.95, 6.84],
  [19, 7.05, 6.94],
  [20, 7.12, 7.00],
  [21, 7.18, 7.06],
  [22, 7.25, 7.13],
  [23, 7.32, 7.19],
  // Predicții: Iun 2026 = offset 24
  [24, 7.38, 7.24], // predicție
  [25, 7.45, 7.30], // predicție
  [26, 7.42, 7.27], // predicție
];

const FUEL_BASELINE = 7.12; // Iun 2024

function generateFuelRows(): FuelRow[] {
  const baseDate = new Date('2024-06-01');
  return FUEL_DATA.map(([offset, ron, diesel]) => {
    const prevRon = offset > 0 ? FUEL_DATA[offset - 1][1] : ron;
    const delta = (ron - prevRon) / prevRon;
    return {
      period_month:    fmtDate(addMonths(baseDate, offset)),
      fuel_price_ron:  round(ron, 3),
      fuel_price_index: round(ron / FUEL_BASELINE, 4),
      fuel_delta_pct:  round(delta, 4),
      diesel_price_ron: round(diesel, 3),
      is_prediction:   offset >= 24,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. BASELINE ADR NEPTUN (lunar, referință pentru indexul competitorului)
// ---------------------------------------------------------------------------

// [offset, adr_eur_4star, occupancy_pct]
const NEPTUN_BASELINE_4STAR: Array<[number, number, number]> = [
  [0,  85.0, 72],   // Iun 2024
  [1,  108.0, 91],  // Iul 2024 peak
  [2,  115.0, 94],  // Aug 2024 peak
  [3,  78.0, 65],   // Sep 2024
  [4,  52.0, 38],
  [5,  42.0, 28],
  [6,  45.0, 30],
  [7,  40.0, 25],
  [8,  38.0, 22],
  [9,  44.0, 30],
  [10, 58.0, 45],
  [11, 72.0, 60],
  [12, 88.0, 75],   // Iun 2025
  [13, 110.0, 92],  // Iul 2025 peak
  [14, 118.0, 95],  // Aug 2025 peak
  [15, 80.0, 67],
  [16, 54.0, 40],
  [17, 43.0, 29],
  [18, 46.0, 31],
  [19, 41.0, 26],
  [20, 39.0, 23],
  [21, 45.0, 32],
  [22, 60.0, 47],
  [23, 74.0, 62],
  [24, 90.0, 77],   // Iun 2026 predicție
  [25, 113.0, 93],  // Iul 2026 predicție
  [26, 120.0, 95],  // Aug 2026 predicție
];

const EUR_RON_RATE = 4.97; // Rată de schimb aproximativă

function generateNeptunBaseline(): NeptunBaselineRow[] {
  const baseDate = new Date('2024-06-01');
  return NEPTUN_BASELINE_4STAR.map(([offset, adr, occ]) => {
    const month = (new Date('2024-06-01').getMonth() + offset) % 12 + 1;
    const revpar = round(adr * (occ / 100), 2);
    return {
      period_month:   fmtDate(addMonths(baseDate, offset)),
      segment:        '4star',
      adr_eur:        round(adr, 2),
      adr_ron:        round(adr * EUR_RON_RATE, 2),
      occupancy_pct:  round(occ, 2),
      revpar_eur:     revpar,
      season:         getSeason(month),
      is_prediction:  offset >= 24,
    };
  });
}

// ---------------------------------------------------------------------------
// 3. COMPETITOR ADR INDEX (Bulgaria + Grecia)
// ---------------------------------------------------------------------------

// ADR competitori: [offset, nisipuri_4star, sunny_3star, albena_4star, halkidiki_4star]
const COMPETITOR_DATA: Array<[number, number, number, number, number]> = [
  [0,  72.5, 58.0, 68.0, 95.0],
  [1,  88.0, 72.0, 82.0, 125.0],
  [2,  92.0, 76.0, 86.0, 130.0],
  [3,  65.0, 52.0, 61.0, 82.0],
  [4,  45.0, 35.0, 42.0, 52.0],
  [5,  38.0, 30.0, 35.0, 40.0],
  [6,  42.0, 33.0, 39.0, 44.0],
  [7,  35.0, 28.0, 32.0, 36.0],
  [8,  38.0, 30.0, 35.0, 38.0],
  [9,  42.0, 34.0, 39.0, 44.0],
  [10, 55.0, 44.0, 52.0, 62.0],
  [11, 68.0, 55.0, 64.0, 78.0],
  [12, 74.0, 60.0, 70.0, 98.0],
  [13, 90.0, 74.0, 84.0, 128.0],
  [14, 94.0, 78.0, 88.0, 134.0],
  [15, 66.0, 53.0, 62.0, 84.0],
  [16, 46.0, 36.0, 43.0, 54.0],
  [17, 39.0, 31.0, 36.0, 41.0],
  [18, 44.0, 35.0, 41.0, 46.0],
  [19, 36.0, 29.0, 33.0, 37.0],
  [20, 39.0, 31.0, 36.0, 39.0],
  [21, 44.0, 35.0, 41.0, 46.0],
  [22, 57.0, 46.0, 54.0, 65.0],
  [23, 70.0, 57.0, 66.0, 80.0],
  [24, 76.0, 62.0, 72.0, 100.0], // predicție
  [25, 92.0, 76.0, 86.0, 131.0], // predicție
  [26, 96.0, 80.0, 90.0, 136.0], // predicție
];

// Ocupare estimată per destinație (sezonalitate similară)
function estimateCompetitorOccupancy(offset: number, destIdx: number): number {
  const month = ((5 + offset) % 12) + 1; // Iun=6, Iul=7...
  const base = getSeason(month);
  const bases = { peak: [88, 85, 82, 78], shoulder: [55, 50, 52, 48], off: [30, 25, 28, 20] };
  const arr = bases[base as keyof typeof bases];
  return round(arr[destIdx] + jitter(0, 0.04, offset * 10 + destIdx), 1);
}

interface DestDef {
  key: string;
  label: string;
  country: string;
  segment: string;
  leadDays: number;
}

const DESTINATIONS: DestDef[] = [
  { key: 'nisipurile_de_aur', label: 'Nisipurile de Aur, Bulgaria',  country: 'BG', segment: '4star', leadDays: 28 },
  { key: 'sunny_beach',       label: 'Sunny Beach, Bulgaria',        country: 'BG', segment: '3star', leadDays: 21 },
  { key: 'albena',            label: 'Albena Resort, Bulgaria',      country: 'BG', segment: '4star', leadDays: 32 },
  { key: 'greek_halkidiki',   label: 'Halkidiki, Grecia',            country: 'GR', segment: '4star', leadDays: 45 },
];

function generateCompetitorRows(): CompetitorAdrRow[] {
  const baseDate = new Date('2024-06-01');
  const rows: CompetitorAdrRow[] = [];

  COMPETITOR_DATA.forEach(([offset, nisi, sunny, albena, greek]) => {
    const adrs = [nisi, sunny, albena, greek];
    const neptunBaseline = NEPTUN_BASELINE_4STAR[offset][1];

    DESTINATIONS.forEach((dest, di) => {
      const adr = adrs[di];
      const referenceAdr = neptunBaseline;
      const occ = estimateCompetitorOccupancy(offset, di);
      rows.push({
        period_month:      fmtDate(addMonths(baseDate, offset)),
        destination_key:   dest.key,
        destination_label: dest.label,
        country:           dest.country,
        segment:           dest.segment,
        adr_eur:           round(adr, 2),
        adr_ron:           round(adr * EUR_RON_RATE, 2),
        adr_index:         round(adr / referenceAdr, 4),
        occupancy_pct:     occ,
        revpar_eur:        round(adr * (occ / 100), 2),
        booking_lead_days: dest.leadDays,
        is_prediction:     offset >= 24,
      });
    });
  });

  return rows;
}

// ---------------------------------------------------------------------------
// 4. SOCIAL SENTIMENT (săptămânal — 24 luni + 3 luni predicții)
// ---------------------------------------------------------------------------

// Evenimentele care amplifică sentimentul pozitiv
const POSITIVE_EVENTS: Array<{ start: string; end: string; boost: number; themes: string[] }> = [
  { start: '2024-07-04', end: '2024-07-06', boost: 0.42, themes: ['beach_please_festival','concerte_live','atmosfera_festiva'] },
  { start: '2024-07-04', end: '2024-07-07', boost: 0.25, themes: ['neversea_2024','plaja_constanta','muzica_electronica'] },
  { start: '2024-08-15', end: '2024-08-15', boost: 0.18, themes: ['sf_marie_concerte','mare_calda','weekend_lung'] },
  { start: '2025-05-01', end: '2025-05-03', boost: 0.30, themes: ['1_mai_traditie','gratar_pe_plaja','muzica_live'] },
  { start: '2025-07-03', end: '2025-07-05', boost: 0.45, themes: ['beach_please_2025','headlineri_internationali','sold_out'] },
  { start: '2025-07-03', end: '2025-07-06', boost: 0.22, themes: ['neversea_2025','constanta','festivalul_verii'] },
  { start: '2025-08-15', end: '2025-08-15', boost: 0.15, themes: ['sf_marie_concerte','plaje_amenajate','apus_de_soare'] },
  { start: '2026-05-01', end: '2026-05-03', boost: 0.28, themes: ['1_mai_2026','litoral_activ','sezon_deschis'] },
  { start: '2026-07-02', end: '2026-07-04', boost: 0.40, themes: ['beach_please_2026','headlineri_anuntati','bilete_epuizate'] }, // predicție
];

// Teme negative recurente
const NEGATIVE_THEMES_BANK = [
  'pret_ridicat','servicii_slabe','aglomeratie','plaje_murdare',
  'parcare_imposibila','caldura_extrema','apa_turbure','restaurante_scumpe',
  'cosmar_trafic_dn39','infrastructura_precara','mizerie_pe_plaja',
];
const POSITIVE_THEMES_BANK = [
  'mare_calda','apus_splendid','personal_amabil','mancare_buna',
  'plaja_curata','atmosfera_vesela','valori_bune_calitate_pret',
  'concerte_pe_plaja','festival_organizat_bine','sezon_prelungit',
];

function getEventBoost(d: Date): { boost: number; themes: string[] } {
  const dateStr = fmtDate(d);
  for (const ev of POSITIVE_EVENTS) {
    if (dateStr >= ev.start && dateStr <= ev.end) {
      return { boost: ev.boost, themes: ev.themes };
    }
  }
  // Săptămâna de după un eveniment major: efect rezidual
  for (const ev of POSITIVE_EVENTS) {
    const dayAfter = fmtDate(addDays(new Date(ev.end), 7));
    if (dateStr > ev.end && dateStr <= dayAfter) {
      return { boost: ev.boost * 0.3, themes: [ev.themes[0] + '_aftermath'] };
    }
  }
  return { boost: 0, themes: [] };
}

function generateSentimentRows(): SentimentRow[] {
  const rows: SentimentRow[] = [];
  const startDate = new Date('2024-06-03'); // Primul luni Iun 2024
  const endDate   = new Date('2026-08-31');

  let current = getMondayOfWeek(startDate);
  let prevScore = 0.05;
  let weekIdx = 0;

  while (current <= endDate) {
    const month = current.getMonth() + 1;
    const season = getSeason(month);

    // Baza de sentiment per sezon
    const seasonBase = season === 'peak' ? 0.10 : season === 'shoulder' ? -0.02 : -0.15;

    // Tendință de îmbunătățire graduală 2024→2026 (+0.08 pe an)
    const yearTrend = (current.getFullYear() - 2024) * 0.04;

    // Zgomot pseudo-aleatoriu
    const noise = jitter(0, 0.08, weekIdx * 7 + 3) * (0.5 - 0.5 * Math.random());

    // Boost din evenimente
    const { boost, themes: posThemes } = getEventBoost(current);

    let score = seasonBase + yearTrend + noise + boost;
    score = Math.max(-0.85, Math.min(0.90, score));

    const velocity = round(score - prevScore, 4);

    // Generăm contori de semnale simulate
    const totalSignals = season === 'peak' ? 4500 + weekIdx * 10 : 1200 + weekIdx * 5;
    const posPct  = (score + 1) / 2;
    const negPct  = Math.max(0, (0.5 - score * 0.4));
    const neuPct  = 1 - posPct - negPct;

    // Teme negative (mai frecvente vara din cauza aglomerației)
    const negThemes: string[] = [];
    if (score < 0.0) {
      const n = Math.abs(Math.floor(score * 3));
      for (let i = 0; i < Math.min(n + 1, 3); i++) {
        negThemes.push(NEGATIVE_THEMES_BANK[(weekIdx + i) % NEGATIVE_THEMES_BANK.length]);
      }
    }
    const posThemesFinal = posThemes.length > 0
      ? posThemes.slice(0, 2)
      : score > 0.1
        ? [POSITIVE_THEMES_BANK[weekIdx % POSITIVE_THEMES_BANK.length]]
        : [];

    const isPrediction = current >= new Date('2026-06-01');

    rows.push({
      period_week_start:    fmtDate(current),
      sentiment_score:      round(score, 4),
      positive_signal_count: Math.round(totalSignals * posPct),
      negative_signal_count: Math.round(totalSignals * negPct),
      neutral_signal_count:  Math.round(totalSignals * Math.max(0, neuPct)),
      sentiment_velocity:   velocity,
      top_negative_themes:  negThemes,
      top_positive_themes:  posThemesFinal,
      is_prediction:        isPrediction,
    });

    prevScore = score;
    current = addDays(current, 7);
    weekIdx++;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// 5. TRAFIC DN39 (săptămânal)
// ---------------------------------------------------------------------------

// Evenimente care cresc major traficul
const TRAFFIC_EVENTS: Array<{ date: string; boost: number; festival: string }> = [
  { date: '2024-07-04', boost: 0.88, festival: 'Beach Please! 2024' },
  { date: '2024-07-05', boost: 0.92, festival: 'Beach Please! 2024' },
  { date: '2024-07-06', boost: 0.90, festival: 'Beach Please! 2024' },
  { date: '2025-05-01', boost: 0.90, festival: '1 Mai Tradițional' },
  { date: '2025-07-03', boost: 0.87, festival: 'Beach Please! 2025' },
  { date: '2025-07-04', boost: 0.93, festival: 'Beach Please! 2025' },
  { date: '2025-07-05', boost: 0.91, festival: 'Beach Please! 2025' },
  { date: '2026-05-01', boost: 0.88, festival: '1 Mai 2026' },
  { date: '2026-07-02', boost: 0.86, festival: 'Beach Please! 2026' }, // predicție
  { date: '2026-07-03', boost: 0.92, festival: 'Beach Please! 2026' }, // predicție
  { date: '2026-07-04', boost: 0.89, festival: 'Beach Please! 2026' }, // predicție
];

function getTrafficEventBoost(d: Date): { boost: number; festival: string | null } {
  const dateStr = fmtDate(d);
  const ev = TRAFFIC_EVENTS.find(e => e.date === dateStr);
  return ev ? { boost: ev.boost, festival: ev.festival } : { boost: 0, festival: null };
}

function generateTrafficRows(): TrafficRow[] {
  const rows: TrafficRow[] = [];
  const startDate = getMondayOfWeek(new Date('2024-06-03'));
  const endDate   = new Date('2026-08-31');

  let current = new Date(startDate);
  let weekIdx = 0;

  while (current <= endDate) {
    const month = current.getMonth() + 1;
    const season = getSeason(month);
    const holiday = isRomaniaNationalHoliday(current);
    const weekend = isWeekend(current);
    const { boost, festival } = getTrafficEventBoost(current);

    // Baza de trafic per sezon
    const seasonBase = season === 'peak' ? 0.60 : season === 'shoulder' ? 0.32 : 0.12;
    const weekendMult = weekend ? 1.45 : 1.00;
    const holidayMult = holiday ? 1.70 : 1.00;
    const noise = jitter(0, 0.06, weekIdx * 13 + 7);

    let idx: number;
    if (boost > 0) {
      idx = boost;
    } else {
      idx = Math.min(0.98, seasonBase * weekendMult * holidayMult * (1 + noise));
    }
    idx = round(idx, 4);

    const congestion = idx >= 0.85 ? 'extreme' : idx >= 0.65 ? 'high' : idx >= 0.40 ? 'medium' : 'low';
    const peakHour   = season === 'peak' ? (weekend ? 11 : 14) : 16;
    const vehicles   = Math.round(idx * 22000 + jitter(0, 0.05, weekIdx));
    const weather    = season === 'peak' ? 'sunny' : month >= 11 || month <= 2 ? 'cloudy' : 'sunny';

    rows.push({
      event_date:           fmtDate(current),
      traffic_index:        idx,
      direction:            'both',
      is_weekend:           weekend,
      is_public_holiday:    holiday,
      is_festival_adjacent: festival !== null,
      festival_name:        festival,
      congestion_level:     congestion,
      peak_hour:            peakHour,
      estimated_vehicles:   vehicles,
      weather_condition:    weather,
      is_prediction:        current >= new Date('2026-06-01'),
    });

    current = addDays(current, 7);
    weekIdx++;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// 6. CALENDAR EVENIMENTE MAJORE
// ---------------------------------------------------------------------------

function generateEventRows(): EventRow[] {
  return [
    // ── 2024 ──────────────────────────────────────────────────────────────
    {
      event_name: 'Beach Please! Festival 2024',
      event_type: 'music_festival',
      location: 'Costinești',
      start_date: '2024-07-04', end_date: '2024-07-06',
      expected_attendance: 35000,
      adr_impact_multiplier: 1.22, occupancy_boost_pct: 28.5,
      migration_shield: 0.85,
      notes: 'Festival internațional de muzică electronică. Sold-out în 2024. Capturează cererea tinerilor 18-35.',
      is_confirmed: true, is_prediction: false,
    },
    {
      event_name: 'Neversea Festival 2024',
      event_type: 'music_festival',
      location: 'Constanța',
      start_date: '2024-07-04', end_date: '2024-07-07',
      expected_attendance: 60000,
      adr_impact_multiplier: 1.18, occupancy_boost_pct: 22.0,
      migration_shield: 0.78,
      notes: 'Festival de muzică pe plajă Constanța. Efect de spillover în Neptun/Mamaia.',
      is_confirmed: true, is_prediction: false,
    },
    {
      event_name: '1 Mai Tradițional Neptun 2024',
      event_type: 'national_holiday',
      location: 'Neptun',
      start_date: '2024-05-01', end_date: '2024-05-05',
      expected_attendance: 12000,
      adr_impact_multiplier: 1.15, occupancy_boost_pct: 35.0,
      migration_shield: 0.70,
      notes: 'Tradiție românească de deschidere a sezonului. Cerere spontană ridicată.',
      is_confirmed: true, is_prediction: false,
    },
    {
      event_name: 'Festivalul Internațional al Mării Negre 2024',
      event_type: 'cultural',
      location: 'Mangalia',
      start_date: '2024-08-08', end_date: '2024-08-10',
      expected_attendance: 8000,
      adr_impact_multiplier: 1.08, occupancy_boost_pct: 12.0,
      migration_shield: 0.55,
      notes: 'Festival cultural cu spectacole pe malul mării.',
      is_confirmed: true, is_prediction: false,
    },
    // ── 2025 ──────────────────────────────────────────────────────────────
    {
      event_name: '1 Mai Tradițional Costinești 2025',
      event_type: 'national_holiday',
      location: 'Costinești',
      start_date: '2025-05-01', end_date: '2025-05-04',
      expected_attendance: 15000,
      adr_impact_multiplier: 1.18, occupancy_boost_pct: 38.0,
      migration_shield: 0.72,
      notes: 'Ediție aniversară 2025 cu headlineri locali.',
      is_confirmed: true, is_prediction: false,
    },
    {
      event_name: 'Beach Please! Festival 2025',
      event_type: 'music_festival',
      location: 'Costinești',
      start_date: '2025-07-03', end_date: '2025-07-05',
      expected_attendance: 40000,
      adr_impact_multiplier: 1.25, occupancy_boost_pct: 32.0,
      migration_shield: 0.88,
      notes: 'Ediție extinsă — 3 scene, 80 de artiști. Parteneriat cu Guvernul pentru infrastructură.',
      is_confirmed: true, is_prediction: false,
    },
    {
      event_name: 'Neversea Festival 2025',
      event_type: 'music_festival',
      location: 'Constanța',
      start_date: '2025-07-03', end_date: '2025-07-06',
      expected_attendance: 70000,
      adr_impact_multiplier: 1.20, occupancy_boost_pct: 25.0,
      migration_shield: 0.80,
      notes: 'A cincea ediție. Headline international confirmați.',
      is_confirmed: true, is_prediction: false,
    },
    {
      event_name: 'Concurs Internațional de Windsurfing Mangalia 2025',
      event_type: 'sports',
      location: 'Mangalia',
      start_date: '2025-08-22', end_date: '2025-08-24',
      expected_attendance: 5000,
      adr_impact_multiplier: 1.06, occupancy_boost_pct: 8.0,
      migration_shield: 0.45,
      notes: 'Competiție internațională de sporturi nautice.',
      is_confirmed: true, is_prediction: false,
    },
    // ── 2026 (predicții) ──────────────────────────────────────────────────
    {
      event_name: '1 Mai 2026 — Deschiderea Sezonului Estival',
      event_type: 'national_holiday',
      location: 'Costinești',
      start_date: '2026-05-01', end_date: '2026-05-04',
      expected_attendance: 17000,
      adr_impact_multiplier: 1.20, occupancy_boost_pct: 40.0,
      migration_shield: 0.73,
      notes: 'Predicție. Cerere estimată în creștere față de 2025.',
      is_confirmed: false, is_prediction: true,
    },
    {
      event_name: 'Beach Please! Festival 2026 (predicție)',
      event_type: 'music_festival',
      location: 'Costinești',
      start_date: '2026-07-02', end_date: '2026-07-04',
      expected_attendance: 45000,
      adr_impact_multiplier: 1.28, occupancy_boost_pct: 35.0,
      migration_shield: 0.90,
      notes: 'Predicție bazată pe trendul ediților anterioare. Bilete pre-vânzare deja active.',
      is_confirmed: false, is_prediction: true,
    },
    {
      event_name: 'Neversea Festival 2026 (predicție)',
      event_type: 'music_festival',
      location: 'Constanța',
      start_date: '2026-07-02', end_date: '2026-07-05',
      expected_attendance: 75000,
      adr_impact_multiplier: 1.22, occupancy_boost_pct: 28.0,
      migration_shield: 0.82,
      notes: 'Predicție. Ediție a șasea.',
      is_confirmed: false, is_prediction: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// SQL FORMATTER
// ---------------------------------------------------------------------------

function escapeSql(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    const escaped = v.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(',');
    return `ARRAY[${escaped}]::TEXT[]`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

function generateInserts(table: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return `-- No data for ${table}\n`;
  const cols = Object.keys(rows[0]);
  const header = `INSERT INTO ${table} (${cols.join(', ')}) VALUES\n`;
  const valueLines = rows.map(row => {
    const vals = cols.map(c => escapeSql(row[c]));
    return `  (${vals.join(', ')})`;
  });
  return header + valueLines.join(',\n') + '\nON CONFLICT DO NOTHING;\n\n';
}

// ---------------------------------------------------------------------------
// MAIN — assembla și scrie seed.sql
// ---------------------------------------------------------------------------

function main(): void {
  console.log('🌊 Project Aether — Macro Seed Generator');
  console.log('   Coridorul: Neptun / DN39 / Beach Please! Costinești');
  console.log('   Perioadă: Iun 2024 → Aug 2026 (24 luni istorice + 3 predicții)\n');

  const fuel       = generateFuelRows();
  const neptun     = generateNeptunBaseline();
  const competitor = generateCompetitorRows();
  const sentiment  = generateSentimentRows();
  const traffic    = generateTrafficRows();
  const events     = generateEventRows();

  console.log(`   ✓ Combustibil: ${fuel.length} rânduri lunare`);
  console.log(`   ✓ Baseline Neptun: ${neptun.length} rânduri lunare`);
  console.log(`   ✓ ADR Competitori: ${competitor.length} rânduri (${DESTINATIONS.length} destinații × ${FUEL_DATA.length} luni)`);
  console.log(`   ✓ Sentiment: ${sentiment.length} rânduri săptămânale`);
  console.log(`   ✓ Trafic DN39: ${traffic.length} rânduri săptămânale`);
  console.log(`   ✓ Evenimente: ${events.length} evenimente calendaristice`);
  console.log(`   Total rânduri: ${fuel.length + neptun.length + competitor.length + sentiment.length + traffic.length + events.length}\n`);

  const banner = `-- =============================================================================
-- Project Aether — Macro Corridor Seed Data
-- GENERAT AUTOMAT de scripts/seed-macro-data.ts
-- Data generare: ${new Date().toISOString()}
-- Perioadă: Iun 2024 → Aug 2026 (24 luni istorice + 3 predicții)
-- Coridor: Litoral Românesc (Neptun / Costinești, axa DN39)
-- vs. Bulgaria (Nisipurile de Aur, Sunny Beach, Albena)
-- vs. Grecia (Halkidiki)
-- Zero-PII: niciun identificator personal
-- =============================================================================

SET client_encoding = 'UTF8';
BEGIN;

`;

  const footer = `
COMMIT;
-- Seed data importat cu succes. ${fuel.length + neptun.length + competitor.length + sentiment.length + traffic.length + events.length} rânduri totale.
`;

  const sql =
    banner +
    '-- 1. PREȚURI COMBUSTIBIL\n' + generateInserts('macro_fuel_prices', fuel as unknown as Record<string, unknown>[]) +
    '-- 2. BASELINE ADR NEPTUN 4★\n' + generateInserts('romanian_neptun_adr_baseline', neptun as unknown as Record<string, unknown>[]) +
    '-- 3. ADR COMPETITORI (Bulgaria + Grecia)\n' + generateInserts('competitor_adr_index', competitor as unknown as Record<string, unknown>[]) +
    '-- 4. SENTIMENT SOCIAL MEDIA (săptămânal)\n' + generateInserts('social_sentiment_index', sentiment as unknown as Record<string, unknown>[]) +
    '-- 5. TRAFIC DN39 (săptămânal)\n' + generateInserts('dn39_traffic_events', traffic as unknown as Record<string, unknown>[]) +
    '-- 6. CALENDAR EVENIMENTE MAJORE\n' + generateInserts('coastal_events_calendar', events as unknown as Record<string, unknown>[]) +
    footer;

  const outPath = path.join(process.cwd(), 'supabase', 'seed.sql');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, sql, 'utf8');

  const sizeKB = (Buffer.byteLength(sql, 'utf8') / 1024).toFixed(1);
  console.log(`   ✅ Seed scris: supabase/seed.sql (${sizeKB} KB)\n`);
}

main();
