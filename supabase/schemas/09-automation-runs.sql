do $$
begin
  if not exists (select 1 from pg_type where typname = 'usage_status') then
    create type public.usage_status as enum ('started', 'succeeded', 'failed', 'cancelled');
  end if;
end $$;

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

create index if not exists automation_runs_user_id_idx
on public.automation_runs(user_id, started_at desc);

drop trigger if exists automation_runs_set_updated_at on public.automation_runs;
create trigger automation_runs_set_updated_at
before update on public.automation_runs
for each row execute function public.set_updated_at();

alter table public.automation_runs enable row level security;

drop policy if exists "automation_runs_owner_access" on public.automation_runs;
create policy "automation_runs_owner_access"
on public.automation_runs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
