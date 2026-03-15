create table if not exists public.project_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.project_chat_threads(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  agent_id text,
  cited_memory_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_chat_messages_thread_id_idx
on public.project_chat_messages(thread_id, created_at asc);

create index if not exists project_chat_messages_project_id_idx
on public.project_chat_messages(project_id, created_at asc);

create index if not exists project_chat_messages_objective_id_idx
on public.project_chat_messages(objective_id, created_at asc);

create index if not exists project_chat_messages_user_id_idx
on public.project_chat_messages(user_id, created_at asc);

alter table public.project_chat_messages enable row level security;

drop policy if exists "project_chat_messages_owner_access" on public.project_chat_messages;
create policy "project_chat_messages_owner_access"
on public.project_chat_messages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
