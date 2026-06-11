# Morning Brief — Validation Checklist

Run order: automated gates first (the pipeline runs them), human checks before the first live send and weekly thereafter.

## Automated (every morning, enforced by code)

- [ ] All four collectors logged a run in `agent_runs` today (`status.py` / `collector_status` view)
- [ ] Rates coverage ≥ 10/12 properties on the latest scrape day (`validate.py` → gate)
- [ ] Rates freshness `fresh`/`cooling` — otherwise verdict = BLOCK and the recommendation is suppressed (never skipped silently)
- [ ] Rate anomalies (±60% vs 7-day median) flagged into the validator report
- [ ] OTB sanity: rooms ≤ capacity, ADR in 50–2000 RON band; pickup regressions flagged as cancellation signals
- [ ] FX plausibility: EUR/RON within 4.5–5.5, business-day fresh (weekend-aware)
- [ ] Citation walker passed: every digit-bearing section carries observation IDs (`check_citations` — generation fails otherwise)
- [ ] `daily_briefs.rendered_html` non-null; `content_jsonb.citations[]` non-empty on PASS days
- [ ] Send refuses double-send and null HTML (`send.py`)
- [ ] Sentinel at 06:55: `sent_at` set, else ops alert

## Human (before first live send, then weekly)

- [ ] Read the Romanian text end-to-end: would a hotel owner know what to do today in under 2 minutes?
- [ ] Every number in the email traceable: spot-check 2 citations against `rate_observations` / `otb_observations` rows by UUID
- [ ] Stale day rehearsal: confirm the BLOCK brief reads honestly (no recommendation, MORT/VECHI labels, no invented numbers)
- [ ] SIMULARE banner appears on any fixture/demo render — never on production data
- [ ] Subject line flags: `[DATE INCOMPLETE]` on BLOCK, `[SIMULARE]` on demo
- [ ] Recipient list correct (`BRIEF_RECIPIENTS`); reply-to reaches a human
- [ ] Confidence labels read honestly (scăzută/medie/bună) — no number without its label in the impact section

## Failure drills (once before June 15)

- [ ] Revoke Apify token → expect BLOCK brief + ops alert, no recommendation
- [ ] Empty OTB sheet → expect DEGRADE labels, directional-only recommendation
- [ ] Break Resend key → expect sentinel alert at 06:55
