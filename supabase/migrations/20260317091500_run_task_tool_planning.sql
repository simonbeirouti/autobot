alter table public.run_tasks
  add column if not exists required_toolkit_slugs text[] not null default '{}'::text[],
  add column if not exists required_tool_ids text[] not null default '{}'::text[],
  add column if not exists execution_strategy text not null default 'analysis_only',
  add column if not exists tool_summary text;
