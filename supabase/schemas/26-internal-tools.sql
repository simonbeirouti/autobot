do $$
begin
  if not exists (select 1 from pg_type where typname = 'internal_tool_source') then
    create type public.internal_tool_source as enum ('internal_builtin', 'internal_custom');
  end if;

  if not exists (select 1 from pg_type where typname = 'tool_approval_policy') then
    create type public.tool_approval_policy as enum ('none', 'confirm_writes');
  end if;
end $$;

create table if not exists public.internal_tool_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  toolkit_slug text not null unique,
  source public.internal_tool_source not null,
  title text not null,
  description text not null,
  execution_mode text not null,
  risk_level text not null,
  executor_key text not null,
  input_schema jsonb,
  output_schema jsonb,
  tags text[] not null default '{}'::text[],
  capabilities text[] not null default '{}'::text[],
  approval_policy public.tool_approval_policy not null default 'none',
  requires_connection boolean not null default false,
  enabled_by_default boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_internal_tool_enablements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_slug text not null references public.internal_tool_definitions(slug) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_internal_tool_enablements_project_tool_unique unique (project_id, tool_slug)
);

create index if not exists internal_tool_definitions_source_idx
on public.internal_tool_definitions(source, created_at asc);

create index if not exists project_internal_tool_enablements_project_idx
on public.project_internal_tool_enablements(project_id, created_at asc);

create index if not exists project_internal_tool_enablements_user_idx
on public.project_internal_tool_enablements(user_id, created_at asc);

drop trigger if exists internal_tool_definitions_set_updated_at on public.internal_tool_definitions;
create trigger internal_tool_definitions_set_updated_at
before update on public.internal_tool_definitions
for each row execute function public.set_updated_at();

drop trigger if exists project_internal_tool_enablements_set_updated_at on public.project_internal_tool_enablements;
create trigger project_internal_tool_enablements_set_updated_at
before update on public.project_internal_tool_enablements
for each row execute function public.set_updated_at();

alter table public.internal_tool_definitions enable row level security;
alter table public.project_internal_tool_enablements enable row level security;

drop policy if exists "internal_tool_definitions_read_access" on public.internal_tool_definitions;
create policy "internal_tool_definitions_read_access"
on public.internal_tool_definitions
for select
using (auth.uid() is not null);

drop policy if exists "project_internal_tool_enablements_owner_access" on public.project_internal_tool_enablements;
create policy "project_internal_tool_enablements_owner_access"
on public.project_internal_tool_enablements
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
