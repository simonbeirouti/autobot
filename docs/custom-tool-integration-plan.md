# Custom Tool Integration Plan

## Summary

This document turns the direction from [composio-custom-tools-prd.md](/Users/besi/Developer/ai/autobot/docs/composio-custom-tools-prd.md) into an implementation plan for AutoBot's mixed tool ecosystem:

- first-party AutoBot tools that work out of the box
- customer-defined internal tools owned by AutoBot
- optional third-party integrations via Composio

The key product rule is:

AutoBot must always have a first-party path to complete core research, analysis, and reporting tasks. Composio integrations should improve depth, speed, and handoff options, but they should not be the only way a task can proceed.

## Why This Plan Follows The Existing PRD

The earlier PRD recommends a source-agnostic runtime where Composio is one provider and internal tools are another. It specifically recommends:

- adding an internal registry layer
- merging internal tools with Composio-derived candidates at runtime
- routing execution by tool source
- preserving audit logging, approvals, and tenant scoping

This plan keeps those decisions and extends them into a productized first-party suite.

## Goals

- Ship a built-in tool suite that every team can use without paying for external SEO or research vendors.
- Keep Composio as a supported integration path for external apps and hosted toolkits.
- Allow the agent runtime to reason across first-party tools and Composio tools in the same turn.
- Ensure tool use remains auditable, governable, and safe for multi-tenant operation.
- Create a clean path for future customer-defined tools without reworking the runtime again.

## Non-Goals

- Building a no-code custom tool builder in the first phase
- Replacing Composio for third-party applications
- Supporting every possible external data source in the first release
- Shipping write-heavy workflow automation before read-heavy research tools are stable

## Product Model

AutoBot should support three tool sources:

- `internal_builtin`: first-party tools that AutoBot ships and operates
- `internal_custom`: customer-specific tools defined and owned inside AutoBot
- `composio_session`: third-party tools exposed through Composio sessions

### Tool Tiers

The product should treat tools in three tiers:

1. Baseline first-party tools
   These are enabled for all teams and require no external account connection.

2. Optional customer connectors
   These include Slack, Notion, Linear, HubSpot, calendars, and other apps connected through Composio.

3. Premium external data providers
   These include tools such as Ahrefs and Semrush. They are enhancement layers, not hard blockers.

## Target Architecture

### 1. Unified Tool Candidate Model

Today `ResolvedToolCandidate` assumes a Composio session-backed tool. We should generalize it so runtime resolution and execution can work across all sources.

Target additions to [lib/tools/types.ts](/Users/besi/Developer/ai/autobot/lib/tools/types.ts):

- `source`
- `executorKey`
- `requiresConnection`
- `sessionId?: string | null`
- `availabilityScope`
- `tags`
- `capabilities`
- `approvalPolicy`

Suggested shape:

```ts
type ToolSource = "internal_builtin" | "internal_custom" | "composio_session";

type ResolvedToolCandidate = {
  id: string;
  toolSlug: string;
  toolkitSlug: string;
  source: ToolSource;
  executorKey: string;
  sessionId?: string | null;
  requiresConnection: boolean;
  title: string;
  description: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  executionMode: "read" | "write" | "admin";
  riskLevel: "low" | "medium" | "high";
  supportsChat: boolean;
  supportsRunTasks: boolean;
  executionGuidance: string | null;
  capabilities: string[];
  tags: string[];
};
```

### 2. Internal Tool Registry

Add a code-first registry for the initial release. This should live in a new module family such as:

- [lib/tools/internal-registry.ts](/Users/besi/Developer/ai/autobot/lib/tools/internal-registry.ts)
- [lib/tools/internal-executors/](/Users/besi/Developer/ai/autobot/lib/tools/internal-executors)

Each registry entry should define:

- metadata
- schema
- capability tags
- executor key
- safety policy
- project or tenant visibility rules

The first release should be code-first because it is faster, easier to validate, and lower risk than introducing database-defined handlers immediately.

### 3. Source-Agnostic Runtime Resolution

Update [lib/tools/runtime.ts](/Users/besi/Developer/ai/autobot/lib/tools/runtime.ts) so `resolveProjectToolRuntime()` returns:

- built-in first-party candidates
- enabled internal custom candidates
- Composio session candidates for connected external tools

Resolution should work like this:

1. Load the project's selected toolkits and internal tool enablements.
2. Resolve first-party built-ins that are always available.
3. Resolve enabled internal custom tools for the project or tenant.
4. Resolve Composio tools only for connected and ready integrations.
5. Merge all candidates into one ranked list.

