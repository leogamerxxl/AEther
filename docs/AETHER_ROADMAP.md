# AETHER — ROADMAP

**Constitution · Document 7 of 7 · v1.0 · 2026-06-10**
Governs: sequence. The Vision dreams, the Doctrine constrains, this document orders.
Rule: phases have **exit gates**, not end dates alone. A phase is left only through its gate. Changes to this roadmap require a `docs/DECISIONS.md` entry.

---

## 0. Where we actually are (2026-06-10)

Five days to the launch deadline. The honest ledger:

**Exists and works:** Supabase project with core tables + tenant model; Next.js command-center demo (glass kit, primitives, showcase); design language defined; ontology designed; collector code written in a previous session but **not present on disk / not deployed**.

**Missing or broken:** `nexus-scrape/`, `nexus-brief/`, `nexus-mail/` not on disk; `rate_observations` stale since 2026-05-22; no git repository; no deployment; no tests; demo UI shows fabricated numbers; SEC-1…SEC-5 unremediated (SEC-1 is live and exploitable); schema drift between local assumptions and remote.

The constitution does not pretend otherwise. Phase 0 is the bridge between these documents and reality.

---

## Phase 0 — SHIP THE BRIEF (Jun 10 → Jun 15, then streak through Jun 22)

**The only sprint.** Scope is the launch definition, verbatim: *morning brief email at the owner's inbox by 07:00 EEST, every day, with real scraped data, for 7 consecutive days.*

Order of work:

1. **Git init + remote, today.** No further work outside version control (Doctrine II.9).
2. **Stop the bleeding: SEC-1.** Revoke anon grants on `integrations_safe` / drop or convert to `security_invoker`. It is actively exploitable; it does not wait for Phase 1. (≤ 1 hour of work.)
3. **Rebuild/restore collectors** (`nexus-scrape`: booking_rates, weather, bnr_fx + `run_daily.py`), env-vars server-side only, deploy on a scheduler (DigitalOcean cron or equivalent). Gate: fresh rows in all three tables, dated today.
4. **Validation gate** (per DATA_SOURCES §5): stale/missing/anomaly checks between collect and generate. Fail loud.
5. **Brief generator** (`nexus-brief`): Romanian morning brief from real rows; Claude API; writes `daily_briefs.content_jsonb + rendered_html`; **logs the observation IDs used into content_jsonb** (cheap lineage now — Ontology §9.1).
6. **Email delivery** (`nexus-mail`): Resend, 07:00 EEST schedule, send recorded (`sent_at`); never sends on null HTML or double-sends.
7. **Agent runs logged** end-to-end; a one-page ops check (did yesterday run? cost? latency?).

**Exit gate:** 7 consecutive mornings (Jun 16–22 at the latest) of real-data briefs by 07:00 in Leonardo's inbox. Nothing else counts; nothing else ships.

**Explicitly out of scope in Phase 0:** all UI work, all design-language migration, all ontology tables, everything in Phases 1+. (Scope Doctrine, supremacy clause.)

## Phase 1 — PILOT HARDENING (Jun 16 → mid-Jul)

Trust infrastructure while the streak runs.

- **Security remediation, complete:** SEC-2 (`property_live_telemetry` lockdown), SEC-3 (tenant-scope `scraped_properties` reads), SEC-4 (`rls_auto_enable` anon revocation), SEC-5 (real Supabase auth default-on at the existing `lib/auth.ts` seam; demo role-picker removed from product shell). RLS review across all tables; advisors run clean.
- **Truth purge:** every fabricated number in the live app is removed or gated behind a visible SIMULATION designation (Doctrine III).
- **Tests:** pipeline boundary tests (collector → validator → brief → mail) with a test property_id; CI on the repo.
- **Schema reconciliation:** migrations as source of truth; drift eliminated.
- **Brief v1.1:** provenance footer (sources + observed_at per section), deep links reserved for Phase 2 surfaces.
- **First planned sources:** holiday calendars + local events (DATA_SOURCES §6 P1) — they feed the brief directly.

**Exit gate:** streak ≥ 21 days unbroken; security findings closed; owner reads the brief ≥ 5 of 7 mornings (engagement, not vanity).

## Phase 2 — THE COMMAND CENTER ON REAL DATA (Jul → Aug)

The demo becomes the product. Night Harbor migration order (Design Language §11–12):

1. Full-bleed world: remove the `.stage` frame; unify the three blacks → `night-0`.
2. Token sweep: ink ladder, type scale, 109 color literals → `command-theme`; numeric voice → Geist Mono everywhere.
3. **Provenance row** on MetricReadout / IntelCard / dossier — wired to real `observed_at` (the Bloomberg organ, on live data).
4. Retire gen-1 (`.panel` system + Dashboard.tsx); `/showcase` is the contract.
5. **Altitude choreography:** Coast (tilted sectors) ↔ Sector (extrusions) ↔ Asset (dossier morph) on the one true map; `(focus, altitude)` in the URL.
6. Dense tier + terminal table; alert rail with budgets (Command Center §4).
7. Brief deep-links land in the command center at the cited focus.

**Exit gate:** owner uses the command center (not just the email) ≥ 3×/week; every visible number has provenance; UXP-style altitude flight works on production data.

## Phase 3 — THE INTELLIGENCE LOOP (Sep → Oct)

Ontology V3 substrate (Ontology §9.2) — the product starts learning:

- Materialize `signals`, `forecasts`, `recommendations` (+ lifecycle events) with lineage columns; `places`/`markets` hierarchy.
- Signal typing contract live (Ontology §6); brief generator switches from "compute + prose" to "read graph + cite."
- Recommendation lifecycle in UI (accept / adapt / decline, recorded); re-forecast on action; outcome capture at T+window.
- Calibration scorecard (forecast vs. realized) visible in product and cited in the brief.
- P2 sources: flights/CND, search trends, review aggregates.

**Exit gate:** ≥ 20 recommendations measured through to Outcome; calibration published; pilot converts to paid (€150/month).

## Phase 4 — THE PLATFORM (Q4 2026 →)

Earned only by Phase 3's gate:

- Second property (same sector), then second sector (Mamaia or Eforie) — corridor entities go live.
- Vertical profile exercised by a non-hotel asset class (the Article 8 test).
- Action execution channel (price-push via channel manager integration) as governed Actions.
- Pricing model beyond the pilot; CEE market expansion thesis revisited against calibration data.

---

## Standing rules

1. **Gate order is absolute.** No Phase N+1 work while Phase N's gate is open, except security fixes (always in-phase).
2. **The streak is sacred.** Any change that risks tomorrow's 07:00 brief ships behind the day's send.
3. **Ideas file, not sprint.** Everything seductive goes to `docs/phase-n-ideas.md` until its phase arrives.
4. **Weekly honesty:** this file's §0 ledger is updated weekly; the roadmap that lies is dead weight.
