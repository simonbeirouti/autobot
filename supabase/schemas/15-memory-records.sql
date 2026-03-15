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
end $$;

create table if not exists public.memory_records (
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

create index if not exists memory_records_user_id_idx
on public.memory_records(user_id, created_at desc);

create index if not exists memory_records_project_idx
on public.memory_records(project_id, created_at desc);

create index if not exists memory_records_objective_idx
on public.memory_records(objective_id, created_at desc);

drop trigger if exists memory_records_set_updated_at on public.memory_records;
create trigger memory_records_set_updated_at
before update on public.memory_records
for each row execute function public.set_updated_at();

alter table public.memory_records enable row level security;

drop policy if exists "memory_records_owner_access" on public.memory_records;
create policy "memory_records_owner_access"
on public.memory_records
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
