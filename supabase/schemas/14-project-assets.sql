create table if not exists public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  asset_type text not null,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_assets_project_id_idx
on public.project_assets(project_id, updated_at desc);

create index if not exists project_assets_user_id_idx
on public.project_assets(user_id, updated_at desc);

drop trigger if exists project_assets_set_updated_at on public.project_assets;
create trigger project_assets_set_updated_at
before update on public.project_assets
for each row execute function public.set_updated_at();

alter table public.project_assets enable row level security;

drop policy if exists "project_assets_owner_access" on public.project_assets;
create policy "project_assets_owner_access"
on public.project_assets
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
