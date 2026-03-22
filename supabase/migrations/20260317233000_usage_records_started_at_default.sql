alter table public.usage_records
alter column started_at set default timezone('utc', now());
