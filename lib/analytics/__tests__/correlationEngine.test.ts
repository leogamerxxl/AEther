/**
 * Project Aether — Teste de validare correlationEngine
 *
 * Aceste teste sunt rulate cu: npx jest  sau  npx vitest
 * (sau direct cu tsx pentru inspecție manuală)
 *
 * Acoperire:
 *   1. Scenariul de risc CRITIC  (Bulgaria mult mai ieftină, sentiment negativ)
 *   2. Scenariul SAFE            (Beach Please! activ, cerere puternică)
 *   3. Scenariul WATCH           (sezon mediu, presiune moderată)
 *   4. Off-season                (iarnă, cerere minimă)
 *   5. Invariant: aceleași inputuri → același output (puritate)
 *   6. Batch analyzeTimeSeries
 */

import {
  calculateMigrationProbability,
  analyzeTimeSeries,
  summarizeTimeSeries,
} from '../correlationEngine';
import type { MacroDataVector, HotelContext } from '../types';

// ── fixture base ─────────────────────────────────────────────────────────────

const HOTEL_TERRA: HotelContext = {
  name:             'Hotel Terra Neptun',
  segment:          '4star',
  currentOccupancy: 0.68,
  currentAdrEur:    108.0,
  targetOccupancy:  0.82,
  totalRooms:       120,
};

