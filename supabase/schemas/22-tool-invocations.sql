create table if not exists public.tool_invocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete set null,
  thread_id uuid references public.project_chat_threads(id) on delete set null,
  run_id uuid references public.runs(id) on delete set null,
  toolkit_slug text not null,
  tool_slug text not null,
  status text not null,
  input_summary text,
  result_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists tool_invocations_user_id_idx
on public.tool_invocations(user_id, created_at desc);

create index if not exists tool_invocations_project_id_idx
on public.tool_invocations(project_id, created_at desc);

alter table public.tool_invocations enable row level security;

drop policy if exists "tool_invocations_owner_access" on public.tool_invocations;
create policy "tool_invocations_owner_access"
on public.tool_invocations
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
