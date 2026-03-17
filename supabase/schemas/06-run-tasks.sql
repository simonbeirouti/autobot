do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('waiting', 'underway', 'complete');
  end if;
end $$;

create table if not exists public.run_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'waiting',
  position integer not null default 0,
  agent_id text,
  agent_label text,
  required_toolkit_slugs text[] not null default '{}'::text[],
  required_tool_ids text[] not null default '{}'::text[],
  execution_strategy text not null default 'analysis_only',
  tool_summary text,
  action_required jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists run_tasks_run_id_idx on public.run_tasks(run_id, position);

drop trigger if exists run_tasks_set_updated_at on public.run_tasks;
create trigger run_tasks_set_updated_at
before update on public.run_tasks
for each row execute function public.set_updated_at();

alter table public.run_tasks enable row level security;

drop policy if exists "run_tasks_owner_access" on public.run_tasks;
create policy "run_tasks_owner_access"
on public.run_tasks
for all
using (
  exists (
    select 1
    from public.runs
    where runs.id = run_tasks.run_id
      and runs.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.runs
    where runs.id = run_tasks.run_id
      and runs.user_id = auth.uid()
  )
);