### 4. Source-Aware Execution

Update `executeResolvedTool()` in [lib/tools/runtime.ts](/Users/besi/Developer/ai/autobot/lib/tools/runtime.ts) to branch by `source`:

- `internal_builtin` -> execute internal handler
- `internal_custom` -> execute internal handler or HTTP-backed adapter
- `composio_session` -> use existing Composio `session.execute()` path

This preserves the existing LangChain binding path in `createLangChainTools()` and keeps tool invocation logging in [lib/tools/repository.ts](/Users/besi/Developer/ai/autobot/lib/tools/repository.ts#L275).

### 5. Shared Audit And Approval Layer

All tool sources should continue writing to `tool_invocations` in [supabase/schemas/22-tool-invocations.sql](/Users/besi/Developer/ai/autobot/supabase/schemas/22-tool-invocations.sql).

This means internal tools must emit:

- source metadata
- executor metadata
- request summary
- result summary
- latency
- any storage artifact ids
- approval events for write or admin actions

### 6. Output Persistence

Use existing storage primitives where possible:

- `project_assets` for generated reports, snapshots, exports, and datasets
- `memory_records` for durable summaries, facts, constraints, and artifacts

Relevant existing schemas:

- [supabase/schemas/14-project-assets.sql](/Users/besi/Developer/ai/autobot/supabase/schemas/14-project-assets.sql)
- [supabase/schemas/15-memory-records.sql](/Users/besi/Developer/ai/autobot/supabase/schemas/15-memory-records.sql)

## Required Platform Changes

### Runtime And Type Changes

Required changes:

- Generalize `ResolvedToolCandidate`
- Add `ToolSource` and source-aware execution
- Add internal tool resolver support
- Add internal tool ranking and discovery rules
- Extend preflight logic so first-party tools never block on connection setup
- Keep manual setup only for tools that actually require external auth or explicit operator action

### Catalog And Dashboard Changes

The tools dashboard should distinguish between:

- built-in tools
- connected integrations
- available but not connected external apps

Built-in tools should display as ready by default.

Composio integrations should continue using the existing readiness lifecycle.

### Data Model Changes

Phase 1 can stay mostly code-first, but the medium-term model should add:

- `internal_tool_definitions`
- `project_internal_tool_enablements`
- optional `tool_artifacts` or richer `project_assets` metadata
- optional crawl or indexing tables for reusable site and document data

Recommended future tables:

1. `internal_tool_definitions`
   Stores custom tool metadata, schemas, handler type, tenant scope, and approval policy.

2. `project_internal_tool_enablements`
   Controls which built-in or custom internal tools are enabled for a project.

3. `crawl_jobs`
   Tracks site crawls, status, scope, limits, and result references.

4. `search_indexes`
   Tracks document and page indexing jobs.

### Infra Requirements

The first-party suite needs shared infrastructure:

- HTTP fetcher with timeouts, retries, content-type detection, and redirect limits
- robots and sitemap parsers
- HTML extraction and normalization
- file ingestion pipeline for CSV, PDF, markdown, and text
- chunking and indexing for document retrieval
- storage writer for reports and raw artifacts
- rate limiting and per-team quota controls
- background job support for long-running crawls and indexing

## First-Party Tool Suite

The built-in suite should be split into primitive tools and composite tools.

### Primitive Tools

These are direct executors with dedicated internal handlers.

#### 1. `web_search`

Purpose:
Search the public web and return normalized search results.

Internal behavior:

- accepts query, domain filters, recency preferences, and result count
- calls an approved search provider or internal search adapter
- normalizes results into title, url, snippet, source, rank, and fetched timestamp
- caches results for repeatability

Required components:

- provider adapter interface
- result normalization layer
- domain filtering
- result cache
- quota enforcement

Blocking dependencies:

- one search data source or approved search proxy
- storage or cache for result snapshots

#### 2. `page_extractor`

Purpose:
Fetch and parse a single page into structured content.

Internal behavior:

- fetches HTML
- extracts title, meta description, canonical, headings, links, schema hints, and body text
- returns normalized markdown and structured metadata

Required components:

- HTTP fetcher
- HTML parser
- readability or content extraction logic
- URL normalization
- content hashing for dedupe

Blocking dependencies:

- fetch service
- parser and sanitizer

#### 3. `site_crawler`

Purpose:
Crawl a domain or path prefix and produce a page inventory.

Internal behavior:

- starts from root URL, sitemap, or seed list
- respects domain boundaries and crawl limits
- records discovered URLs, status codes, canonicals, headings, internal links, and page hashes
- stores raw and normalized outputs as project artifacts

Required components:

- crawl queue
- robots support
- per-domain concurrency control
- retry and backoff logic
- job persistence
- artifact export

Blocking dependencies:

- background worker execution
- crawl storage and job tracking

#### 4. `sitemap_robots_audit`

Purpose:
Inspect a site's crawl and indexability surface.

Internal behavior:

- fetches `robots.txt`
- fetches sitemap indexes and child sitemaps
- reports blocked paths, sitemap URLs, malformed entries, and coverage summaries

Required components:

- robots parser
- XML sitemap parser
- URL validation
- summary formatter

Blocking dependencies:

- HTTP fetcher
- XML parsing

#### 5. `document_search`

Purpose:
Search uploaded documents and internal project artifacts.

Internal behavior:

- ingests files from `project_assets`
- extracts text from markdown, text, CSV, and PDFs
- chunks and indexes content
- returns relevant passages with source references

Required components:

- ingestion pipeline
- text extraction pipeline
- chunking rules
- retrieval index
- result ranking

Blocking dependencies:

- asset access
- background indexing jobs

#### 6. `table_query`

Purpose:
Analyze structured datasets such as CSV exports.

Internal behavior:

- inspects schema
- supports filters, groupings, counts, and summaries
- returns structured answers with provenance

Required components:

- CSV and JSON parser
- schema inference
- safe query execution layer
- result serialization

Blocking dependencies:

- file ingestion
- query sandbox

#### 7. `artifact_store`

Purpose:
Persist generated outputs for later reuse and review.

Internal behavior:

- saves markdown, JSON, CSV, or text outputs
- creates `project_assets` records
- optionally writes summaries into `memory_records`

Required components:

- storage writer
- asset metadata conventions
- retention and naming strategy

Blocking dependencies:

- project asset persistence

#### 8. `task_handoff`

Purpose:
Deliver approved outputs into downstream systems.

Internal behavior:

- sends messages, issues, docs, or notifications to connected apps
- requires explicit approval for write actions

Required components:

- adapter layer for Slack, Notion, Linear, email, and similar systems
- approval policy
- payload formatter

Blocking dependencies:

- connected downstream integrations
- approval flow

### Composite Tools

These tools should be implemented as orchestrated internal handlers that call the primitive tools.

#### 9. `serp_snapshot`

Purpose:
Capture and summarize the current search landscape for a query.

Internal behavior:

- uses `web_search`
- fetches the top result pages with `page_extractor`
- summarizes ranking patterns across titles, headings, content types, and page intents

Required components:

- `web_search`
- `page_extractor`
- snapshot persistence

#### 10. `competitor_compare`

Purpose:
Compare multiple competitor sites or pages.

Internal behavior:

- uses `web_search`, `page_extractor`, and optional `site_crawler`
- compares messaging, topic coverage, structure, and calls to action
- writes a reusable report artifact

Required components:

- page extraction
- comparison heuristics
- report persistence

#### 11. `content_inventory`

Purpose:
Inventory and assess content on a domain.

Internal behavior:

- uses `site_crawler` and `page_extractor`
- clusters URLs by type and topic
- flags duplicates, thin pages, and gaps

Required components:

- crawl data
- classification logic
- clustering and summary output

#### 12. `report_writer`

Purpose:
Turn structured findings into polished deliverables.

Internal behavior:

- accepts structured evidence
- renders reports using predefined templates
- writes outputs through `artifact_store`

Required components:

- report templates
- markdown and export formatting
- asset persistence

## Tool-by-Tool MVP Order

The recommended build order is:

1. `page_extractor`
2. `web_search`
3. `artifact_store`
4. `site_crawler`
5. `document_search`
6. `sitemap_robots_audit`
7. `table_query`
8. `serp_snapshot`
9. `competitor_compare`
10. `content_inventory`
11. `report_writer`
12. `task_handoff`

This order gives AutoBot useful research and reporting capability quickly while deferring heavier workflow and handoff work until the read-heavy foundation is stable.

## Discovery And Ranking Strategy

The runtime should no longer depend only on Composio `session.search()` for tool discovery.

Recommended discovery flow:

1. Start from task capability needs rather than toolkit names when possible.
2. Always include matching first-party built-ins in the candidate set.
3. Add internal custom tools that match the same capabilities.
4. Add Composio tools for connected external apps.
5. Rank first-party read tools ahead of disconnected external providers.
6. Rank connected external tools higher when they provide clearly stronger execution or handoff value.

Example:

For "research competitor pages and prepare an SEO brief", the candidate set should prefer:

- `web_search`
- `page_extractor`
- `serp_snapshot`
- `competitor_compare`
- optional Composio tools only if connected and relevant

## Preflight And Readiness Rules

Preflight behavior should change from "all required toolkits block launch" to source-aware rules:

- first-party built-ins should be `ready` by default
- internal custom tools should only block if they depend on missing customer configuration
- Composio tools should continue to use connection readiness

This means [lib/tools/preflight.ts](/Users/besi/Developer/ai/autobot/lib/tools/preflight.ts) should treat first-party tools as non-blocking unless a specific tool has an unmet configuration prerequisite.

## Safety, Quotas, And Governance

Every internal tool should define:

- max runtime
- max pages or records
- allowed domains or scope rules
- read versus write classification
- whether approval is required
- whether outputs must be stored as artifacts

Examples:

- `page_extractor` is low risk and read-only
- `site_crawler` is low to medium risk and read-only, but must be rate-limited
- `task_handoff` is medium risk and requires explicit approval

## Testing Plan

### Unit Tests

- schema validation for every internal tool
- source-aware tool resolution
- source-aware execution dispatch
- approval behavior
- preflight behavior for mixed tool sources

### Integration Tests

- project chat can use built-in tools end to end
- run execution can mix built-in and Composio tools
- missing Composio connections do not block first-party-only plans
- outputs are logged to `tool_invocations`
- outputs are persisted to `project_assets` and `memory_records`

### Operational Tests

- crawl timeout handling
- provider failure handling
- duplicate artifact handling
- per-team quota enforcement
- approval and resume flows

## Implementation Phases

### Phase 1: Runtime Foundation

- Generalize the tool candidate model
- Add internal registry and executor interfaces
- Add one hard-coded first-party tool
- Route execution by source
- Validate project chat end to end

Exit criteria:

- a built-in tool can be resolved, executed, logged, and returned to the model loop

### Phase 2: First-Party Primitive Suite

- Ship `page_extractor`
- Ship `web_search`
- Ship `artifact_store`
- Ship `site_crawler`
- Ship `document_search`
- Add basic dashboard visibility for built-ins

Exit criteria:

- AutoBot can complete core research tasks without any external paid provider

### Phase 3: Composite Research Tools

- Ship `sitemap_robots_audit`
- Ship `table_query`
- Ship `serp_snapshot`
- Ship `competitor_compare`
- Ship `content_inventory`
- Ship `report_writer`

Exit criteria:

- AutoBot can produce audit and research deliverables using built-in tools alone

### Phase 4: Connector And Handoff Layer

- Ship `task_handoff`
- Add source-aware ranking between built-ins and connectors
- Add optional customer-defined internal tools
- Add project and tenant-level enablement controls

Exit criteria:

- AutoBot can combine built-in research with connected downstream delivery tools

### Phase 5: Productization

- Persist internal custom definitions
- add richer admin controls
- add per-tool quotas and analytics
- add better ranking, fallback, and capability planning

Exit criteria:

- internal tools are a durable first-class product capability

## Recommended Initial File Layout

Suggested implementation layout:

- [lib/tools/internal-registry.ts](/Users/besi/Developer/ai/autobot/lib/tools/internal-registry.ts)
- [lib/tools/internal-executors/base.ts](/Users/besi/Developer/ai/autobot/lib/tools/internal-executors/base.ts)
- [lib/tools/internal-executors/web-search.ts](/Users/besi/Developer/ai/autobot/lib/tools/internal-executors/web-search.ts)
- [lib/tools/internal-executors/page-extractor.ts](/Users/besi/Developer/ai/autobot/lib/tools/internal-executors/page-extractor.ts)
- [lib/tools/internal-executors/site-crawler.ts](/Users/besi/Developer/ai/autobot/lib/tools/internal-executors/site-crawler.ts)
- [lib/tools/internal-executors/document-search.ts](/Users/besi/Developer/ai/autobot/lib/tools/internal-executors/document-search.ts)
- [lib/tools/internal-executors/artifact-store.ts](/Users/besi/Developer/ai/autobot/lib/tools/internal-executors/artifact-store.ts)
- [lib/tools/internal-executors/composites/](/Users/besi/Developer/ai/autobot/lib/tools/internal-executors/composites)

## Immediate Recommendation

Start with the runtime foundation and the first five first-party tools:

- `page_extractor`
- `web_search`
- `artifact_store`
- `site_crawler`
- `document_search`

Those five create a useful baseline for SEO research, competitor analysis, document retrieval, and report generation without depending on paid external vendors.
