do $$
begin
  if not exists (select 1 from pg_type where typname = 'feedback_submission_type') then
    create type public.feedback_submission_type as enum ('feedback', 'feature_request');
  end if;
end $$;

create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_email text,
  user_name text,
  type public.feedback_submission_type not null,
  score smallint not null,
  title text not null,
  description text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint feedback_submissions_score_check check (score between 1 and 10),
  constraint feedback_submissions_title_not_empty_check check (char_length(btrim(title)) > 0),
  constraint feedback_submissions_description_not_empty_check check (
    char_length(btrim(description)) > 0
  )
);

create index if not exists feedback_submissions_created_at_idx
on public.feedback_submissions(created_at desc);

create index if not exists feedback_submissions_type_created_at_idx
on public.feedback_submissions(type, created_at desc);

create index if not exists feedback_submissions_user_created_at_idx
on public.feedback_submissions(user_id, created_at desc);

drop trigger if exists feedback_submissions_set_updated_at on public.feedback_submissions;
create trigger feedback_submissions_set_updated_at
before update on public.feedback_submissions
for each row execute function public.set_updated_at();

alter table public.feedback_submissions enable row level security;

drop policy if exists "feedback_submissions_owner_access" on public.feedback_submissions;
create policy "feedback_submissions_owner_access"
on public.feedback_submissions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
