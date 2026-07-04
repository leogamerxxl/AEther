-- 010_pipeline_health_grants.sql - pipeline_health is an authenticated ops surface,
-- not a public endpoint. The view is postgres-owned (definer semantics over
-- agent_runs/daily_briefs) and exposes only operational metadata, no tenant data;
-- still, anon has no business reading it. Authenticated keeps SELECT only.
-- Applied via MCP 2026-07-04.
revoke all on pipeline_health from anon;
revoke all on pipeline_health from authenticated;
grant select on pipeline_health to authenticated;