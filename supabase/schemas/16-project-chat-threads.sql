create table if not exists public.project_chat_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_chat_threads_project_id_idx
on public.project_chat_threads(project_id, updated_at desc);

create index if not exists project_chat_threads_objective_id_idx
on public.project_chat_threads(objective_id, updated_at desc);

create index if not exists project_chat_threads_user_id_idx
on public.project_chat_threads(user_id, updated_at desc);

drop trigger if exists project_chat_threads_set_updated_at on public.project_chat_threads;
create trigger project_chat_threads_set_updated_at
before update on public.project_chat_threads
for each row execute function public.set_updated_at();

alter table public.project_chat_threads enable row level security;

drop policy if exists "project_chat_threads_owner_access" on public.project_chat_threads;
create policy "project_chat_threads_owner_access"
on public.project_chat_threads
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
