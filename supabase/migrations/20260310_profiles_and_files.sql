create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz
);

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

create index if not exists profile_files_profile_id_idx on public.profile_files(profile_id, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists profile_files_set_updated_at on public.profile_files;
create trigger profile_files_set_updated_at
before update on public.profile_files
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profile_files enable row level security;

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone."
on public.profiles
for select using (true);

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile."
on public.profiles
for insert
with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile."
on public.profiles
for update
using ((select auth.uid()) = id);

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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('profile-files', 'profile-files', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Profile files are publicly accessible." on storage.objects;
create policy "Profile files are publicly accessible."
on storage.objects
for select
using (bucket_id = 'profile-files');

drop policy if exists "Users can upload their own profile files." on storage.objects;
create policy "Users can upload their own profile files."
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update their own profile files in storage." on storage.objects;
create policy "Users can update their own profile files in storage."
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'profile-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete their own profile files in storage." on storage.objects;
create policy "Users can delete their own profile files in storage."
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
