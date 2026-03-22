do $$
begin
  if not exists (select 1 from pg_type where typname = 'toolkit_connection_status') then
    create type public.toolkit_connection_status as enum (
      'not_connected',
      'initiated',
      'active',
      'failed',
      'expired',
      'disabled'
    );
  end if;
end $$;

create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  toolkit_slug text not null,
  composio_session_id text,
  connected_account_id text,
  status public.toolkit_connection_status not null default 'not_connected',
  redirect_url text,
  callback_url text,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint provider_connections_user_toolkit_unique unique (user_id, toolkit_slug)
);

create index if not exists provider_connections_user_id_idx
on public.provider_connections(user_id, updated_at desc);

drop trigger if exists provider_connections_set_updated_at on public.provider_connections;
create trigger provider_connections_set_updated_at
before update on public.provider_connections
for each row execute function public.set_updated_at();

alter table public.provider_connections enable row level security;

drop policy if exists "provider_connections_owner_access" on public.provider_connections;
create policy "provider_connections_owner_access"
on public.provider_connections
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