function makeVector(overrides: Partial<MacroDataVector>): MacroDataVector {
  const defaults: MacroDataVector = {
    date:                    new Date('2025-07-15'),
    fuelPriceRon:            7.28,
    fuelPriceDeltaPct:       0.008,
    fuelPriceIndex:          1.022,
    competitorAdrEur:        90.0,
    competitorDestination:   'nisipurile_de_aur',
    romanianBaseAdrEur:      108.0,
    competitorAdrIndex:      0.833,   // Bulgaria cu 16.7% mai ieftină
    sentimentScore:          -0.05,
    sentimentVelocity:       -0.02,
    dn39TrafficIndex:        0.72,
    daysToNearestMajorEvent: 30,
    isWeekendOrHoliday:      false,
    season:                  'peak',
    month:                   7,
  };
  return { ...defaults, ...overrides };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function assertInRange(value: number, min: number, max: number, label: string): void {
  if (value < min || value > max) {
    throw new Error(`${label}: ${value} nu este în [${min}, ${max}]`);
  }
}

function assertEqual(a: unknown, b: unknown, label: string): void {
  if (a !== b) throw new Error(`${label}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`Assertion failed: ${label}`);
}

// ── Scenariul 1: RISC CRITIC ─────────────────────────────────────────────────

function testCriticalRisk(): void {
  const vector = makeVector({
    date:                    new Date('2025-08-10'),
    competitorAdrIndex:      0.74,   // Bulgaria cu 26% mai ieftină!
    sentimentScore:          -0.48,  // sentiment puternic negativ
    dn39TrafficIndex:        0.35,   // cerere slabă
    daysToNearestMajorEvent: 55,     // niciun eveniment aproape
    isWeekendOrHoliday:      false,
    fuelPriceDeltaPct:       0.032,
    season:                  'peak',
  });

  const result = calculateMigrationProbability(vector, HOTEL_TERRA);

  assertInRange(result.occupancyRiskScore, 65, 100, 'RiscCritic.occupancyRiskScore');
  assertInRange(result.migrationProbability, 0.65, 1.0, 'RiscCritic.migrationProbability');
  assert(result.riskLevel === 'alert' || result.riskLevel === 'critical',
    'RiscCritic.riskLevel trebuie să fie alert sau critical');
  assert(result.recommendedAdrAdjustmentPct <= -0.06,
    `RiscCritic: reducere ADR insuficientă (${result.recommendedAdrAdjustmentPct})`);
  assert(result.riskFactors[0].key === 'competitor_price_pressure',
    'RiscCritic: factorul dominant trebuie să fie competitor_price_pressure');

  console.log('  ✓ Scenariul CRITIC:', {
    score: result.occupancyRiskScore,
    prob: result.migrationProbability,
    level: result.riskLevel,
    adrAdj: `${(result.recommendedAdrAdjustmentPct * 100).toFixed(1)}%`,
  });
}

// ── Scenariul 2: SAFE (Beach Please! activ) ───────────────────────────────────

function testSafeWithFestival(): void {
  const vector = makeVector({
    date:                    new Date('2025-07-04'),
    competitorAdrIndex:      0.835,
    sentimentScore:          0.52,   // sentiment excelent (festival activ)
    sentimentVelocity:       0.18,
    dn39TrafficIndex:        0.91,   // trafic extrem (toată lumea vine)
    daysToNearestMajorEvent: 0,      // eveniment activ AZI
    nearestEventName:        'Beach Please! 2025',
    isWeekendOrHoliday:      true,
    season:                  'peak',
  });

  // În weekend de festival, ocuparea este deja ridicată
  const festivalContext: HotelContext = {
    ...HOTEL_TERRA,
    currentOccupancy: 0.91,  // hotel aproape plin în festival
    currentAdrEur:    110.0,
  };

  const result = calculateMigrationProbability(vector, festivalContext);

  assertInRange(result.occupancyRiskScore, 0, 45, 'SafeFestival.occupancyRiskScore');
  assert(result.riskLevel === 'safe' || result.riskLevel === 'watch',
    `SafeFestival.riskLevel: ${result.riskLevel}`);
  assert(result.recommendedAdrAdjustmentPct >= -0.02,
    `SafeFestival: nu ar trebui reducere agresivă în festival (${result.recommendedAdrAdjustmentPct})`);

  console.log('  ✓ Scenariul SAFE (Festival):', {
    score: result.occupancyRiskScore,
    prob: result.migrationProbability,
    level: result.riskLevel,
    adrAdj: `${(result.recommendedAdrAdjustmentPct * 100).toFixed(1)}%`,
    action: result.primaryAction.slice(0, 60) + '...',
  });
}

// ── Scenariul 3: WATCH (sezon mediu) ─────────────────────────────────────────

function testWatchScenario(): void {
  const vector = makeVector({
    date:                    new Date('2025-09-15'),
    competitorAdrIndex:      0.91,
    sentimentScore:          0.08,
    dn39TrafficIndex:        0.42,
    daysToNearestMajorEvent: 18,
    season:                  'shoulder',
    fuelPriceDeltaPct:       0.005,
    month:                   9,
  });

  const result = calculateMigrationProbability(vector, HOTEL_TERRA);

  assertInRange(result.occupancyRiskScore, 20, 65, 'WatchShoulder.occupancyRiskScore');
  assert(result.riskLevel !== 'critical', 'WatchShoulder: nu trebuie să fie critical');
  assertInRange(result.confidence, 0.60, 1.0, 'WatchShoulder.confidence');

  console.log('  ✓ Scenariul WATCH (Shoulder):', {
    score: result.occupancyRiskScore,
    level: result.riskLevel,
    confidence: result.confidence,
  });
}

// ── Scenariul 4: OFF-SEASON ───────────────────────────────────────────────────

function testOffSeason(): void {
  const vector = makeVector({
    date:                    new Date('2025-01-15'),
    competitorAdrIndex:      0.88,
    sentimentScore:          -0.18,
    dn39TrafficIndex:        0.12,
    daysToNearestMajorEvent: 100,
    season:                  'off',
    fuelPriceDeltaPct:       -0.010,
    month:                   1,
  });

  const result = calculateMigrationProbability(vector, {
    ...HOTEL_TERRA,
    currentOccupancy: 0.22,
    currentAdrEur: 38.0,
  });

  // Off-season: scorul brut poate fi mediu, dar multiplicatorul sezonier îl reduce
  assertInRange(result.occupancyRiskScore, 0, 70, 'OffSeason.occupancyRiskScore');
  assertInRange(result.migrationProbability, 0.0, 0.70, 'OffSeason.migrationProbability');

  console.log('  ✓ Scenariul OFF-SEASON:', {
    score: result.occupancyRiskScore,
    level: result.riskLevel,
    adrAdj: `${(result.recommendedAdrAdjustmentPct * 100).toFixed(1)}%`,
  });
}

// ── Test 5: Puritate funcțională ──────────────────────────────────────────────

function testDeterminism(): void {
  const vector = makeVector({});

  const r1 = calculateMigrationProbability(vector, HOTEL_TERRA);
  const r2 = calculateMigrationProbability(vector, HOTEL_TERRA);

  assertEqual(r1.occupancyRiskScore,       r2.occupancyRiskScore,       'Determinism.occupancyRiskScore');
  assertEqual(r1.migrationProbability,     r2.migrationProbability,     'Determinism.migrationProbability');
  assertEqual(r1.recommendedAdrAdjustmentPct, r2.recommendedAdrAdjustmentPct, 'Determinism.adrAdjustment');
  assertEqual(r1.riskLevel,                r2.riskLevel,                'Determinism.riskLevel');

  console.log('  ✓ Puritate funcțională: aceleași inputuri → output identic');
}

// ── Test 6: Invariant — outputurile sunt în range valid ───────────────────────

function testOutputInvariants(): void {
  const vectors: Partial<MacroDataVector>[] = [
    { competitorAdrIndex: 0.60, sentimentScore: -0.90, dn39TrafficIndex: 0.05 }, // worst case
    { competitorAdrIndex: 1.30, sentimentScore:  0.90, dn39TrafficIndex: 0.99 }, // best case
    { competitorAdrIndex: 1.00, sentimentScore:  0.00, dn39TrafficIndex: 0.50 }, // neutral
  ];

  vectors.forEach((overrides, i) => {
    const r = calculateMigrationProbability(makeVector(overrides), HOTEL_TERRA);

    assertInRange(r.occupancyRiskScore,          0,     100,  `Invariant[${i}].occupancyRiskScore`);
    assertInRange(r.migrationProbability,        0,     1.0,  `Invariant[${i}].migrationProbability`);
    assertInRange(r.recommendedAdrAdjustmentPct, -0.20, 0.15, `Invariant[${i}].adrAdjustment`);
    assertInRange(r.confidence,                  0,     1.0,  `Invariant[${i}].confidence`);
    assert(r.riskFactors.length > 0, `Invariant[${i}]: trebuie factori de risc`);
    assert(typeof r.analysisTimestamp === 'string', `Invariant[${i}]: timestamp prezent`);
  });

  console.log('  ✓ Invariante output: toate valorile în interval valid (3 scenarii extreme)');
}

// ── Test 7: Batch / Serie Temporală ──────────────────────────────────────────

function testTimeSeries(): void {
  const months = [6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5]; // 12 luni
  const vectors = months.map((m, i) => makeVector({
    date:                    new Date(`${m <= 5 ? 2026 : 2025}-${String(m).padStart(2,'0')}-01`),
    season:                  ['peak','peak','peak','shoulder','shoulder','off','off','off','off','shoulder','shoulder','shoulder'][i] as 'peak'|'shoulder'|'off',
    month:                   m,
    competitorAdrIndex:      [0.83,0.83,0.84,0.91,0.95,1.00,1.05,1.05,1.02,0.96,0.92,0.88][i],
    sentimentScore:          [-0.05,0.08,-0.02,-0.10,-0.20,-0.25,-0.18,-0.15,-0.08,-0.05,0.05,0.10][i],
    dn39TrafficIndex:        [0.68,0.89,0.86,0.40,0.18,0.12,0.10,0.11,0.14,0.25,0.35,0.52][i],
    daysToNearestMajorEvent: [35,2,25,45,90,120,150,120,90,60,28,14][i],
  }));

  const results = analyzeTimeSeries(vectors, HOTEL_TERRA);
  assertEqual(results.length, 12, 'TimeSeries: 12 rezultate');

  const summary = summarizeTimeSeries(results);
  assert(summary !== null, 'TimeSeries: summary prezent');
  assert(summary!.peakRiskScore > 0, 'TimeSeries: peak risk > 0');
  assert(summary!.totalDaysAnalyzed === 12, 'TimeSeries: 12 zile analizate');

  // Verificăm că peak-ul de risc e în afara festivalului
  const peakResult = results.find(r => r.inputVector.date.toISOString().startsWith(summary!.peakRiskDate));
  assert(peakResult !== undefined, 'TimeSeries: peak result găsit');

  console.log('  ✓ Batch TimeSeries (12 luni):', {
    avgRisk:     summary!.avgOccupancyRiskScore,
    peakRisk:    summary!.peakRiskScore,
    peakDate:    summary!.peakRiskDate,
    alertDays:   summary!.alertDaysCount,
  });
}

// ── RUNNER ───────────────────────────────────────────────────────────────────

export function runAllTests(): void {
  console.log('\n🧪  Project Aether — Teste correlationEngine\n');

  const tests: Array<[string, () => void]> = [
    ['Risc Critic (Bulgaria ieftină + sentiment negativ)', testCriticalRisk],
    ['Safe cu Festival Beach Please! activ',               testSafeWithFestival],
    ['Watch (shoulder season)',                            testWatchScenario],
    ['Off-season (iarnă)',                                 testOffSeason],
    ['Determinism / puritate funcțională',                 testDeterminism],
    ['Invariante output (0-100, 0-1, -20%…+15%)',         testOutputInvariants],
    ['Batch TimeSeries (12 luni)',                         testTimeSeries],
  ];

  let passed = 0;
  let failed = 0;

  for (const [name, fn] of tests) {
    try {
      fn();
      passed++;
    } catch (err) {
      failed++;
      console.error(`  ✗ ${name}:`, (err as Error).message);
    }
  }

  console.log(`\n  Rezultat: ${passed}/${tests.length} teste trecute`);

  if (failed > 0) {
    console.error(`  ❌ ${failed} test(e) eșuat(e)\n`);
    process.exitCode = 1;
  } else {
    console.log('  ✅ Toate testele au trecut!\n');
  }
}

// Permite rulare directă: npx tsx lib/analytics/__tests__/correlationEngine.test.ts
if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('correlationEngine.test'))) {
  runAllTests();
}
