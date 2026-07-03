# TODOS — deferred, decided, written down (autoplan 2026-07-03)

## Founder decisions (block business milestones, not code)
- [ ] Seasonality strategy BEFORE the ~Aug conversion talk: off-season product answer
      (2027 early-booking pace / comp opening-date intel / seasonal pricing). The compression
      signal goes quiet when the coast closes (~Sep).
- [ ] Owner engagement call: did he read the brief; what would he have done; will he fill OTB.
- [ ] Second tenant during the streak: manual SQL onboarding of 1 neighboring hotel
      (same market scrape, marginal cost ≈ one properties row + one email).
- [ ] Competitive one-pager: Lighthouse / PriceLabs / RoomPriceGenie CEE pricing; the one
      sentence Terra's owner hears from AETHER that they can't say.
- [ ] Apify paid-tier trigger: decide the $5→$49 upgrade point now, not during an outage.
- [ ] Oracle VM: provision as forever-home OR formally retire (DECISIONS.md either way).

## Engineering (deferred with reasons)
- [ ] WhatsApp delivery experiment (3-line compression alert) — after streak stabilizes.
- [ ] Per-property thresholds via property_strategy (constants fine at n=1).
- [ ] Per-day scrape flush in booking_rates.py (mid-loop failure loses paid fetches; retry
      currently refetches — acceptable at 7 runs/day).
- [ ] intelligence_objects retention policy (~15 rows/day accumulate).
- [ ] Incremental ontology_sync (full rebuild fine below ~100 properties).
- [ ] GH scheduled-workflow keepalive (schedules auto-disable after 60d repo inactivity).
- [ ] Mobile: bottom-sheet rail variant or /m route (v1 posture decided at gate).
- [ ] Full Romanian chrome localization (owner surface RO; dev artifacts EN for now).
- [ ] outcome VALIDATES computation (needs streak's daily data; stub view only).
- [ ] Savoy Hotel Mamaia booking_url (12th comp) + scraped_properties metadata cleanup
      (task_3e739f14: Nayino/Zenith/Mera city+coords).
- [ ] CoastalCommandCenter internals modernization (post-NIGHT-HARBOR pass beyond legend fix).
## Vision roadmap (owner brief 2026-07-03 — post-streak, in order of dependency)
- [ ] OODA loop closure: observe→orient (IOs) exists; decide (io_actions) shipping; ACT
      (rate-change execution path) and outcome VALIDATES computation = the loop's back half.
- [ ] Predictive layer: booking-pace forecast per stay-date once >=30 days of daily scrape
      history exists (the streak builds the training data; nothing to predict before it).
- [ ] Macro/micro sync: BNR FX + macro_observations already flow; add CEE macro calendar,
      holiday/event ingestion, local demand proxies (Google Trends) as registry collectors.
- [ ] Sensors/logistics (energy production/consumption, occupancy sensors): vertical_profiles-
      gated collector registry — same IO envelope, property/department altitude.
- [ ] Global/local sync: market→coast→country rollup views over ontology graph edges.
Design north star: UXP Smart City Platform (behance.net/gallery/202149327) — density + map-
first ops feel, executed strictly under NIGHT HARBOR tokens (two-temperature discipline).