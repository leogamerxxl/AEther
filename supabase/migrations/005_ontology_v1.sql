-- 005_ontology_v1.sql — AETHER Ontology v1 (relational property-graph over Postgres; no Neo4j).
-- Generic entities + typed relationships overlay the operational tables, keeping the
-- world model vertical-agnostic (Principles 2/3). Systems-of-record stay the source
-- tables; this is the traversable economic graph above them. Populated idempotently by
-- public.ontology_sync() (service-role only), callable from the daily pipeline.
-- Applied to project irmyramqaovmgcktbazy as migrations 005_ontology_v1_schema + _sync_fn.

create table if not exists ontology_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  natural_key text not null,
  name text,
  org_id uuid references organizations(id) on delete cascade,
  property_id uuid,
  source_table text,
  source_id uuid,
  attributes jsonb not null default '{}'::jsonb,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ontology_entity_nk unique (natural_key)
);
create index if not exists ix_oe_type on ontology_entities(entity_type);
create index if not exists ix_oe_org on ontology_entities(org_id);
create index if not exists ix_oe_source on ontology_entities(source_table, source_id);

create table if not exists ontology_relationships (
  id uuid primary key default gen_random_uuid(),
  src_id uuid not null references ontology_entities(id) on delete cascade,
  relation text not null,
  dst_id uuid not null references ontology_entities(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  properties jsonb not null default '{}'::jsonb,
  confidence numeric,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ontology_edge unique (src_id, relation, dst_id)
);
create index if not exists ix_or_src on ontology_relationships(src_id);
create index if not exists ix_or_dst on ontology_relationships(dst_id);
create index if not exists ix_or_relation on ontology_relationships(relation);
create index if not exists ix_or_org on ontology_relationships(org_id);

create table if not exists ontology_entity_types (
  entity_type text primary key, label text, populated_v1 boolean not null default false,
  description text, created_at timestamptz not null default now()
);
create table if not exists ontology_relation_types (
  relation text primary key, label text, directed boolean not null default true,
  src_entity_type text, dst_entity_type text, description text,
  created_at timestamptz not null default now()
);

create trigger trg_oe_updated before update on ontology_entities
  for each row execute function public.update_updated_at_column();
create trigger trg_or_updated before update on ontology_relationships
  for each row execute function public.update_updated_at_column();

alter table ontology_entities enable row level security;
alter table ontology_relationships enable row level security;
alter table ontology_entity_types enable row level security;
alter table ontology_relation_types enable row level security;

create policy oe_select on ontology_entities for select to authenticated
  using (org_id is null or org_id in (select get_user_org_ids()));
create policy or_select on ontology_relationships for select to authenticated
  using (org_id is null or org_id in (select get_user_org_ids()));
create policy oet_select on ontology_entity_types for select to authenticated using (true);
create policy ort_select on ontology_relation_types for select to authenticated using (true);

insert into ontology_entity_types(entity_type, label, populated_v1, description) values
  ('market','Market',true,'A competitive geographic market'),
  ('property','Property',true,'A tenant-owned hotel'),
  ('competitor','Competitor',true,'A competing hotel in the comp set'),
  ('stay_date','Stay date',true,'A night being sold'),
  ('intelligence','Intelligence object',true,'A derived signal (insight envelope)'),
  ('observation','Observation',true,'A raw measured datum cited as evidence'),
  ('room_type','Room type',false,'reserved'),('rate_plan','Rate plan',false,'reserved'),
  ('event','Event',false,'reserved'),('weather_system','Weather system',false,'reserved'),
  ('department','Department',false,'reserved'),('asset','Asset',false,'reserved'),
  ('user','User',false,'reserved'),('recommendation','Recommendation',false,'reserved'),
  ('action','Action',false,'reserved'),('outcome','Outcome',false,'reserved')
on conflict (entity_type) do nothing;

insert into ontology_relation_types(relation, label, directed, src_entity_type, dst_entity_type, description) values
  ('located_in','located in',true,'property','market','spatial containment'),
  ('competes_with','competes with',true,'property','competitor','comp-set membership'),
  ('describes','describes',true,'intelligence','stay_date','what an IO concerns'),
  ('derived_from','derived from',true,'intelligence','observation','provenance chain'),
  ('affects','affects',true,'event','market','reserved'),
  ('proposes','proposes',true,'recommendation','action','reserved'),
  ('changes','changes',true,'action','property','reserved'),
  ('validates','validates',true,'outcome','recommendation','reserved')
on conflict (relation) do nothing;

-- Idempotent builder: rebuild the graph from systems-of-record. Service-role only.
create or replace function public.ontology_sync() returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_market_nk text := 'market:neptun-olimp';
  v_org uuid := '240004da-cceb-4ba8-8652-01b8bd94866f';
  v_region uuid := 'd7b661af-3613-48aa-868f-fad7bda70ffe';
  v_compset uuid := '497f9665-d8bc-4e0a-ba01-6dda25c2d9b7';
  v_terra uuid := '9c382e4f-fcad-4590-83ff-1fcce5a2223c';
  v_entities int; v_edges int;
begin
  insert into ontology_entities(entity_type, natural_key, name, attributes)
  values ('market', v_market_nk, 'Neptun-Olimp Corridor', jsonb_build_object('region_id', v_region))
  on conflict (natural_key) do update set name=excluded.name, updated_at=now();

  insert into ontology_entities(entity_type, natural_key, name, org_id, property_id, source_table, source_id, attributes)
  select 'property', 'property:'||p.id, p.name, p.organization_id, p.id, 'properties', p.id,
         jsonb_build_object('lat',p.lat,'lng',p.lng,'city',p.city,'stars',p.stars)
  from properties p where p.id = v_terra
  on conflict (natural_key) do update set name=excluded.name, attributes=excluded.attributes, updated_at=now();

  insert into ontology_entities(entity_type, natural_key, name, source_table, source_id, attributes)
  select 'competitor', 'competitor:'||sp.id, sp.name, 'scraped_properties', sp.id,
         jsonb_build_object('lat',sp.lat,'lng',sp.lng,'city',sp.city,'stars',sp.stars,'review_score',sp.review_score)
  from competitive_set_members m join scraped_properties sp on sp.id = m.scraped_property_id
  where m.competitive_set_id = v_compset
  on conflict (natural_key) do update set name=excluded.name, attributes=excluded.attributes, updated_at=now();

  insert into ontology_entities(entity_type, natural_key, name, attributes)
  select 'stay_date', 'stay_date:'||sd::text, to_char(sd,'YYYY-MM-DD'), jsonb_build_object('date', sd)
  from (select distinct stay_date sd from rate_observations where stay_date >= current_date) d
  on conflict (natural_key) do nothing;

  insert into ontology_entities(entity_type, natural_key, name, org_id, property_id, source_table, source_id, attributes)
  select 'intelligence', 'intelligence:'||io.id, io.signal_type,
         (select organization_id from properties where id = io.property_id), io.property_id,
         'intelligence_objects', io.id,
         jsonb_build_object('signal_type',io.signal_type,'severity',io.severity,'confidence',io.confidence)
  from intelligence_objects io where io.status='active'
  on conflict (natural_key) do update set attributes=excluded.attributes, updated_at=now();

  insert into ontology_entities(entity_type, natural_key, name, source_table, source_id)
  select distinct 'observation', 'observation:'||oid, 'observation',
         case io.signal_type when 'weather_demand_outlook' then 'macro_observations' else 'rate_observations' end,
         oid::uuid
  from intelligence_objects io
  cross join lateral jsonb_array_elements_text(io.evidence->0->'observation_ids') as oid
  where io.status='active' and io.evidence is not null
  on conflict (natural_key) do nothing;

  insert into ontology_relationships(src_id, relation, dst_id, org_id)
  select e.id, 'located_in', m.id, e.org_id
  from ontology_entities e join ontology_entities m on m.natural_key = v_market_nk
  where e.entity_type in ('property','competitor')
  on conflict (src_id,relation,dst_id) do nothing;

  insert into ontology_relationships(src_id, relation, dst_id, org_id, properties)
  select pe.id, 'competes_with', ce.id, v_org, jsonb_build_object('weight', m.weight)
  from competitive_set_members m
  join scraped_properties sp on sp.id = m.scraped_property_id
  join ontology_entities ce on ce.natural_key = 'competitor:'||sp.id
  join ontology_entities pe on pe.natural_key = 'property:'||v_terra
  where m.competitive_set_id = v_compset
  on conflict (src_id,relation,dst_id) do update set properties=excluded.properties, updated_at=now();

  insert into ontology_relationships(src_id, relation, dst_id, org_id, confidence)
  select ie.id, 'describes', se.id, ie.org_id, io.confidence
  from intelligence_objects io
  join ontology_entities ie on ie.natural_key = 'intelligence:'||io.id
  join ontology_entities se on se.natural_key = 'stay_date:'||(io.raw_jsonb->>'stay_date')
  where io.status='active' and io.signal_type='market_rate_pressure' and io.raw_jsonb ? 'stay_date'
  on conflict (src_id,relation,dst_id) do nothing;

  insert into ontology_relationships(src_id, relation, dst_id, org_id, confidence)
  select ie.id, 'describes', pe.id, ie.org_id, io.confidence
  from intelligence_objects io
  join ontology_entities ie on ie.natural_key = 'intelligence:'||io.id
  join ontology_entities pe on pe.natural_key = 'property:'||io.property_id
  where io.status='active' and io.signal_type='weather_demand_outlook'
  on conflict (src_id,relation,dst_id) do nothing;

  insert into ontology_relationships(src_id, relation, dst_id, org_id)
  select ie.id, 'derived_from', oe.id, ie.org_id
  from intelligence_objects io
  join ontology_entities ie on ie.natural_key = 'intelligence:'||io.id
  cross join lateral jsonb_array_elements_text(io.evidence->0->'observation_ids') as oid
  join ontology_entities oe on oe.natural_key = 'observation:'||oid
  where io.status='active' and io.evidence is not null
  on conflict (src_id,relation,dst_id) do nothing;

  select count(*) into v_entities from ontology_entities;
  select count(*) into v_edges from ontology_relationships;
  return jsonb_build_object('entities', v_entities, 'relationships', v_edges, 'synced_at', now());
end;
$$;

revoke all on function public.ontology_sync() from public, anon, authenticated;
grant execute on function public.ontology_sync() to service_role;