do $$
begin
  if not exists (select 1 from pg_type where typname = 'run_status') then
    create type public.run_status as enum ('clarifying', 'ready', 'running', 'completed', 'blocked', 'failed');
  end if;
end $$;

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  objective text not null,
  status public.run_status not null default 'clarifying',
  execution_mode text not null check (execution_mode in ('single_agent', 'multi_agent')),
  readiness_summary text,
  final_summary text,
  action_required jsonb,
  project_id uuid,
  objective_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists runs_user_id_idx on public.runs(user_id, created_at desc);
create index if not exists runs_session_id_idx on public.runs(session_id);
create index if not exists runs_project_id_idx on public.runs(project_id);
create index if not exists runs_objective_id_idx on public.runs(objective_id);

drop trigger if exists runs_set_updated_at on public.runs;
create trigger runs_set_updated_at
before update on public.runs
for each row execute function public.set_updated_at();

alter table public.runs enable row level security;

drop policy if exists "runs_owner_access" on public.runs;
create policy "runs_owner_access"
on public.runs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
