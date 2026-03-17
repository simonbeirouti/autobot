alter table public.runs
  add column if not exists action_required jsonb;

alter table public.run_tasks
  add column if not exists action_required jsonb;
