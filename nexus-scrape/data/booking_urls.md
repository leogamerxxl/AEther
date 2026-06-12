# Competitor Booking URLs — OWNER ACTION REQUIRED

The rates collector identifies each competitor by its Booking.com hotel URL
(matched on the /hotel/<cc>/<slug> path). 4 of 12 were auto-resolved and
verified live on 2026-06-12; 8 need the correct URL pasted by someone who
KNOWS which property is the competitor. Automated matching is unsafe for
ambiguous names (it matched "Vega Hotel Mamaia" to a Las Vegas suite and
"Zenith" to an unrelated Mamaia hotel) — so these are left for you, not guessed.

HOW: on booking.com, open each hotel's page, copy the URL up to ".html"
(e.g. https://www.booking.com/hotel/ro/iaki.en-gb.html). Then update
scraped_properties.booking_url for each id. Once >= 10 have URLs, the morning
brief flips from BLOCK to a real, cited recommendation.

## Resolved + verified (no action needed)
- Hotel Cocor Spa (Neptun)            -> ro/cocor-spa
- Iaki Conference & Spa Hotel (Mamaia)-> ro/iaki
- Modern Mamaia Resort (Mamaia)       -> ro/modern
- Splendid Hotel & Spa (Mamaia)       -> ro/splendid
    [CONFIRM: auto-matched "Splendid Conference & Spa Hotel - Adults Only".
     Verify this is the competitor you mean before trusting its rates.]

## Need the URL (8) — paste a booking.com/hotel/... link for each
- Arena Regia Hotel & Spa     (Mamaia)
- Hotel Comandor              (Mamaia)
- Savoy Hotel Mamaia          (Mamaia)
- Vega Hotel Mamaia           (Mamaia)
- Mera Onyx Hotel Neptun      (Neptun)
- Hotel Amfiteatru Olimp      (Olimp)
- Zenith Conference & Spa     (Olimp)   [auto-match was WRONG (golden-tulip-mamaia) — reverted to null]
- Nayino Resort Eforie Nord   (Eforie Nord)