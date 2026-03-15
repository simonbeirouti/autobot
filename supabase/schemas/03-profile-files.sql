create table if not exists public.profile_files (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  label text,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profile_files_profile_id_idx
on public.profile_files(profile_id, created_at desc);

drop trigger if exists profile_files_set_updated_at on public.profile_files;
create trigger profile_files_set_updated_at
before update on public.profile_files
for each row execute function public.set_updated_at();

alter table public.profile_files enable row level security;

drop policy if exists "Profile files are viewable by everyone." on public.profile_files;
create policy "Profile files are viewable by everyone."
on public.profile_files
for select using (true);

drop policy if exists "Users can insert their own profile files." on public.profile_files;
create policy "Users can insert their own profile files."
on public.profile_files
for insert
with check ((select auth.uid()) = profile_id);

drop policy if exists "Users can update their own profile files." on public.profile_files;
create policy "Users can update their own profile files."
on public.profile_files
for update
using ((select auth.uid()) = profile_id);

drop policy if exists "Users can delete their own profile files." on public.profile_files;
create policy "Users can delete their own profile files."
on public.profile_files
for delete
using ((select auth.uid()) = profile_id);
