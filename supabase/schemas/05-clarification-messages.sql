create table if not exists public.clarification_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists clarification_messages_session_id_idx
on public.clarification_messages(session_id, created_at);

create index if not exists clarification_messages_user_id_idx
on public.clarification_messages(user_id, created_at desc);

alter table public.clarification_messages enable row level security;

drop policy if exists "clarification_messages_owner_access" on public.clarification_messages;
create policy "clarification_messages_owner_access"
on public.clarification_messages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
