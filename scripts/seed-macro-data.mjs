/**
 * Project Aether — Macro Seed Generator (ESM, fără dependențe externe)
 * Rulare directă: node scripts/seed-macro-data.mjs
 * Output:        supabase/seed.sql
 *
 * Acesta este echivalentul JS pur al scripts/seed-macro-data.ts,
 * rulabil fără tsx / ts-node, fără npm install.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

// ── utilitare ────────────────────────────────────────────────────────────────
const fmt  = d => d.toISOString().slice(0, 10);
const r    = (v, n = 4) => Math.round(v * 10**n) / 10**n;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function addMonths(d, n) {
  const x = new Date(d); x.setMonth(x.getMonth() + n); x.setDate(1); return x;
}
function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function monday(d) {
  const dow = d.getDay();
  const x   = new Date(d);
  x.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return x;
}
function season(month) {
  return [6,7,8].includes(month) ? 'peak' : [4,5,9,10].includes(month) ? 'shoulder' : 'off';
}
function isWeekend(d) { return [0, 6].includes(d.getDay()); }
function isHoliday(d) {
  const [m, day] = [d.getMonth()+1, d.getDate()];
  return (m===1&&day===1)||(m===5&&day===1)||(m===8&&day===15)||
         (m===11&&day===30)||(m===12&&day===1)||(m===12&&[25,26].includes(day));
}
// pseudo-random deterministă (nu folosim Math.random pentru reproducibilitate)
function det(seed, spread=0.03) {
  const v = ((seed * 1664525 + 1013904223) >>> 0) / 0xFFFFFFFF;
  return (v - 0.5) * 2 * spread;
}

function escapeSql(v) {
  if (v == null)         return 'NULL';
  if (typeof v==='boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v==='number')  return String(v);
  if (Array.isArray(v)) {
    if (v.length===0) return "'{}'";
    const items = v.map(x => `"${String(x).replace(/"/g,'\\"')}"`).join(',');
    return `ARRAY[${items}]::TEXT[]`;
  }
  return `'${String(v).replace(/'/g,"''")}'`;
}

function inserts(table, rows) {
  if (!rows.length) return `-- no rows for ${table}\n`;
  const cols = Object.keys(rows[0]);
  const vals = rows.map(row =>
    '  (' + cols.map(c => escapeSql(row[c])).join(', ') + ')'
  );
  return `INSERT INTO ${table} (${cols.join(', ')}) VALUES\n`
       + vals.join(',\n')
       + '\nON CONFLICT DO NOTHING;\n\n';
}

// ── 1. COMBUSTIBIL ───────────────────────────────────────────────────────────
const FUEL = [
  // [offset, ron, diesel]
  [0,  7.120,7.050],[1, 7.080,7.010],[2, 6.950,6.880],[3, 6.830,6.740],
  [4,  6.710,6.620],[5, 6.680,6.590],[6, 6.750,6.670],[7, 6.880,6.800],
  [8,  6.940,6.860],[9, 7.020,6.930],[10,7.100,7.010],[11,7.180,7.090],
  [12, 7.220,7.120],[13,7.280,7.170],[14,7.350,7.240],[15,7.150,7.040],
  [16, 6.980,6.870],[17,6.900,6.790],[18,6.950,6.840],[19,7.050,6.940],
  [20, 7.120,7.000],[21,7.180,7.060],[22,7.250,7.130],[23,7.320,7.190],
  [24, 7.380,7.240],[25,7.450,7.300],[26,7.420,7.270],
];
const FUEL_BASE = 7.120;
const BASE_DATE = new Date('2024-06-01');

function genFuel() {
  return FUEL.map(([off, ron, diesel]) => {
    const prev = off > 0 ? FUEL[off-1][1] : ron;
    return {
      period_month:     fmt(addMonths(BASE_DATE, off)),
      fuel_price_ron:   r(ron, 3),
      fuel_price_index: r(ron / FUEL_BASE, 4),
      fuel_delta_pct:   r((ron - prev) / prev, 4),
      diesel_price_ron: r(diesel, 3),
      region:           'romania_national',
      data_source:      'simulated_macro_v1',
      is_prediction:    off >= 24,
    };
  });
}

// ── 2. NEPTUN BASELINE 4★ ────────────────────────────────────────────────────
const NEPTUN = [
  [0, 85.0,72],[1,108.0,91],[2,115.0,94],[3,78.0,65],[4,52.0,38],[5,42.0,28],
  [6,45.0,30],[7,40.0,25],[8,38.0,22],[9,44.0,30],[10,58.0,45],[11,72.0,60],
  [12,88.0,75],[13,110.0,92],[14,118.0,95],[15,80.0,67],[16,54.0,40],[17,43.0,29],
  [18,46.0,31],[19,41.0,26],[20,39.0,23],[21,45.0,32],[22,60.0,47],[23,74.0,62],
  [24,90.0,77],[25,113.0,93],[26,120.0,95],
];
const EUR_RON = 4.97;

function genNeptun() {
  return NEPTUN.map(([off, adr, occ]) => {
    const month = (new Date(addMonths(BASE_DATE, off))).getMonth() + 1;
    return {
      period_month:   fmt(addMonths(BASE_DATE, off)),
      segment:        '4star',
      adr_eur:        r(adr, 2),
      adr_ron:        r(adr * EUR_RON, 2),
      occupancy_pct:  r(occ, 2),
      revpar_eur:     r(adr * occ / 100, 2),
      season:         season(month),
      data_source:    'simulated_macro_v1',
      is_prediction:  off >= 24,
    };
  });
}

// ── 3. COMPETITOR ADR ────────────────────────────────────────────────────────
const COMP_ADR = [
  [0, 72.5,58.0,68.0,95.0 ],[1, 88.0,72.0,82.0,125.0],[2, 92.0,76.0,86.0,130.0],
  [3, 65.0,52.0,61.0,82.0 ],[4, 45.0,35.0,42.0,52.0 ],[5, 38.0,30.0,35.0,40.0 ],
  [6, 42.0,33.0,39.0,44.0 ],[7, 35.0,28.0,32.0,36.0 ],[8, 38.0,30.0,35.0,38.0 ],
  [9, 42.0,34.0,39.0,44.0 ],[10,55.0,44.0,52.0,62.0 ],[11,68.0,55.0,64.0,78.0 ],
  [12,74.0,60.0,70.0,98.0 ],[13,90.0,74.0,84.0,128.0],[14,94.0,78.0,88.0,134.0],
  [15,66.0,53.0,62.0,84.0 ],[16,46.0,36.0,43.0,54.0 ],[17,39.0,31.0,36.0,41.0 ],
  [18,44.0,35.0,41.0,46.0 ],[19,36.0,29.0,33.0,37.0 ],[20,39.0,31.0,36.0,39.0 ],
  [21,44.0,35.0,41.0,46.0 ],[22,57.0,46.0,54.0,65.0 ],[23,70.0,57.0,66.0,80.0 ],
  [24,76.0,62.0,72.0,100.0],[25,92.0,76.0,86.0,131.0],[26,96.0,80.0,90.0,136.0],
];
const DESTS = [
  { key:'nisipurile_de_aur', label:'Nisipurile de Aur, Bulgaria', country:'BG', segment:'4star', lead:28 },
  { key:'sunny_beach',       label:'Sunny Beach, Bulgaria',       country:'BG', segment:'3star', lead:21 },
  { key:'albena',            label:'Albena Resort, Bulgaria',     country:'BG', segment:'4star', lead:32 },
  { key:'greek_halkidiki',   label:'Halkidiki, Grecia',           country:'GR', segment:'4star', lead:45 },
];

function genCompetitor() {
  const rows = [];
  COMP_ADR.forEach(([off, ...adrs]) => {
    const neptunAdr = NEPTUN[off][1];
    DESTS.forEach((dest, di) => {
      const adr  = adrs[di];
      const month= (new Date(addMonths(BASE_DATE, off))).getMonth()+1;
      const s    = season(month);
      const occBases = {peak:[88,85,82,78], shoulder:[55,50,52,48], off:[30,25,28,20]};
      const occ  = r(occBases[s][di] + det(off*10+di, 4), 1);
      rows.push({
        period_month:      fmt(addMonths(BASE_DATE, off)),
        destination_key:   dest.key,
        destination_label: dest.label,
        country:           dest.country,
        segment:           dest.segment,
        adr_eur:           r(adr, 2),
        adr_ron:           r(adr * EUR_RON, 2),
        adr_index:         r(adr / neptunAdr, 4),
        occupancy_pct:     occ,
        revpar_eur:        r(adr * occ / 100, 2),
        booking_lead_days: dest.lead,
        data_source:       'simulated_macro_v1',
        is_prediction:     off >= 24,
      });
    });
  });
  return rows;
}

// ── 4. SENTIMENT (săptămânal) ────────────────────────────────────────────────
const EVENTS_BOOSTS = [
  {s:'2024-07-04',e:'2024-07-06',boost:0.42,pos:['beach_please_2024','atmosfera_festiva']},
  {s:'2024-07-04',e:'2024-07-07',boost:0.25,pos:['neversea_2024','muzica_electronica']},
  {s:'2025-05-01',e:'2025-05-03',boost:0.30,pos:['1_mai_2025','deschidere_sezon']},
  {s:'2025-07-03',e:'2025-07-05',boost:0.45,pos:['beach_please_2025','headlineri_internationali']},
  {s:'2025-07-03',e:'2025-07-06',boost:0.22,pos:['neversea_2025','constanta']},
  {s:'2026-05-01',e:'2026-05-03',boost:0.28,pos:['1_mai_2026','sezon_deschis']},
  {s:'2026-07-02',e:'2026-07-04',boost:0.40,pos:['beach_please_2026','bilete_epuizate']},
];
const NEG_THEMES = ['pret_ridicat','servicii_slabe','aglomeratie','plaje_murdare',
  'parcare_imposibila','apa_turbure','restaurante_scumpe','cosmar_trafic_dn39',
  'infrastructura_precara','caldura_extrema','mizerie_pe_plaja'];
const POS_THEMES = ['mare_calda','apus_splendid','personal_amabil','mancare_buna',
  'plaja_curata','atmosfera_vesela','concerte_pe_plaja','festival_organizat_bine'];

function eventBoost(d) {
  const s = fmt(d);
  for (const ev of EVENTS_BOOSTS) {
    if (s >= ev.s && s <= ev.e) return { boost: ev.boost, pos: ev.pos };
  }
  // rezidual post-eveniment (7 zile)
  for (const ev of EVENTS_BOOSTS) {
    const after = fmt(addDays(new Date(ev.e), 7));
    if (s > ev.e && s <= after) return { boost: ev.boost * 0.25, pos: [ev.pos[0]+'_echo'] };
  }
  return { boost: 0, pos: [] };
}

function genSentiment() {
  const rows = [];
  let cur = monday(new Date('2024-06-03'));
  const end = new Date('2026-08-31');
  let prev = 0.05;
  let wi   = 0;

  while (cur <= end) {
    const month = cur.getMonth() + 1;
    const s     = season(month);
    const base  = s==='peak' ? 0.10 : s==='shoulder' ? -0.02 : -0.14;
    const trend = (cur.getFullYear() - 2024) * 0.04;
    const noise = det(wi * 31 + 7, 0.12);
    const { boost, pos } = eventBoost(cur);

    let score = clamp(base + trend + noise + boost, -0.85, 0.90);
    const vel = r(score - prev, 4);

    const total = s==='peak' ? 4200 + wi*8 : 1300 + wi*4;
    const posPct = (score + 1) / 2;
    const negPct = clamp((0.5 - score * 0.4), 0, 1);

    const negT = [];
    if (score < 0) {
      const n = Math.min(3, Math.ceil(Math.abs(score) * 3));
      for (let i=0; i<n; i++) negT.push(NEG_THEMES[(wi+i) % NEG_THEMES.length]);
    }
    const posT = pos.length > 0 ? pos.slice(0,2) :
      score > 0.1 ? [POS_THEMES[wi % POS_THEMES.length]] : [];

    rows.push({
      period_week_start:    fmt(cur),
      sentiment_score:      r(score, 4),
      positive_signal_count:Math.round(total * posPct),
      negative_signal_count:Math.round(total * negPct),
      neutral_signal_count: Math.max(0, Math.round(total * (1 - posPct - negPct))),
      sentiment_velocity:   vel,
      top_negative_themes:  negT,
      top_positive_themes:  posT,
      region_focus:         'neptun_costinesti_mamaia',
      data_source:          'simulated_macro_v1',
      is_prediction:        cur >= new Date('2026-06-01'),
    });

    prev = score; cur = addDays(cur, 7); wi++;
  }
  return rows;
}

// ── 5. TRAFIC DN39 (săptămânal) ──────────────────────────────────────────────
const TRAFFIC_BOOSTS = [
  {d:'2024-07-04',idx:0.88,festival:'Beach Please! 2024'},
  {d:'2024-07-05',idx:0.92,festival:'Beach Please! 2024'},
  {d:'2024-07-06',idx:0.90,festival:'Beach Please! 2024'},
  {d:'2025-05-01',idx:0.90,festival:'1 Mai Tradițional 2025'},
  {d:'2025-07-03',idx:0.87,festival:'Beach Please! 2025'},
  {d:'2025-07-04',idx:0.93,festival:'Beach Please! 2025'},
  {d:'2025-07-05',idx:0.91,festival:'Beach Please! 2025'},
  {d:'2026-05-01',idx:0.88,festival:'1 Mai 2026'},
  {d:'2026-07-02',idx:0.86,festival:'Beach Please! 2026'},
  {d:'2026-07-03',idx:0.92,festival:'Beach Please! 2026'},
  {d:'2026-07-04',idx:0.89,festival:'Beach Please! 2026'},
];

function trafficBoost(d) {
  const s = fmt(d);
  return TRAFFIC_BOOSTS.find(b => b.d === s) || null;
}

function genTraffic() {
  const rows = [];
  let cur = monday(new Date('2024-06-03'));
  const end = new Date('2026-08-31');
  let wi = 0;

  while (cur <= end) {
    const month   = cur.getMonth() + 1;
    const s       = season(month);
    const wknd    = isWeekend(cur);
    const hol     = isHoliday(cur);
    const boost   = trafficBoost(cur);

    let idx;
    if (boost) {
      idx = boost.idx;
    } else {
      const base  = s==='peak' ? 0.58 : s==='shoulder' ? 0.30 : 0.11;
      const wmult = wknd ? 1.45 : 1.0;
      const hmult = hol  ? 1.72 : 1.0;
      const noise = det(wi * 17 + 3, 0.06);
      idx = clamp(base * wmult * hmult * (1 + noise), 0.05, 0.98);
    }
    idx = r(idx, 4);

    const cong = idx >= 0.85 ? 'extreme' : idx >= 0.65 ? 'high' : idx >= 0.40 ? 'medium' : 'low';

    rows.push({
      event_date:           fmt(cur),
      traffic_index:        idx,
      direction:            'both',
      is_weekend:           wknd,
      is_public_holiday:    hol,
      is_festival_adjacent: boost !== null,
      festival_name:        boost ? boost.festival : null,
      congestion_level:     cong,
      peak_hour:            s==='peak' ? (wknd ? 11 : 14) : 16,
      estimated_vehicles:   Math.round(idx * 22000 + det(wi, 500)),
      weather_condition:    s==='peak' ? 'sunny' : (month>=11||month<=2) ? 'cloudy' : 'partly_cloudy',
      data_source:          'simulated_macro_v1',
      is_prediction:        cur >= new Date('2026-06-01'),
    });

    cur = addDays(cur, 7); wi++;
  }
  return rows;
}

// ── 6. EVENIMENTE ────────────────────────────────────────────────────────────
function genEvents() {
  return [
    // 2024
    {event_name:'Beach Please! Festival 2024',event_type:'music_festival',location:'Costinești',
     start_date:'2024-07-04',end_date:'2024-07-06',expected_attendance:35000,
     adr_impact_multiplier:1.22,occupancy_boost_pct:28.5,migration_shield:0.85,
     notes:'Festival internațional muzică electronică. Sold-out. Demografic 18–35.',
     is_confirmed:true,is_prediction:false},
    {event_name:'Neversea Festival 2024',event_type:'music_festival',location:'Constanța',
     start_date:'2024-07-04',end_date:'2024-07-07',expected_attendance:60000,
     adr_impact_multiplier:1.18,occupancy_boost_pct:22.0,migration_shield:0.78,
     notes:'Festival muzică plajă Constanța. Spillover spre Neptun/Mamaia.',
     is_confirmed:true,is_prediction:false},
    {event_name:'1 Mai Tradițional Neptun 2024',event_type:'national_holiday',location:'Neptun',
     start_date:'2024-05-01',end_date:'2024-05-05',expected_attendance:12000,
     adr_impact_multiplier:1.15,occupancy_boost_pct:35.0,migration_shield:0.70,
     notes:'Tradiție deschidere sezon.',is_confirmed:true,is_prediction:false},
    {event_name:'Festivalul Internațional Marea Neagră 2024',event_type:'cultural',location:'Mangalia',
     start_date:'2024-08-08',end_date:'2024-08-10',expected_attendance:8000,
     adr_impact_multiplier:1.08,occupancy_boost_pct:12.0,migration_shield:0.55,
     notes:'Festival cultural malul mării.',is_confirmed:true,is_prediction:false},
    // 2025
    {event_name:'1 Mai Tradițional Costinești 2025',event_type:'national_holiday',location:'Costinești',
     start_date:'2025-05-01',end_date:'2025-05-04',expected_attendance:15000,
     adr_impact_multiplier:1.18,occupancy_boost_pct:38.0,migration_shield:0.72,
     notes:'Headlineri locali.',is_confirmed:true,is_prediction:false},
    {event_name:'Beach Please! Festival 2025',event_type:'music_festival',location:'Costinești',
     start_date:'2025-07-03',end_date:'2025-07-05',expected_attendance:40000,
     adr_impact_multiplier:1.25,occupancy_boost_pct:32.0,migration_shield:0.88,
     notes:'3 scene, 80 artiști. Parteneriat Guvern pentru infrastructură.',
     is_confirmed:true,is_prediction:false},
    {event_name:'Neversea Festival 2025',event_type:'music_festival',location:'Constanța',
     start_date:'2025-07-03',end_date:'2025-07-06',expected_attendance:70000,
     adr_impact_multiplier:1.20,occupancy_boost_pct:25.0,migration_shield:0.80,
     notes:'A cincea ediție. Headlineri internaționali.',is_confirmed:true,is_prediction:false},
    {event_name:'Concurs Internațional Windsurfing Mangalia 2025',event_type:'sports',location:'Mangalia',
     start_date:'2025-08-22',end_date:'2025-08-24',expected_attendance:5000,
     adr_impact_multiplier:1.06,occupancy_boost_pct:8.0,migration_shield:0.45,
     notes:'Competiție sporturi nautice.',is_confirmed:true,is_prediction:false},
    // 2026 predicții
    {event_name:'1 Mai 2026 — Deschiderea Sezonului Estival',event_type:'national_holiday',location:'Costinești',
     start_date:'2026-05-01',end_date:'2026-05-04',expected_attendance:17000,
     adr_impact_multiplier:1.20,occupancy_boost_pct:40.0,migration_shield:0.73,
     notes:'Predicție. Cerere estimată în creștere față de 2025.',is_confirmed:false,is_prediction:true},
    {event_name:'Beach Please! Festival 2026 (predicție)',event_type:'music_festival',location:'Costinești',
     start_date:'2026-07-02',end_date:'2026-07-04',expected_attendance:45000,
     adr_impact_multiplier:1.28,occupancy_boost_pct:35.0,migration_shield:0.90,
     notes:'Predicție. Bilete pre-vânzare deja active.',is_confirmed:false,is_prediction:true},
    {event_name:'Neversea Festival 2026 (predicție)',event_type:'music_festival',location:'Constanța',
     start_date:'2026-07-02',end_date:'2026-07-05',expected_attendance:75000,
     adr_impact_multiplier:1.22,occupancy_boost_pct:28.0,migration_shield:0.82,
     notes:'Predicție. Ediție a șasea.',is_confirmed:false,is_prediction:true},
    {event_name:'Festivalul Gastronomic Litoral 2026',event_type:'cultural',location:'Neptun',
     start_date:'2026-08-14',end_date:'2026-08-16',expected_attendance:10000,
     adr_impact_multiplier:1.10,occupancy_boost_pct:15.0,migration_shield:0.60,
     notes:'Predicție. Festival gastronomic nou anunțat.',is_confirmed:false,is_prediction:true},
  ];
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
function main() {
  console.log('\n🌊  Project Aether — Macro Seed Generator');
  console.log('   Coridor: Neptun / DN39 / Beach Please! Costinești');
  console.log('   Perioadă: Iun 2024 → Aug 2026\n');

  const fuel       = genFuel();
  const neptun     = genNeptun();
  const competitor = genCompetitor();
  const sentiment  = genSentiment();
  const traffic    = genTraffic();
  const events     = genEvents();

  const total = fuel.length + neptun.length + competitor.length +
                sentiment.length + traffic.length + events.length;

  console.log(`   ✓ Combustibil (lunar):          ${fuel.length.toString().padStart(4)} rânduri`);
  console.log(`   ✓ Baseline Neptun 4★ (lunar):   ${neptun.length.toString().padStart(4)} rânduri`);
  console.log(`   ✓ ADR Competitori (lunar):       ${competitor.length.toString().padStart(4)} rânduri`);
  console.log(`   ✓ Sentiment Social (săptămânal): ${sentiment.length.toString().padStart(4)} rânduri`);
  console.log(`   ✓ Trafic DN39 (săptămânal):      ${traffic.length.toString().padStart(4)} rânduri`);
  console.log(`   ✓ Evenimente majore:             ${events.length.toString().padStart(4)} rânduri`);
  console.log(`   ${'─'.repeat(50)}`);
  console.log(`   Total rânduri: ${total}\n`);

  const now = new Date().toISOString();
  const sql = `-- ============================================================
-- Project Aether — Macro Corridor Seed Data
-- Generat: ${now}
-- Script:  scripts/seed-macro-data.mjs
-- Coridor: Litoral Românesc (Neptun/Costinești, DN39)
--          vs. Bulgaria (Nisipurile de Aur, Sunny Beach, Albena)
--          vs. Grecia (Halkidiki)
-- Zero-PII — date agregate de piață
-- Total: ${total} rânduri
-- ============================================================

SET client_encoding = 'UTF8';
BEGIN;

-- 1. PREȚURI COMBUSTIBIL
${inserts('macro_fuel_prices', fuel)}
-- 2. BASELINE ADR NEPTUN 4★
${inserts('romanian_neptun_adr_baseline', neptun)}
-- 3. ADR COMPETITORI
${inserts('competitor_adr_index', competitor)}
-- 4. SENTIMENT SOCIAL MEDIA (săptămânal)
${inserts('social_sentiment_index', sentiment)}
-- 5. TRAFIC DN39 (săptămânal)
${inserts('dn39_traffic_events', traffic)}
-- 6. CALENDAR EVENIMENTE
${inserts('coastal_events_calendar', events)}
COMMIT;
-- ✅ Seed importat — ${total} rânduri
`;

  const outPath = path.join(ROOT, 'supabase', 'seed.sql');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, sql, 'utf8');

  const kb = (Buffer.byteLength(sql, 'utf8') / 1024).toFixed(1);
  console.log(`   ✅ Scris: supabase/seed.sql (${kb} KB)\n`);
  console.log('   Importă în Supabase:');
  console.log('   $ supabase db push  (sau: psql $DATABASE_URL < supabase/seed.sql)\n');
}

main();
