create table if not exists workflows (
  id text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists workflow_nodes (
  id text primary key,
  workflow_id text not null references workflows(id) on delete cascade,
  label text not null,
  node_type text not null check (node_type in ('compute', 'quality', 'security', 'approval', 'deploy')),
  planned_duration_minutes integer not null check (planned_duration_minutes > 0),
  position_x numeric(5, 2) not null,
  position_y numeric(5, 2) not null
);

create table if not exists workflow_edges (
  workflow_id text not null references workflows(id) on delete cascade,
  from_node_id text not null references workflow_nodes(id) on delete cascade,
  to_node_id text not null references workflow_nodes(id) on delete cascade,
  primary key (workflow_id, from_node_id, to_node_id)
);

create table if not exists release_audit_events (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  workflow_id text not null,
  run_id text not null,
  event_type text not null,
  actor text,
  node_id text,
  status text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists release_audit_events_run_idx
on release_audit_events (tenant_id, project_id, workflow_id, run_id, created_at);

create table if not exists release_policies (
  tenant_id text not null,
  policy_id text not null,
  name text not null,
  description text,
  required_node_types jsonb not null,
  fail_on_node_types jsonb not null,
  warn_on_waiting_approval boolean not null default true,
  block_on_migration_risk boolean not null default true,
  require_approval_before_deploy boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, policy_id)
);

insert into workflows (id, name, description)
values (
  'release-command-center',
  'Production Release',
  'GraphFlow demo workflow for release intelligence and bottleneck detection.'
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description;

insert into workflow_nodes (
  id,
  workflow_id,
  label,
  node_type,
  planned_duration_minutes,
  position_x,
  position_y
)
values
  ('build', 'release-command-center', 'Build', 'compute', 4, 8, 40),
  ('unit', 'release-command-center', 'Unit Tests', 'quality', 7, 25, 18),
  ('scan', 'release-command-center', 'Security Scan', 'security', 9, 25, 62),
  ('approval', 'release-command-center', 'Release Approval', 'approval', 12, 48, 40),
  ('staging', 'release-command-center', 'Deploy Staging', 'deploy', 6, 68, 25),
  ('smoke', 'release-command-center', 'Smoke Test', 'quality', 5, 68, 58),
  ('prod', 'release-command-center', 'Deploy Production', 'deploy', 8, 88, 40)
on conflict (id) do update
set label = excluded.label,
    node_type = excluded.node_type,
    planned_duration_minutes = excluded.planned_duration_minutes,
    position_x = excluded.position_x,
    position_y = excluded.position_y;

insert into workflow_edges (workflow_id, from_node_id, to_node_id)
values
  ('release-command-center', 'build', 'unit'),
  ('release-command-center', 'build', 'scan'),
  ('release-command-center', 'unit', 'approval'),
  ('release-command-center', 'scan', 'approval'),
  ('release-command-center', 'approval', 'staging'),
  ('release-command-center', 'approval', 'smoke'),
  ('release-command-center', 'staging', 'prod'),
  ('release-command-center', 'smoke', 'prod')
on conflict do nothing;

create or replace view workflow_graph as
select
  w.id as workflow_id,
  w.name as workflow_name,
  n.id as node_id,
  n.label,
  n.node_type,
  n.planned_duration_minutes,
  coalesce(
    json_agg(e.to_node_id order by e.to_node_id) filter (where e.to_node_id is not null),
    '[]'::json
  ) as unlocks
from workflows w
join workflow_nodes n on n.workflow_id = w.id
left join workflow_edges e on e.workflow_id = w.id and e.from_node_id = n.id
group by w.id, w.name, n.id, n.label, n.node_type, n.planned_duration_minutes;

create or replace view release_audit_summary as
select
  tenant_id,
  project_id,
  workflow_id,
  run_id,
  count(*) as event_count,
  min(created_at) as first_event_at,
  max(created_at) as last_event_at
from release_audit_events
group by tenant_id, project_id, workflow_id, run_id;
