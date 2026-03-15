do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_type') then
    create type public.event_type as enum ('system', 'agent', 'tool', 'handoff', 'task');
  end if;
end $$;

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

create index if not exists run_events_run_id_idx on public.run_events(run_id, created_at);

alter table public.run_events enable row level security;

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
