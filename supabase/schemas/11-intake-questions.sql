create table if not exists public.intake_questions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.intake_drafts(id) on delete cascade,
  position integer not null default 0,
  question text not null,
  description text not null default '',
  input_kind text not null default 'textarea',
  is_optional boolean not null default false,
  answer text,
  question_key text,
  options jsonb not null default '[]'::jsonb,
  allow_other boolean not null default false,
  other_label text,
  other_placeholder text,
  prefill jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  answer_text text,
  answered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

update public.intake_questions
set
  answer_text = coalesce(answer_text, answer),
  response = case
    when coalesce(answer_text, answer, '') <> '' then jsonb_build_object('text', coalesce(answer_text, answer))
    else coalesce(response, '{}'::jsonb)
  end
where answer_text is null or response = '{}'::jsonb;

create index if not exists intake_questions_draft_id_idx
on public.intake_questions(draft_id, position);

create index if not exists intake_questions_question_key_idx
on public.intake_questions(draft_id, question_key);

drop trigger if exists intake_questions_set_updated_at on public.intake_questions;
create trigger intake_questions_set_updated_at
before update on public.intake_questions
for each row execute function public.set_updated_at();

alter table public.intake_questions enable row level security;

drop policy if exists "intake_questions_owner_access" on public.intake_questions;
create policy "intake_questions_owner_access"
on public.intake_questions
for all
using (
  exists (
    select 1
    from public.intake_drafts
    where intake_drafts.id = intake_questions.draft_id
      and intake_drafts.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.intake_drafts
    where intake_drafts.id = intake_questions.draft_id
      and intake_drafts.user_id = auth.uid()
  )
);
