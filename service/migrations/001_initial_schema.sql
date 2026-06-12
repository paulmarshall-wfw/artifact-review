create table if not exists projects (
  id uuid primary key,
  name text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key,
  project_id uuid references projects(id) on delete set null,
  name text not null,
  source_type text not null,
  original_format text not null,
  current_workflow_item_ref text,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_versions (
  id uuid primary key,
  document_id uuid not null references documents(id) on delete cascade,
  version_number integer not null,
  source_snapshot text not null,
  current_snapshot text not null,
  parser_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create table if not exists review_components (
  id text primary key,
  document_id uuid not null references documents(id) on delete cascade,
  kind text not null,
  section_id text not null,
  source_range jsonb not null default '{}',
  current_text text not null,
  original_text_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists component_revisions (
  id uuid primary key,
  component_id text not null references review_components(id) on delete cascade,
  previous_text text not null,
  revised_text text not null,
  edit_source text not null,
  ai_suggestion_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists ai_suggestions (
  id uuid primary key,
  component_id text not null references review_components(id) on delete cascade,
  task_run_id uuid,
  proposed_text text not null,
  rationale text not null,
  confidence numeric(4, 3) not null,
  warnings jsonb not null default '[]',
  status text not null check (status in ('proposed', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

