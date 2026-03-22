create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  marketing_email boolean not null default true,
  platform_updates_email boolean not null default true,
  platform_updates_in_app boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('marketing', 'platform_updates')),
  channel text not null check (channel in ('in_app', 'email')),
  kind text not null,
  title text not null,
  body text not null,
  href text,
  action_label text,
  action_href text,
  read_at timestamptz,
  dismissed_at timestamptz,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_user_created_idx
on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
on public.notifications(user_id, read_at, dismissed_at, created_at desc);

create unique index if not exists notifications_user_channel_dedupe_idx
on public.notifications(user_id, channel, dedupe_key)
where dedupe_key is not null;

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "notification_preferences_owner_access" on public.notification_preferences;
create policy "notification_preferences_owner_access"
on public.notification_preferences
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "notifications_owner_select" on public.notifications;
create policy "notifications_owner_select"
on public.notifications
for select
using (auth.uid() = user_id);

drop policy if exists "notifications_owner_update" on public.notifications;
create policy "notifications_owner_update"
on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "notifications_owner_insert" on public.notifications;
create policy "notifications_owner_insert"
on public.notifications
for insert
with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.notification_preferences (user_id)
select id
from public.profiles
on conflict (user_id) do nothing;
