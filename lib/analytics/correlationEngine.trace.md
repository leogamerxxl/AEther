# Trace Manual — calculateMigrationProbability

Validare manuală a algoritmului pe **Scenariul CRITIC** (August 2025)
pentru a demonstra că logica motorului produce rezultate corecte.

## Input Vector

| Câmp | Valoare |
|---|---|
| competitorAdrIndex | 0.74 (Bulgaria cu 26% mai ieftină) |
| sentimentScore | -0.48 (puternic negativ) |
| sentimentVelocity | -0.02 |
| dn39TrafficIndex | 0.35 (cerere slabă) |
| daysToNearestMajorEvent | 55 (niciun eveniment aproape) |
| season | 'peak' |
| fuelPriceDeltaPct | 0.032 (+3.2% față de luna trecută) |
| fuelPriceIndex | 1.022 |

## Calcul Pas cu Pas

### 1. Presiune preț competitor (weight 0.35)
```
adrIndex = 0.74 ≤ ADR_INDEX_CRITICAL (0.80)
excess   = 0.80 - 0.74 = 0.06
pressure = clamp01(0.85 + 0.06 × 2) = 0.97
```
**Contribuție** = 0.97 × 0.35 = **0.3395**

### 2. Presiune sentiment (weight 0.25)
```
basePressure = clamp01((1 - (-0.48)) / 2) = clamp01(0.74) = 0.74
velocity = -0.02 → penalitate 0 (prag: < -0.05)
pressure = 0.74
```
**Contribuție** = 0.74 × 0.25 = **0.1850**

### 3. Cerere trafic DN39 inversă (weight 0.15)
```
trafficIndex = 0.35 (între LOW=0.25 și MEDIUM=0.45)
inverseDemand = 1 - 0.35 = 0.65
pressure = 0.65 × 0.85 = 0.5525
```
**Contribuție** = 0.5525 × 0.15 = **0.0829**

### 4. Cost combustibil (weight 0.10)
```
deltaPressure = clamp01(0.032 × 4) = 0.128
indexPressure = clamp01((1.022 - 1.0) × 1.5) = 0.033
pressure = 0.128 × 0.6 + 0.033 × 0.4 = 0.090
```
**Contribuție** = 0.090 × 0.10 = **0.0090**

### 5. Absența evenimentelor (weight 0.10)
```
daysToNearestEvent = 55 > 45 → pressure = 0.80
```
**Contribuție** = 0.80 × 0.10 = **0.0800**

### 6. Calendar (weight 0.05)
```
isWeekend = false → weekendBonus = +0.10
season = 'peak' → basePressure = 0.50
pressure = 0.60
```
**Contribuție** = 0.60 × 0.05 = **0.0300**

### Scor brut total
```
rawScore = 0.3395 + 0.1850 + 0.0829 + 0.0090 + 0.0800 + 0.0300
         = 0.7264
```

### Multiplicator sezonier
```
season = 'peak' → multiplier = 1.20
migrationProbability = clamp01(0.7264 × 1.20) = clamp01(0.8717)
                     = 0.8717
```

### Scor de risc ocupare
```
occupancyRiskScore = 0.8717 × 100 = 87.17
riskLevel = 'critical' (≥ 72)
```

### Recomandare ADR
```
migrationProbability ≥ 0.75
occupancyGap = 0.82 - 0.68 = 0.14 (sub target dar nu critic)
baseAdjustment = -0.10 (path: gap ≤ 0.20)

suggestedAdrEur = 108.0 × (1 - 0.10) = 97.20 EUR
```

## Rezultat final

| Metrică | Valoare |
|---|---|
| occupancyRiskScore | **87.17 / 100** |
| migrationProbability | **0.8717 (87.2%)** |
| riskLevel | **critical** |
| recommendedAdrAdjustment | **-10.0%** |
| suggestedAdrEur | **97.20 EUR** (de la 108.00) |
| Factorul dominant | competitor_price_pressure (0.3395) |

## Interpretare pentru Hotel Terra Neptun

> ALERTĂ CRITICĂ — 87% probabilitate de pierdere masivă de rezervări.
> Bulgaria este cu 26% mai ieftină. Reduceți ADR cu 10% (→ 97€) și
> activați pachete de valoare adăugată (all-inclusive, transfer plajă).
> Fără acțiune, estimăm pierderea a 15-20 rezervări în săptămâna curentă.
