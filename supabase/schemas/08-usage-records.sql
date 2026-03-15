do $$
begin
  if not exists (select 1 from pg_type where typname = 'usage_category') then
    create type public.usage_category as enum ('chat', 'tool', 'automation', 'agent_handoff');
  end if;

  if not exists (select 1 from pg_type where typname = 'usage_status') then
    create type public.usage_status as enum ('started', 'succeeded', 'failed', 'cancelled');
  end if;
end $$;

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

create index if not exists usage_records_run_id_idx on public.usage_records(run_id, started_at);
create index if not exists usage_records_session_id_idx on public.usage_records(session_id, started_at);
create index if not exists usage_records_user_id_idx on public.usage_records(user_id, started_at desc);

alter table public.usage_records enable row level security;

drop policy if exists "usage_records_owner_access" on public.usage_records;
create policy "usage_records_owner_access"
on public.usage_records
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
