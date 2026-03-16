create table if not exists public.project_toolkit_selections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  toolkit_slug text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint project_toolkit_selections_project_toolkit_unique unique (project_id, toolkit_slug)
);

create index if not exists project_toolkit_selections_project_id_idx
on public.project_toolkit_selections(project_id, created_at asc);

create index if not exists project_toolkit_selections_user_id_idx
on public.project_toolkit_selections(user_id, created_at asc);

alter table public.project_toolkit_selections enable row level security;

drop policy if exists "project_toolkit_selections_owner_access" on public.project_toolkit_selections;
create policy "project_toolkit_selections_owner_access"
on public.project_toolkit_selections
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
