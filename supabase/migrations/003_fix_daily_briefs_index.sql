-- 003_fix_daily_briefs_index.sql
-- Surfaced in live rehearsal 2026-06-13: the full production chain (generator
-- writes daily_briefs -> send.py ships it) failed at INSERT with SQLSTATE 54000
-- "index row size exceeds btree max". Cause: idx_briefs_latest was a COVERING
-- index that INCLUDEd content_jsonb, which exceeds the btree page limit (~2704 B)
-- once a brief carries real sections + citations. Redundant with
-- idx_briefs_property_date (same key cols). Applied live via Supabase migration
-- "fix_daily_briefs_oversized_index".
drop index if exists public.idx_briefs_latest;

-- NOTE: other schema changes applied live this session via Supabase-tracked
-- migrations (present in the linked project, not re-stated here):
--   tier1_provenance            (confidence/SLA cols, collector_status + brief_inputs views)
--   brief_inputs_observation_id (citation observation ids)
--   security_lockdown_phase0    (SEC-1/2/4: integrations_safe invoker, anon revokes)