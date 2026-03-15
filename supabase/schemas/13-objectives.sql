do $$
begin
  if not exists (select 1 from pg_type where typname = 'objective_status') then
    create type public.objective_status as enum ('draft', 'active', 'completed', 'archived');
  end if;
end $$;

create table if not exists public.objectives (
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

create index if not exists objectives_project_id_idx
on public.objectives(project_id, updated_at desc);

create index if not exists objectives_user_id_idx
on public.objectives(user_id, updated_at desc);

create index if not exists objectives_source_run_id_idx
on public.objectives(source_run_id);

create index if not exists objectives_source_draft_id_idx
on public.objectives(source_draft_id);

drop trigger if exists objectives_set_updated_at on public.objectives;
create trigger objectives_set_updated_at
before update on public.objectives
for each row execute function public.set_updated_at();

alter table public.objectives enable row level security;

drop policy if exists "objectives_owner_access" on public.objectives;
create policy "objectives_owner_access"
on public.objectives
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.runs
drop constraint if exists runs_objective_id_fkey;

alter table public.runs
add constraint runs_objective_id_fkey
foreign key (objective_id) references public.objectives(id) on delete set null;

alter table public.intake_drafts
drop constraint if exists intake_drafts_objective_id_fkey;

alter table public.intake_drafts
add constraint intake_drafts_objective_id_fkey
foreign key (objective_id) references public.objectives(id) on delete set null;
