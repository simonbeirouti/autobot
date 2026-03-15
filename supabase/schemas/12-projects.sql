create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_key text not null,
  name text not null,
  description text not null default '',
  icon_key text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_name_length_check check (char_length(name) between 5 and 10)
);

create index if not exists projects_user_id_idx on public.projects(user_id, updated_at desc);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

drop policy if exists "projects_owner_access" on public.projects;
create policy "projects_owner_access"
on public.projects
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.runs
drop constraint if exists runs_project_id_fkey;

alter table public.runs
add constraint runs_project_id_fkey
foreign key (project_id) references public.projects(id) on delete cascade;

alter table public.intake_drafts
drop constraint if exists intake_drafts_project_id_fkey;

alter table public.intake_drafts
add constraint intake_drafts_project_id_fkey
foreign key (project_id) references public.projects(id) on delete cascade;
