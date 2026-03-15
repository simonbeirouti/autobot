do $$
begin
  if not exists (select 1 from pg_type where typname = 'intake_draft_status') then
    create type public.intake_draft_status as enum ('collecting_input', 'review_ready', 'executing', 'archived');
  end if;
end $$;

create table if not exists public.intake_drafts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,
  objective text not null,
  status public.intake_draft_status not null default 'collecting_input',
  current_step integer not null default 0,
  question_count integer not null default 0,
  clarification_summary text,
  execution_mode text check (execution_mode in ('single_agent', 'multi_agent')),
  confidence_to_proceed numeric(4,3),
  generated_markdown text,
  draft_markdown text,
  task_drafts jsonb not null default '[]'::jsonb,
  event_narrative jsonb not null default '[]'::jsonb,
  project_id uuid,
  objective_id uuid,
  last_generated_at timestamptz,
  last_edited_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists intake_drafts_user_id_idx
on public.intake_drafts(user_id, updated_at desc);

create index if not exists intake_drafts_session_id_idx
on public.intake_drafts(session_id);

create index if not exists intake_drafts_run_id_idx
on public.intake_drafts(run_id);

create index if not exists intake_drafts_project_id_idx
on public.intake_drafts(project_id, updated_at desc);

create index if not exists intake_drafts_objective_id_idx
on public.intake_drafts(objective_id, updated_at desc);

drop trigger if exists intake_drafts_set_updated_at on public.intake_drafts;
create trigger intake_drafts_set_updated_at
before update on public.intake_drafts
for each row execute function public.set_updated_at();

alter table public.intake_drafts enable row level security;

drop policy if exists "intake_drafts_owner_access" on public.intake_drafts;
create policy "intake_drafts_owner_access"
on public.intake_drafts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
