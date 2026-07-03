-- 006_io_actions.sql — the decision record (first browser-write path) + pipeline_health.
-- io_actions: an authenticated tenant user records accept/dismiss on an IO recommendation.
-- Audit trail seeding outcome validation later — NOT a learning loop at n=1.
-- RLS: insert only as yourself, for your property, and the io_id must belong to that
-- property (blocks cross-tenant action attachment). Select tenant-scoped (drawer read-back).

create table if not exists io_actions (
  id uuid primary key default gen_random_uuid(),
  io_id uuid not null references intelligence_objects(id) on delete cascade,
  property_id uuid not null,
  org_id uuid not null references organizations(id) on delete cascade,
  action_type text not null,
  decision text not null check (decision in ('accepted','dismissed')),
  decided_by uuid not null,
  decided_at timestamptz not null default now(),
  note text,
  action_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint uq_io_action_per_user unique (io_id, decided_by)
);
create index if not exists ix_ioa_io on io_actions(io_id);
create index if not exists ix_ioa_property on io_actions(property_id);

alter table io_actions enable row level security;

create policy ioa_insert on io_actions for insert to authenticated
  with check (
    decided_by = auth.uid()
    and property_id in (select get_user_property_ids())
    and io_id in (select id from intelligence_objects io where io.property_id = io_actions.property_id)
  );

create policy ioa_select on io_actions for select to authenticated
  using (property_id in (select get_user_property_ids()));

create or replace view pipeline_health as
with latest as (
  select distinct on (agent_code) agent_code, status, ts, error
  from agent_runs order by agent_code, ts desc
),
briefs as (
  select count(*) as streak_days from (
    select distinct brief_date from daily_briefs
    where brief_date > (
      select coalesce(max(d.gap_date), '1970-01-01'::date) from (
        select (brief_date + 1) as gap_date from daily_briefs db
        where not exists (select 1 from daily_briefs db2 where db2.brief_date = db.brief_date + 1)
          and brief_date < current_date
      ) d
    )
  ) s
)
select l.agent_code, l.status as last_status, l.ts as last_run_at, left(l.error, 120) as last_error,
       (now() - l.ts) > interval '26 hours' as missed_schedule,
       (select streak_days from briefs) as brief_streak_days
from latest l;

comment on view pipeline_health is 'Ops surface: last run per agent, missed-schedule flag (>26h), consecutive-day brief streak.';