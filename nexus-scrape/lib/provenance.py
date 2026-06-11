"""Provenance constants + confidence calculators (plan s2-s5).

Confidence is never fabricated: source prior x measurable quality only.
Priors are seeded in signal_sources.reliability_prior (tier1_provenance
migration); mirrored here so dry-runs work offline.
"""

SOURCE_APIFY = "18c5c97c-fcd9-4a2d-b98e-81e37bdc83ed"
SOURCE_OWM = "47cf612c-525c-4482-8ffa-c8794b977e55"
SOURCE_BNR = "e95ad04c-541a-4a27-9384-0719563d7eb8"
SOURCE_MANUAL = "971746c5-80e7-4ab4-aa28-ffaf748713c3"
CAT_CLIMATE = "e4b6728a-d5bf-47ee-bd5f-6d063bf60863"
CAT_ECONOMIC = "4d4be30a-1de2-4e03-86f7-978c0d268667"
COUNTRY_RO = "41f96760-af11-4637-9c54-6e8e451a2e68"
REGION_COAST = "d7b661af-3613-48aa-868f-fad7bda70ffe"
PROPERTY_TERRA = "9c382e4f-fcad-4590-83ff-1fcce5a2223c"

RATE_PRIOR = 0.85       # Apify/Booking public-page scrape
OTB_PRIOR = 0.95        # first-party
WEATHER_PRIOR = 0.90    # OWM licensed API
FX_CONFIDENCE = 0.99    # official reference rate

# OWM confidence decays with forecast horizon (plan s4).
WEATHER_HORIZON = {0: 1.00, 1: 0.95, 2: 0.90, 3: 0.84, 4: 0.77, 5: 0.69, 6: 0.60}

RATE_FIELDS = ("stay_date", "rate_amount", "currency_code", "room_type",
               "availability_state", "rooms_remaining")


def rate_confidence(row: dict) -> float:
    present = sum(1 for f in RATE_FIELDS if row.get(f) not in (None, ""))
    quality = max(0.6, present / len(RATE_FIELDS))
    return round(RATE_PRIOR * quality, 3)


def otb_confidence(has_adr: bool) -> float:
    return round(OTB_PRIOR * (1.0 if has_adr else 0.85), 3)


def weather_confidence(days_ahead: int) -> float:
    d = min(max(days_ahead, 0), 6)
    return round(WEATHER_PRIOR * WEATHER_HORIZON[d], 3)