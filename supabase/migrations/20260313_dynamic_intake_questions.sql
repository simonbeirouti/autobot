alter table public.intake_questions
add column if not exists question_key text,
add column if not exists options jsonb not null default '[]'::jsonb,
add column if not exists allow_other boolean not null default false,
add column if not exists other_label text,
add column if not exists other_placeholder text,
add column if not exists prefill jsonb not null default '{}'::jsonb,
add column if not exists response jsonb not null default '{}'::jsonb,
add column if not exists answer_text text;

update public.intake_questions
set
  answer_text = coalesce(answer_text, answer),
  response = case
    when coalesce(answer_text, answer, '') <> '' then jsonb_build_object('text', coalesce(answer_text, answer))
    else coalesce(response, '{}'::jsonb)
  end
where answer_text is null or response = '{}'::jsonb;

create index if not exists intake_questions_question_key_idx
on public.intake_questions(draft_id, question_key);
