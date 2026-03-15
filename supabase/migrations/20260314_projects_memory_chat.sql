do $$
begin
  if not exists (select 1 from pg_type where typname = 'memory_scope') then
    create type public.memory_scope as enum ('company', 'project', 'objective', 'user');
  end if;

  if not exists (select 1 from pg_type where typname = 'memory_kind') then
    create type public.memory_kind as enum (
      'objective',
      'decision',
      'constraint',
      'fact',
      'artifact',
      'preference'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'objective_status') then
    create type public.objective_status as enum ('draft', 'active', 'completed', 'archived');
  end if;
end $$;

drop table if exists public.project_chat_messages cascade;
drop table if exists public.project_chat_threads cascade;
drop table if exists public.project_assets cascade;
drop table if exists public.objectives cascade;
drop table if exists public.memory_records cascade;
drop table if exists public.projects cascade;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_key text not null,
  name text not null,
  description text not null default '',
  icon_key text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_name_length_check check (char_length(name) between 5 and 10)
);

alter table public.runs
add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.intake_drafts
add column if not exists project_id uuid references public.projects(id) on delete cascade;

create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  source_run_id uuid references public.runs(id) on delete set null,
  source_draft_id uuid references public.intake_drafts(id) on delete set null,
  status public.objective_status not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.runs
add column if not exists objective_id uuid references public.objectives(id) on delete set null;

alter table public.intake_drafts
add column if not exists objective_id uuid references public.objectives(id) on delete set null;

create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  asset_type text not null,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.memory_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_key text not null,
  project_id uuid references public.projects(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete cascade,
  scope public.memory_scope not null,
  kind public.memory_kind not null,
  source_type text not null,
  source_id text,
  summary text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint memory_scope_check check (
    (scope = 'company' and project_id is null and objective_id is null)
    or (scope = 'project' and project_id is not null and objective_id is null)
    or (scope = 'objective' and project_id is not null and objective_id is not null)
    or (scope = 'user')
  )
);

create table public.project_chat_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.project_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.project_chat_threads(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  agent_id text,
  cited_memory_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists projects_user_id_idx on public.projects(user_id, updated_at desc);
create index if not exists objectives_project_id_idx on public.objectives(project_id, updated_at desc);
create index if not exists project_assets_project_id_idx on public.project_assets(project_id, updated_at desc);
create index if not exists runs_project_id_idx on public.runs(project_id);
create index if not exists runs_objective_id_idx on public.runs(objective_id);
create index if not exists intake_drafts_project_id_idx on public.intake_drafts(project_id, updated_at desc);
create index if not exists intake_drafts_objective_id_idx on public.intake_drafts(objective_id, updated_at desc);
create index if not exists memory_records_project_idx on public.memory_records(project_id, created_at desc);
create index if not exists memory_records_objective_idx on public.memory_records(objective_id, created_at desc);
create index if not exists project_chat_threads_project_id_idx on public.project_chat_threads(project_id, updated_at desc);
create index if not exists project_chat_threads_objective_id_idx on public.project_chat_threads(objective_id, updated_at desc);
create index if not exists project_chat_messages_thread_id_idx on public.project_chat_messages(thread_id, created_at asc);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists objectives_set_updated_at on public.objectives;
create trigger objectives_set_updated_at
before update on public.objectives
for each row execute function public.set_updated_at();

drop trigger if exists project_assets_set_updated_at on public.project_assets;
create trigger project_assets_set_updated_at
before update on public.project_assets
for each row execute function public.set_updated_at();

drop trigger if exists memory_records_set_updated_at on public.memory_records;
create trigger memory_records_set_updated_at
before update on public.memory_records
for each row execute function public.set_updated_at();

drop trigger if exists project_chat_threads_set_updated_at on public.project_chat_threads;
create trigger project_chat_threads_set_updated_at
before update on public.project_chat_threads
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.objectives enable row level security;
alter table public.project_assets enable row level security;
alter table public.memory_records enable row level security;
alter table public.project_chat_threads enable row level security;
alter table public.project_chat_messages enable row level security;

drop policy if exists "projects_owner_access" on public.projects;
create policy "projects_owner_access"
on public.projects
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "objectives_owner_access" on public.objectives;
create policy "objectives_owner_access"
on public.objectives
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "project_assets_owner_access" on public.project_assets;
create policy "project_assets_owner_access"
on public.project_assets
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "memory_records_owner_access" on public.memory_records;
create policy "memory_records_owner_access"
on public.memory_records
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "project_chat_threads_owner_access" on public.project_chat_threads;
create policy "project_chat_threads_owner_access"
on public.project_chat_threads
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "project_chat_messages_owner_access" on public.project_chat_messages;
create policy "project_chat_messages_owner_access"
on public.project_chat_messages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
