create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'run_status') then
    create type public.run_status as enum ('clarifying', 'ready', 'running', 'completed', 'blocked', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('waiting', 'underway', 'complete');
  end if;

  if not exists (select 1 from pg_type where typname = 'event_type') then
    create type public.event_type as enum ('system', 'agent', 'tool', 'handoff', 'task');
  end if;

  if not exists (select 1 from pg_type where typname = 'usage_category') then
    create type public.usage_category as enum ('chat', 'tool', 'automation', 'agent_handoff');
  end if;

  if not exists (select 1 from pg_type where typname = 'usage_status') then
    create type public.usage_status as enum ('started', 'succeeded', 'failed', 'cancelled');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  objective text not null,
  status public.run_status not null default 'clarifying',
  execution_mode text not null check (execution_mode in ('single_agent', 'multi_agent')),
  readiness_summary text,
  final_summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.clarification_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.run_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'waiting',
  position integer not null default 0,
  agent_id text,
  agent_label text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  type public.event_type not null,
  agent_id text,
  agent_label text,
  color_token text,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.runs(id) on delete cascade,
  session_id uuid,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category public.usage_category not null,
  name text not null,
  agent_id text,
  status public.usage_status not null default 'started',
  input_summary text,
  result_summary text,
  token_count integer,
  latency_ms integer,
  cost_estimate numeric(10,4),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  automation_key text not null,
  status public.usage_status not null default 'started',
  input_summary text,
  result_summary text,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists runs_user_id_idx on public.runs(user_id, created_at desc);
create index if not exists runs_session_id_idx on public.runs(session_id);
create index if not exists clarification_messages_session_id_idx on public.clarification_messages(session_id, created_at);
create index if not exists clarification_messages_user_id_idx on public.clarification_messages(user_id, created_at desc);
create index if not exists run_tasks_run_id_idx on public.run_tasks(run_id, position);
create index if not exists run_events_run_id_idx on public.run_events(run_id, created_at);
create index if not exists usage_records_run_id_idx on public.usage_records(run_id, started_at);
create index if not exists usage_records_session_id_idx on public.usage_records(session_id, started_at);
create index if not exists usage_records_user_id_idx on public.usage_records(user_id, started_at desc);
create index if not exists automation_runs_user_id_idx on public.automation_runs(user_id, started_at desc);

drop trigger if exists runs_set_updated_at on public.runs;
create trigger runs_set_updated_at
before update on public.runs
for each row execute function public.set_updated_at();

drop trigger if exists run_tasks_set_updated_at on public.run_tasks;
create trigger run_tasks_set_updated_at
before update on public.run_tasks
for each row execute function public.set_updated_at();

drop trigger if exists automation_runs_set_updated_at on public.automation_runs;
create trigger automation_runs_set_updated_at
before update on public.automation_runs
for each row execute function public.set_updated_at();

alter table public.runs enable row level security;
alter table public.clarification_messages enable row level security;
alter table public.run_tasks enable row level security;
alter table public.run_events enable row level security;
alter table public.usage_records enable row level security;
alter table public.automation_runs enable row level security;

drop policy if exists "runs_owner_access" on public.runs;
create policy "runs_owner_access"
on public.runs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "clarification_messages_owner_access" on public.clarification_messages;
create policy "clarification_messages_owner_access"
on public.clarification_messages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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

drop policy if exists "run_events_owner_access" on public.run_events;
create policy "run_events_owner_access"
on public.run_events
for all
using (
  exists (
    select 1
    from public.runs
    where runs.id = run_events.run_id
      and runs.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.runs
    where runs.id = run_events.run_id
      and runs.user_id = auth.uid()
  )
);

drop policy if exists "usage_records_owner_access" on public.usage_records;
create policy "usage_records_owner_access"
on public.usage_records
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "automation_runs_owner_access" on public.automation_runs;
create policy "automation_runs_owner_access"
on public.automation_runs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
