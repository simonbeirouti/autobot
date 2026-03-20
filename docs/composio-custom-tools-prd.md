# Composio Custom Tools PRD

## Summary

This document proposes a future enhancement that allows AutoBot to support company-defined tools alongside the existing Composio integration.

Today, AutoBot uses Composio Tool Router sessions to discover and execute tools. This works well for Composio-hosted toolkits, but it does not provide a clean path for company-specific tools that need to be defined, owned, and evolved by individual customers.

The recommended direction is to treat Composio as one tool source, not the only tool source. We should add a first-class internal custom-tool registry that can coexist with Composio sessions and expose both through the same agent runtime.

## Problem

Some companies will want agents to use tools that are not part of Composio's hosted catalog. Examples include:

- Internal APIs
- Private workflows
- Company-specific business operations
- Thin wrappers around third-party APIs with custom business logic
- Restricted tools that must follow customer-specific validation or approval rules

The current implementation is tightly coupled to Composio's hosted toolkits and session-based execution flow, which creates several gaps:

- Custom tools do not appear in the current tool catalog UI.
- Tool discovery is based on `session.search()` for connected Composio toolkits.
- Tool execution is based on `session.execute()`.
- Project tool readiness assumes a Composio connection lifecycle.

As a result, customer-defined tools are not currently a first-class concept in the product.

## Current State

Current implementation notes:

