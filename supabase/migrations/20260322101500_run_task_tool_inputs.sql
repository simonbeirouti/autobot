alter table public.run_tasks
add column if not exists tool_input jsonb not null default '{}'::jsonb;
