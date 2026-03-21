do $$
begin
  if not exists (select 1 from pg_type where typname = 'internal_tool_source') then
    create type public.internal_tool_source as enum ('internal_builtin', 'internal_custom');
  end if;

  if not exists (select 1 from pg_type where typname = 'tool_approval_policy') then
    create type public.tool_approval_policy as enum ('none', 'confirm_writes');
  end if;
end $$;

create table if not exists public.internal_tool_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  toolkit_slug text not null unique,
  source public.internal_tool_source not null,
  title text not null,
  description text not null,
  execution_mode text not null,
  risk_level text not null,
  executor_key text not null,
  input_schema jsonb,
  output_schema jsonb,
  tags text[] not null default '{}'::text[],
  capabilities text[] not null default '{}'::text[],
  approval_policy public.tool_approval_policy not null default 'none',
  requires_connection boolean not null default false,
  enabled_by_default boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_internal_tool_enablements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_slug text not null references public.internal_tool_definitions(slug) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_internal_tool_enablements_project_tool_unique unique (project_id, tool_slug)
);

create index if not exists internal_tool_definitions_source_idx
on public.internal_tool_definitions(source, created_at asc);

create index if not exists project_internal_tool_enablements_project_idx
on public.project_internal_tool_enablements(project_id, created_at asc);

create index if not exists project_internal_tool_enablements_user_idx
on public.project_internal_tool_enablements(user_id, created_at asc);

drop trigger if exists internal_tool_definitions_set_updated_at on public.internal_tool_definitions;
create trigger internal_tool_definitions_set_updated_at
before update on public.internal_tool_definitions
for each row execute function public.set_updated_at();

drop trigger if exists project_internal_tool_enablements_set_updated_at on public.project_internal_tool_enablements;
create trigger project_internal_tool_enablements_set_updated_at
before update on public.project_internal_tool_enablements
for each row execute function public.set_updated_at();

alter table public.internal_tool_definitions enable row level security;
alter table public.project_internal_tool_enablements enable row level security;

drop policy if exists "internal_tool_definitions_read_access" on public.internal_tool_definitions;
create policy "internal_tool_definitions_read_access"
on public.internal_tool_definitions
for select
using (auth.uid() is not null);

drop policy if exists "project_internal_tool_enablements_owner_access" on public.project_internal_tool_enablements;
create policy "project_internal_tool_enablements_owner_access"
on public.project_internal_tool_enablements
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.internal_tool_definitions (
  slug,
  toolkit_slug,
  source,
  title,
  description,
  execution_mode,
  risk_level,
  executor_key,
  input_schema,
  tags,
  capabilities,
  approval_policy,
  requires_connection,
  enabled_by_default,
  metadata
)
values
  (
    'page_extractor',
    'page_extractor',
    'internal_builtin',
    'Page Extractor',
    'Fetch a public web page and extract normalized content, headings, metadata, and links.',
    'read',
    'low',
    'page_extractor',
    '{"type":"object","properties":{"url":{"type":"string","description":"The page URL to fetch and extract."},"extractionMode":{"type":"string","enum":["standard","metadata_only"]}},"required":["url"]}'::jsonb,
    array['web','extract','seo','content'],
    array['page_fetch','page_extract','content_analysis'],
    'none',
    false,
    true,
    '{}'::jsonb
  ),
  (
    'web_search',
    'web_search',
    'internal_builtin',
    'Web Search',
    'Search the public web through AutoBot''s configured search provider.',
    'read',
    'low',
    'web_search',
    '{"type":"object","properties":{"query":{"type":"string"},"domainFilters":{"type":"array","items":{"type":"string"}},"resultLimit":{"type":"number"}},"required":["query"]}'::jsonb,
    array['web','search','research'],
    array['web_search','serp_research'],
    'none',
    false,
    true,
    '{"envKeys":["WEB_SEARCH_PROVIDER","TAVILY_API_KEY"]}'::jsonb
  ),
  (
    'artifact_store',
    'artifact_store',
    'internal_builtin',
    'Artifact Store',
    'Persist project-scoped artifacts and summaries for later reuse.',
    'write',
    'medium',
    'artifact_store',
    '{"type":"object","properties":{"label":{"type":"string"},"assetType":{"type":"string"},"content":{"type":"string"},"metadata":{"type":"object"},"writeMemorySummary":{"type":"boolean"},"summary":{"type":"string"}},"required":["label","assetType","content"]}'::jsonb,
    array['artifact','storage','report'],
    array['artifact_write','report_persistence'],
    'confirm_writes',
    false,
    true,
    '{}'::jsonb
  ),
  (
    'site_crawler',
    'site_crawler',
    'internal_builtin',
    'Site Crawler',
    'Crawl a public site within scope and summarize discovered pages and metadata.',
    'read',
    'low',
    'site_crawler',
    '{"type":"object","properties":{"rootUrl":{"type":"string"},"pageLimit":{"type":"number"},"depthLimit":{"type":"number"},"stayWithinPath":{"type":"boolean"}},"required":["rootUrl"]}'::jsonb,
    array['crawl','web','seo','site'],
    array['site_crawl','content_inventory'],
    'none',
    false,
    true,
    '{}'::jsonb
  ),
  (
    'document_search',
    'document_search',
    'internal_builtin',
    'Document Search',
    'Search project assets and stored memory using keyword-first retrieval.',
    'read',
    'low',
    'document_search',
    '{"type":"object","properties":{"query":{"type":"string"},"resultLimit":{"type":"number"},"includeMemory":{"type":"boolean"}},"required":["query"]}'::jsonb,
    array['docs','search','assets','knowledge'],
    array['document_search','knowledge_retrieval'],
    'none',
    false,
    true,
    '{}'::jsonb
  )
on conflict (slug) do update set
  toolkit_slug = excluded.toolkit_slug,
  source = excluded.source,
  title = excluded.title,
  description = excluded.description,
  execution_mode = excluded.execution_mode,
  risk_level = excluded.risk_level,
  executor_key = excluded.executor_key,
  input_schema = excluded.input_schema,
  tags = excluded.tags,
  capabilities = excluded.capabilities,
  approval_policy = excluded.approval_policy,
  requires_connection = excluded.requires_connection,
  enabled_by_default = excluded.enabled_by_default,
  metadata = excluded.metadata;
