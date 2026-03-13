# Tool Integration PRD

## Title
Provider-Agnostic Tool Integration Platform for AutoBot

## Summary
AutoBot needs a reusable tool integration layer that allows agent workflows to call internal capabilities and external software/services in a controlled, provider-agnostic way. The system must work with LangGraph-based orchestration now, remain compatible with future Deep Agents usage, and support both directly coded tools and store-backed integrations configured per organization.

## Goals
- Make tools first-class across planning and execution workflows after intake clarification.
- Keep the core tool system provider-agnostic.
- Support external service integrations such as CRM, messaging, ticketing, analytics, and internal APIs.
- Enable dynamic tool availability based on org, user, workflow, and permissions.
- Reuse the same tool platform later in Deep Agents-based dev/software workflows.

## Non-Goals
- Full marketplace/UI for self-serve tool installation in v1.
- End-user credential management UX in v1.
- Complex workflow composition inside the tool layer itself.
- Replacing LangGraph orchestration with a tool framework.

## Problem
Today, tool access is tightly coupled to whichever agent framework is used in a specific step. This creates provider compatibility issues, makes external integrations harder to manage, and prevents a consistent capability model across intake, planning, and execution flows.

We need one internal tool platform that:
- defines tools once
- exposes them safely to agent workflows
- resolves org-specific integrations from a store/config layer
- can be projected into different provider runtimes without changing core business logic

## Users
- Internal AutoBot platform developers
- Internal operators configuring integrations for organizations
- Future non-dev company users running business workflows
- Future software/dev agents using the same tool layer through Deep Agents

## Core Requirements

### 1. Internal Tool Registry
Each tool must have:
- `id`
- `title`
- `description`
- `inputSchema`
- `outputSchema` or normalized output shape
- `capabilityTags`
- `riskLevel`
- `requiredScopes`
- `executionMode` (`read`, `write`, `admin`)
- `handler(context, input)`

Examples:
- `hubspot_search_contacts`
- `linear_create_issue`
- `slack_send_message`
- `notion_search_pages`
- `postgres_query_readonly`

### 2. Runtime Tool Context
Every tool invocation must receive runtime context:
- `userId`
- `orgId`
- `workflowId` or `runId`
- `allowedToolIds`
- `connectionIds`
- `store` access
- audit metadata
- optional human-approval hooks

### 3. Store-Backed Integration Layer
The system must support a store-backed configuration layer for:
- installed integrations
- connection metadata
- API credentials or references to secrets
- org-specific entitlements
- tool allowlists/denylists
- cached metadata such as object schemas, field mappings, or project mappings

This store layer determines which tools are available and how they are configured for a given runtime.

### 4. Tool Availability Resolution
Before a planning or execution step runs, the platform must resolve:
- which tools exist globally
- which tools are enabled for this org
- which tools this workflow is allowed to use
- which tools this user is allowed to invoke

Tool availability must be dynamic and not hardcoded into a single agent runtime.

### 5. Provider Adapter Layer
The internal tool registry must remain provider-neutral.
Provider-specific model/tool definitions must be generated only at the edge.

This allows:
- OpenAI-compatible tool projection
- Anthropic-compatible tool projection
- future provider support without rewriting business tools

### 6. LangGraph Integration
LangGraph remains the orchestration layer.
Nodes should be able to:
- request a resolved toolset
- invoke tools directly through the internal runtime
- optionally expose selected tools to model-driven nodes when appropriate

The intake clarifier should remain mostly tool-free.
Planning and execution nodes should have controlled tool access.

### 7. Deep Agents Compatibility
The same internal tool registry should be reusable later by Deep Agents.
Deep Agents should consume wrapped versions of the same tools rather than introducing a separate business-tool ecosystem.

## Functional Requirements

### V1
- Register internal tools in code.
- Resolve tool availability by org/user/workflow.
- Support direct tool execution in LangGraph nodes.
- Support at least one store-backed external integration pattern.
- Add audit logging for every tool call.
- Support read and write tools.
- Support provider projection for OpenAI and Anthropic.
- Provide a small initial starter set of tools.

### Suggested V1 Starter Tools
- `web_search_readonly`
- `slack_send_message`
- `linear_create_issue`
- `hubspot_search_contact`
- `notion_search_pages`
- `org_profile_lookup`

## Non-Functional Requirements
- Strong typing for tool input/output.
- Deterministic server-side enforcement of access control.
- Auditable tool invocation trail.
- Clear separation between model-visible tool schema and internal execution logic.
- Safe fallback behavior when integrations are unavailable.
- Low-friction path for adding new tools.

## Data Model
Suggested core entities:
- `tool_definitions`
- `tool_capabilities`
- `integrations`
- `integration_connections`
- `tool_policies`
- `tool_invocations`

Minimum fields:
- tool id, provider type, capability tags, scopes, risk level
- org id, connection id, integration status
- allowed workflows/users/roles
- invocation input summary, result summary, status, timestamps

## Execution Flow
1. Workflow starts in LangGraph.
2. Runtime resolves org/user/workflow context.
3. Tool resolver loads available tools from registry + store-backed policy/config.
4. Node either:
   - invokes tools directly, or
   - passes selected tools into a provider-backed model step
5. Tool execution occurs through the internal runtime.
6. Invocation is logged with audit metadata.
7. Result is normalized and returned to the node.

## Failure Modes
- Missing integration config
- Expired or invalid credentials
- Provider rejects projected tool schema
- Tool timeout
- Upstream API rate limit
- Unauthorized tool usage attempt

V1 behavior:
- fail the tool call clearly
- log structured error metadata
- allow workflow node to recover, retry, or branch

## Security and Permissions
- No tool should execute solely because a model asks for it.
- Server-side policy enforcement is mandatory.
- Write/admin tools must support future approval hooks.
- Credentials should be resolved from secure storage, not hardcoded in tool definitions.

## Acceptance Criteria
- A LangGraph planning or execution node can resolve and use a dynamic toolset for a specific org.
- At least one external SaaS integration can be called through the unified tool runtime.
- The same internal tool can be projected to more than one provider format.
- Tool calls are audited and permission-checked.
- Intake clarification remains decoupled from tool middleware failures.

## Open Design Direction
Recommended architecture:
- LangGraph for orchestration
- provider-agnostic tool registry in the application layer
- provider adapters for model-facing schemas
- store-backed integration resolver for org-specific tool availability
- Deep Agents reuse later via wrappers around the same internal registry

## Immediate Follow-On Work
1. Define the internal `ToolDefinition` and `ToolRuntimeContext` types.
2. Design the store schema for integrations and tool policies.
3. Build the resolver that returns available tools for a runtime.
4. Implement one provider adapter for OpenAI and one for Anthropic.
5. Add 2-3 initial tools and one external integration end to end.
