# AETHER — Viziunea completa (canonica, dictata de owner 2026-07-04)
Vertical spatial intelligence OS pentru ospitalitate si turism; categoria pe termen
lung: infrastructura de inteligenta economica. Observa lumea larg (nu nisat),
intelege economia ospitalitatii pana la ultimul detaliu, modeleaza cum macro/micro
influenteaza cererea, genereaza inteligenta, o arata SPATIAL la locul ei (nu in
tabele generice), recomanda actiuni, inregistreaza rezultate, devine mai destept
zilnic. Multimodal la ingestie; descopera RELATIILE dintre date si varianta optima.

## Cele 8 intrebari ale produsului
What changed? Why does it matter? Where? Who is affected? What should we do?
How confident are we? What evidence supports this? Did the action work?

## Bucla fundamentala
observe -> store -> ontology -> signals -> intelligence_objects ->
brief/map/simulation -> user acts -> outcome recorded -> system learns.

## Spina primului produs
Briful de 07:00 + harta spatiala: presiunea cererii, miscarile competitorilor,
vremea, FX, evenimente-compresie, recomandare + evidenta + incredere + risc.
Fara certitudine falsa: BLOCK/STALE/DEGRADED/SAMPLE.

## Contract IO (tinta)
type, tenant, scope (country->product), altitude, title, summary,
causal_explanation, severity, confidence, freshness(status/observed/valid_from/to),
evidence_ids, source_ids, forecast_impact(revenue/adr/occupancy/demand/margin),
recommended_actions(action_type,label,rationale,expected_impact,risk),
dedupe_key, lifecycle_status(active/resolved/superseded/dismissed).

## Ontologie (entitati/relatii tinta)
Tenant,User,Role,Property,Department,RoomType,RatePlan,Competitor,CompetitorSet,
Market,City,Region,Coast,Country,StayDate,Event,WeatherSystem,DemandSignal,Source,
Observation,Signal,IntelligenceObject,Recommendation,Action,Outcome,AgentRun.
belongs_to,located_in,competes_with,part_of_competitor_set,observed_at,
derived_from,affects,causes_pressure_on,authorized_for,recommends,action_taken,
outcome_validates,supports,contradicts,supersedes. Postgres/PostGIS; fara graph DB
pana nu mai ajunge Postgres.

## Semnale (registrul tinta)
market_rate_pressure*, weather_demand_outlook*, fx_affordability_shift,
event_compression_pressure, competitor_move, pickup_anomaly,
availability_compression, review_reputation_shift, cancellation_risk,
fnb/spa_demand, staffing_pressure, energy_cost_pressure. (*live azi)
Reguli: determinist, testabil, idempotent, evidence-backed, confidence, freshness,
tenant-scoped. LLM explica/clasifica/reconciliaza - nu inventeaza semnalul.

## Separarea buclei de invatare
signals != recommendations != actions != outcomes. Tabele: recommendations,
actions, outcomes, action_feedback. Tinta: "Raise ADR 6-9% for July 12-14
because competitors moved up, weather favorable, availability tightening" ->
acceptat -> outcome masurat -> calibrare.

## Frontend: 5 moduri
Observe (starea bruta + collector health) / Brief (dimineata executiva) /
Map (suprafata principala) / Simulate (scenarii ADR/vreme/competitor) /
Act (accept/ignore/assign/schedule/done + outcome). Altitudine: global->country->
region->coast->city->market->property->department->room/product. Role-aware:
owner/GM/revenue/F&B/spa/chef/bartender vad DOAR ce le e relevant.

## Componente-sistem
CommandBar, AltitudeRail, ModeSwitcher, Tenant/PropertySwitcher, MarketSelector,
IntelligenceMap/Marker/Cluster, IntelligenceDrawer, EvidencePanel, ConfidenceMeter,
FreshnessBadge, BriefPanel, TimelineScrubber, MarketPressureStrip, ScenarioPanel,
ActionTracker, CollectorHealthPanel, RoleAwareNav, SimulationOverlay.

## Stari oneste
LIVE, SAMPLE, STALE, DEGRADED, BLOCK, UNAUTHORIZED, EMPTY, LOADING, ERROR.

## Straturi harta
base/terrain/buildings/properties/competitors/markets/events/weather/demand
pressure/rate pressure/IO/flows/simulation/actions. Low zoom = agregat;
high zoom = detaliu. Toggles operationale: [Demand][Rates][Weather][Events]
[Competitors][Actions].

## Ingestie (surse tinta)
OTA rates, availability, rate plans/min-stay/cancellation, PMS/OTB/pickup,
Google Trends, events, holidays, school calendars, flights, tourism stats,
weather, FX, macro, traffic, reviews, news, energy, staffing; multimodal:
PDF/menus/invoices/screenshots/emails/contracts/websites/images/floorplans.
Fiecare fapt: source_id, collected_at, observed_for_date, raw+normalized,
confidence, collector_run_id. Straturi: raw -> normalized -> domain observations.

## Roadmap faze
P1 backend truth loop (LIVE) -> P2 Ontology v1 -> P3 frontend operational ->
P4 action loop (accept/track/outcome/calibrare) -> P5 wider intelligence
(events/reviews/trends/flights/OTB/F&B/spa/staffing/energy) -> P6 simulare ->
P7 visual moat (3D Tiles/GLB/procedural/gaussian hero zones - ULTIMUL).

## Wedge comercial
Extern: "In fiecare dimineata, AETHER spune unui hotel de coasta ce s-a schimbat
in piata, de ce conteaza, ce actiune sa ia in calcul si ce evidenta o sustine."
Intern: OS de inteligenta economica. Moat: ontologia verticala + istoricul de
observatii + calitatea semnalelor + outcomes per tenant + modele economice +
interfata spatiala + bucla inchisa.
