-- 008_outcomes.sql - "Did the action work?" Each accepted decision is measured
-- against POST-decision observations of the same stay-date; deterministic verdict
-- (supported/contradicted/inconclusive). Applied via MCP 2026-07-04.
create table if not exists outcomes (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references io_actions(id) on delete cascade,
  io_id uuid not null references intelligence_objects(id) on delete cascade,
  property_id uuid not null,
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null default 'market_validation',
  measured_at timestamptz not null default now(),
  baseline jsonb not null default '{}'::jsonb,
  observed jsonb not null default '{}'::jsonb,
  delta jsonb not null default '{}'::jsonb,
  verdict text not null check (verdict in ('supported','contradicted','inconclusive')),
  evidence_ids jsonb not null default '[]'::jsonb,
  engine_version text,
  created_at timestamptz not null default now(),
  constraint uq_outcome_per_action unique (action_id)
);
create index if not exists ix_out_io on outcomes(io_id);
create index if not exists ix_out_property on outcomes(property_id);
alter table outcomes enable row level security;
create policy out_select on outcomes for select to authenticated
  using (property_id in (select get_user_property_ids()));
create or replace function public.fill_outcome_org() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  new.org_id := (select organization_id from properties where id = new.property_id);
  return new;
end; $$;
revoke all on function public.fill_outcome_org() from public, anon, authenticated;
drop trigger if exists trg_out_org on outcomes;
create trigger trg_out_org before insert on outcomes
  for each row execute function public.fill_outcome_org();