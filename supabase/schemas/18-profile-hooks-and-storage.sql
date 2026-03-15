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
