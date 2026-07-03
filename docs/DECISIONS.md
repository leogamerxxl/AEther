# AETHER — DECISIONS LOG

Format per [OPERATING_DOCTRINE](AETHER_OPERATING_DOCTRINE.md): `## [DATE] — [Title]` → Why → Alternatives rejected.

---

## [2026-06-11] — Altitude axis redefined: Operational / Strategic / Executive

**Decision.** The altitude axis of `view = f(focus, altitude)` is **Operational / Strategic / Executive** (time horizon × aggregation × decision cadence). The spatial camera tiers (Coast / Sector / Asset) defined in [AETHER_COMMAND_CENTER.md](AETHER_COMMAND_CENTER.md) §1 are demoted to *derived framing*, computed per cell from `(focus.kind, altitude)`. Specified in [AETHER_FOCUS_ALTITUDE.md](AETHER_FOCUS_ALTITUDE.md); implemented in `lib/focus-altitude.ts`.

**Why.** Owner direction (2026-06-11 architecture request). The decision-nature of a view (act today / position this quarter / allocate this season) governs panels, alerts, recommendation affordances, and forecast grain far more than camera height does. A Segment or Corridor focus has no meaningful "Coast/Sector/Asset" zoom — but it has obvious operational/strategic/executive readings. Making the decision horizon the axis lets all five focus kinds share one matrix; the camera becomes a presentation concern.

**Alternatives rejected.**
1. *Keep Coast/Sector/Asset as altitude, lenses as modifier* (original COMMAND_CENTER design) — breaks for non-spatial focus kinds (segment, corridor) and conflates camera with decision cadence.
2. *Two independent axes (camera × lens), 45+ cells* — combinatorial surface no one would maintain; most combinations are meaningless (executive close-zoom).

**Compatibility.** COMMAND_CENTER §1 text is superseded but not edited (history preserved); its §3 routing matrix remains valid as the per-entity surface vocabulary, now consumed per-cell. No code depended on the old definition.

## 2026-07-03 — GitHub Actions cron is interim production; Oracle VM deferred
Why: the VM (built 2026-06-14, declared production in morning-brief.yml) was never provisioned;
the launch definition needs elapsed unattended days and the calendar is the critical path.
Cron 02:37 UTC enabled on the hardened workflow (timeout + secret preflight + concurrency).
Alternatives rejected: provision VM first (blocks streak on human setup); no cron (streak never starts).
Exit condition: provision the VM as forever-home or formally retire it (TODOS.md).

## 2026-07-03 — Launch deadline reset acknowledged
The 2026-06-15 launch definition date passed without a logged amendment. New definition marker:
7 consecutive unattended morning briefs with fresh market IOs, starting when the cron goes green.

## 2026-07-03 — Free-tier pause is a production risk (observed, not theoretical)
Supabase project auto-paused (INACTIVE) after ~10 idle days and Booking scrape DNS failed with it.
Mitigation: daily cron doubles as keepalive; pipeline_health.missed_schedule flags silence;
paid-tier triggers for Supabase + Apify are founder decisions logged in TODOS.md.