- Composio sessions are created and reused in [lib/tools/composio.ts](/Users/besi/Developer/ai/autobot/lib/tools/composio.ts#L34).
- The tool catalog reads from Composio's hosted `/toolkits` and `/tools` APIs in [lib/tools/catalog.ts](/Users/besi/Developer/ai/autobot/lib/tools/catalog.ts#L11).
- Runtime tool discovery uses `session.search()` in [lib/tools/runtime.ts](/Users/besi/Developer/ai/autobot/lib/tools/runtime.ts#L127).
- Runtime tool execution uses `session.execute()` in [lib/tools/runtime.ts](/Users/besi/Developer/ai/autobot/lib/tools/runtime.ts#L435).
- LangChain tools are created from resolved candidates in [lib/tools/runtime.ts](/Users/besi/Developer/ai/autobot/lib/tools/runtime.ts#L589).
- Project chat consumes the resolved runtime in [lib/agents/project-chat.ts](/Users/besi/Developer/ai/autobot/lib/agents/project-chat.ts#L132).

## What We Learned About Composio

Composio does support custom tools, but there is an important distinction between its direct tool APIs and its session-based Tool Router APIs.

Based on the current Composio documentation and the installed SDK:

- Composio custom tools are supported through the SDK's custom tool APIs.
- Composio's docs recommend sessions for agentic builds.
- The installed SDK stores custom tools in an in-memory registry and does not persist them automatically.
- The installed SDK combines custom tools with direct tool retrieval, but Tool Router session search and execution operate through separate session APIs.

This means custom tools are viable in principle, but they are not a drop-in fit for AutoBot's current session-first architecture.

## Goals

- Allow AutoBot to expose company-defined tools to agents.
- Keep the agent experience consistent regardless of tool source.
- Preserve the current Composio integration for hosted toolkits.
- Support future execution policies such as approvals, audit logging, and tenant-level restrictions.
- Make it possible to test this later without redesigning the runtime from scratch.

## Non-Goals

- Building the full custom tool builder UI in this phase
- Designing a marketplace or public distribution model
- Replacing Composio for third-party toolkits
- Solving every authentication pattern in the first release

## Options Considered

### Option 1: Use Composio Custom Tools Directly

Description:

- Register custom tools through the Composio SDK with `createCustomTool()`
- Resolve them through Composio's direct tool APIs
- Execute them through `composio.tools.execute()`

Pros:

- Fastest proof of concept
- Reuses Composio's tool model
- Can optionally attach to a toolkit-backed connection model

Cons:

- Not aligned with the current session-based runtime
- Custom tools are stored in memory in the current SDK and must be recreated on restart
- Not naturally available in the current catalog and search flow
- More brittle in multi-instance deployments

Decision:

- Good for a narrow spike
- Not recommended as the long-term product architecture

### Option 2: Build an Internal Custom Tool Registry

Description:

- Add a new AutoBot-owned registry for customer-defined tools
- Merge internal custom tools with Composio-derived candidates at runtime
- Keep a common tool candidate shape and a shared execution interface

Pros:

- Fits the existing agent runtime well
- Gives us durable ownership over persistence, policies, and tenancy
- Supports company-specific validation, approvals, and logging
- Avoids depending on in-memory SDK registration as the source of truth

Cons:

- Requires new storage, resolution, and execution paths
- Requires a separate onboarding and management experience
- Adds architectural surface area

Decision:

- Recommended long-term direction

### Option 3: Import Custom Apps Into Composio

Description:

- Use Composio platform features to represent customer apps and actions inside Composio itself

Pros:

- Could centralize more tooling inside Composio
- Could reduce some internal platform work if fully supported

Cons:

- Current support is not clear enough from the latest docs to treat as a reliable product assumption
- Legacy Composio docs mention an "Adding Your Own App" flow, but this needs vendor confirmation before we design around it
- May still not align with our current session-based search and execution model

Decision:

- Possible future exploration
- Not recommended as the primary implementation plan until confirmed with Composio

## Recommended Approach

Build a source-agnostic tool runtime where Composio is one provider and internal custom tools are another.

### Product Direction

AutoBot should support three conceptual tool sources:

- `composio_session`
- `composio_custom`
- `internal_custom`

In the first real implementation, we should prioritize:

- `composio_session`
- `internal_custom`

We do not need to support `composio_custom` in the first production version unless it materially simplifies testing.

### Technical Direction

Extend the current resolved tool candidate model so it can represent tool source and execution strategy, rather than assuming every tool comes from a Composio session.

Potential shape additions:

- `source`
- `executorKey`
- `config`
- `tenantScope`
- `requiresConnection`
- `approvalPolicy`

Execution should branch by source:

- `composio_session` uses the existing `session.execute()` path
- `internal_custom` uses an AutoBot-owned executor
- `composio_custom` can remain optional for later evaluation

## Proposed Architecture

### 1. Internal Registry Layer

Add a registry for custom tools, likely backed by persisted records and executable handlers.

Possible future concepts:

- custom tool definitions
- per-company tool visibility
- handler type
- schema metadata
- read/write/admin risk level
- approval requirements

### 2. Unified Runtime Resolution

Update runtime resolution so it can aggregate candidates from:

- active Composio toolkit sessions
- internal custom tools enabled for the project or company

This should happen near [resolveProjectToolRuntime()](/Users/besi/Developer/ai/autobot/lib/tools/runtime.ts#L371).

### 3. Unified Execution

Update [executeResolvedTool()](/Users/besi/Developer/ai/autobot/lib/tools/runtime.ts#L435) so execution is delegated based on tool source rather than assuming every tool is a Composio session tool.

### 4. Shared LangChain Binding

Keep [createLangChainTools()](/Users/besi/Developer/ai/autobot/lib/tools/runtime.ts#L589) as the common binding point. This is already a good abstraction boundary because it consumes a generic candidate list.

### 5. Future UI

In a later phase, the tools dashboard can evolve to show:

- hosted Composio toolkits
- internal company tools
- project-level tool enablement
- readiness and approval state per tool source

## Functional Requirements

- Agents can discover enabled internal custom tools during runtime.
- Agents can execute internal custom tools through the same orchestration loop used for existing tools.
- Tool execution continues to support audit logging.
- Write and admin actions continue to respect confirmation requirements.
- The system can limit custom tool visibility by tenant and project.

## Success Criteria

- A company can define at least one internal tool that is usable by an agent in project chat.
- The agent can reason over both Composio and internal tools in one response cycle.
- Execution telemetry and invocation records remain available for custom tools.
- The implementation does not break existing Composio session-based workflows.

## Risks

- Search and ranking may favor Composio tools unless custom tools are represented clearly in the prompt and candidate set.
- Custom tools may require additional safety controls, especially for write actions.
- Tool schema quality will directly affect agent behavior.
- If we rely on Composio custom tools for production behavior, the SDK's in-memory model may create operational issues.

## Open Questions

- Should custom tools be enabled per company, per project, or both?
- Should custom tool definitions be code-first, database-driven, or both?
- Do we want to support HTTP/OpenAPI-backed custom tools in the first implementation?
- Should internal custom tools support the same approval policy model as Composio tools by default?
- Do we want a hidden admin-only configuration path before building a full UI?

## Suggested Implementation Phases

### Phase 1: Runtime Spike

- Add source metadata to resolved tool candidates
- Add an internal custom registry
- Register one hard-coded internal tool
- Route execution by source
- Validate that project chat can use the tool end to end

### Phase 2: Persistence

- Persist custom tool definitions
- Add tenant and project scoping
- Add audit metadata and basic management controls

### Phase 3: Productization

- Add dashboard support
- Add validation and approval policy controls
- Add better ranking and discovery behavior

## Recommendation

We should implement internal custom tools as a first-class AutoBot capability and keep Composio as an integration provider rather than the sole tool system.

This gives us:

- a stable product architecture
- better support for company-owned workflows
- less coupling to Composio session constraints
- a cleaner path for future governance and approvals

## References

- [Composio custom tools](https://docs.composio.dev/docs/tools-direct/custom-tools)
- [Composio sessions vs direct execution](https://docs.composio.dev/docs/sessions-vs-direct-execution)
- [Composio how it works](https://docs.composio.dev/docs/how-composio-works)
- [Composio V1 adding your own app](https://v1.docs.composio.dev/tool-calling/adding-your-own-app)
- [Installed Composio SDK custom tool registry](/Users/besi/Developer/ai/autobot/node_modules/@composio/core/dist/index.mjs#L1648)
- [Installed Composio SDK raw tools and Tool Router meta tools](/Users/besi/Developer/ai/autobot/node_modules/@composio/core/dist/index.mjs#L2039)
- [Installed Composio SDK direct execute and custom tool creation](/Users/besi/Developer/ai/autobot/node_modules/@composio/core/dist/index.mjs#L2381)
- [Installed Composio SDK session search and execute](/Users/besi/Developer/ai/autobot/node_modules/@composio/core/dist/index.mjs#L6663)
