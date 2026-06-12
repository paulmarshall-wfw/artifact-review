create table if not exists annotations (
  id uuid primary key,
  component_id text not null references review_components(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key,
  component_id text not null references review_components(id) on delete cascade,
  body text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists evidence_sources (
  id uuid primary key,
  component_id text not null references review_components(id) on delete cascade,
  kind text not null,
  value text not null,
  created_at timestamptz not null default now()
);

create table if not exists highlights (
  component_id text primary key references review_components(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists autosave_snapshots (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists task_definitions (
  task_key text primary key,
  provider_key text,
  required_capability text not null,
  prompt_version text not null,
  render_slot text not null,
  hook_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists prompt_versions (
  task_key text not null references task_definitions(task_key) on delete cascade,
  version text not null,
  prompt jsonb not null,
  created_at timestamptz not null default now(),
  primary key (task_key, version)
);

create table if not exists structured_output_schemas (
  task_key text not null references task_definitions(task_key) on delete cascade,
  version text not null,
  schema jsonb not null,
  created_at timestamptz not null default now(),
  primary key (task_key, version)
);

create table if not exists processing_hooks (
  hook_key text primary key,
  implementation_key text not null,
  policy text not null default 'block_when_missing',
  created_at timestamptz not null default now()
);

create table if not exists render_slot_mappings (
  render_slot text primary key,
  task_key text not null references task_definitions(task_key) on delete cascade
);

create table if not exists task_runs (
  id uuid primary key,
  task_key text not null references task_definitions(task_key),
  provider_key text,
  provider_profile_key text,
  prompt_version text not null,
  status text not null,
  validation_status text,
  external_send boolean not null default false,
  latency_ms integer,
  provenance jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists provider_readiness_observations (
  id uuid primary key,
  observed_at timestamptz not null default now(),
  readiness jsonb not null
);

