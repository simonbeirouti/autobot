do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type public.project_status as enum ('active', 'archived', 'deleted');
  end if;
end $$;

alter table public.projects
add column if not exists status public.project_status not null default 'active',
add column if not exists archived_at timestamptz,
add column if not exists deleted_at timestamptz;

update public.projects
set status = coalesce(status, 'active'::public.project_status)
where status is null;

alter table public.projects
drop constraint if exists projects_status_timestamp_check;

alter table public.projects
add constraint projects_status_timestamp_check check (
  (status = 'active' and archived_at is null and deleted_at is null)
  or (status = 'archived' and archived_at is not null and deleted_at is null)
  or (status = 'deleted' and deleted_at is not null)
);

create index if not exists projects_user_status_idx
on public.projects(user_id, status, updated_at desc);
