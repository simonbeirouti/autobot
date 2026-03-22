alter table public.run_tasks
  add column if not exists tool_requirement text not null default 'none',
  add column if not exists optional_toolkit_slugs text[] not null default '{}'::text[];
