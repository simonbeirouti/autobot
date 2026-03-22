create table if not exists public.user_tool_onboarding (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  selected_toolkit_slugs text[] not null default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists user_tool_onboarding_set_updated_at on public.user_tool_onboarding;
create trigger user_tool_onboarding_set_updated_at
before update on public.user_tool_onboarding
for each row execute function public.set_updated_at();

alter table public.user_tool_onboarding enable row level security;

drop policy if exists "user_tool_onboarding_owner_access" on public.user_tool_onboarding;
create policy "user_tool_onboarding_owner_access"
on public.user_tool_onboarding
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
