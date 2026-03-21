# Tooling Integration Status And Manual Tests

## Summary

This document captures what has been completed for the mixed internal-tools and Composio integration, where the integration currently applies in the product, and how to manually verify the end-to-end behavior.

This is based on the current codebase as of March 21, 2026. The previously referenced planning docs are not present in this workspace, so this document reflects the implemented system rather than an external source-of-truth plan.

## What Has Been Completed

### Tool model and runtime

- Internal tools and Composio tools now participate in a shared source-aware runtime model.
- Supported tool sources are:
  - `internal_builtin`
  - `internal_custom`
  - `composio_session`
- Internal built-ins are connection-free and should resolve as ready when enabled.
- Internal custom tools can now be persisted, scoped, resolved, and executed through the internal runtime path.
- Runtime candidate selection prefers internal tools ahead of Composio when both are good matches.

### Internal tool execution

- The first-party built-ins are integrated into the runtime:
  - `web_search`
  - `page_extractor`
  - `site_crawler`
  - `document_search`
  - `artifact_store`
- Internal custom tools now support an HTTP-backed executor path.
- Write-gated tools continue to require confirmation before execution.
- Tool invocations are logged for success, failure, and confirmation-required outcomes.

### Project-scoped tool enablement

- Internal tools support project-level enablement and disablement.
- Resolver and preflight behavior now treat project enablement as authoritative.
- Disabled internal tools are excluded from active/selected runtime resolution.
- Enabled internal tools appear in the dashboard and runtime without requiring external connections.

### Dashboard and API integration

- The tools dashboard is split into exactly two tabs:
  - `Internal`
  - `Composio`
- Internal tool detail supports:
  - viewing metadata
  - project enable/disable
  - manual test invocation
- Internal tool API routes are available for:
  - catalog
  - detail
  - enablement update
  - invocation
- An admin-only management route exists for internal custom tool upserts.

### Preflight and readiness

- Draft and run preflight now understand internal tools as first-party tools.
- Internal-only blocker sets should not push the user toward “Connect tools” messaging.
- Optional tool support has been added:
  - tasks can declare tools as `required`
  - tasks can declare tools as `optional`
  - optional tools do not block draft execution or run progression

### Task creation and orchestration

- Intake clarification now receives project tool context before task generation.
- The planner prompt explicitly asks for concrete, objective-specific tasks instead of generic task lists.
- Tasks now carry tool intent metadata:
  - `required`
  - `optional`
  - `none`
- Run orchestration only blocks on required tools.
- If a task has optional tools and none are available, execution can fall back to analysis-only behavior instead of stopping.

### Automated validation completed

- `pnpm test` is passing.
- Current test status:
  - 5 test files passed
  - 24 tests passed

## What This Means In Product Terms

The integration is no longer just “tool execution exists somewhere in the stack.” Tooling now influences:

- task generation
- draft preflight
- run setup
- run progression
- project chat execution
- tool readiness and blocking decisions

The main product behavior change is that tools are now part of planning and orchestration, not just a late execution-time add-on.

## Remaining Gaps To Keep In Mind

These are not blockers for current QA, but they are useful to remember:

- The referenced planning docs are missing from this workspace, so this document should be treated as the active handoff note.
- The broader first-party roadmap items beyond the current built-ins are not covered here.
- Manual validation is still important for real-world prompt quality and task-shaping behavior, especially around optional vs required tool selection.

## Manual Test Setup

Before running the scenarios below:

- Ensure the app is running locally.
- Use a project where you can toggle internal tools on and off.
- Ensure at least one internal built-in is enabled:
  - `web_search`
  - `page_extractor`
  - `site_crawler`
  - `document_search`
  - `artifact_store`
- For custom-tool tests, ensure at least one `internal_custom` tool exists through the admin management path.

## Manual Test Scenarios

### 1. Internal tools appear as first-party tools in the dashboard

Goal:
- Confirm the Internal and Composio views are distinct and correctly labeled.

Steps:
1. Open the tools dashboard.
2. Click the `Internal` tab.
3. Search for `search`.
4. Open `Web Search`.
5. Return and click the `Composio` tab.

Expected outcome:
- The Internal tab shows first-party/internal copy.
- Internal tools are listed without any “connect first” requirement.
- The Composio tab remains separate and focused on external integrations.
- Internal search state does not break the Composio view.

### 2. Project-level internal tool enablement changes runtime availability

Goal:
- Confirm disabling an internal tool removes it from project-scoped runtime availability.

Steps:
1. Open the `Internal` tab in the tools dashboard.
2. Open `Web Search`.
3. Disable the tool for the active project.
4. Start a new intake flow for the same project.
5. Use the prompt below.

Prompt:
```text
Create a plan to research the top competitors for AI observability platforms and summarize public positioning, pricing clues, and product messaging.
```

Expected outcome:
- The generated tasks should not depend on `web_search` as an available required tool if it has been disabled.
- Preflight should not present `web_search` as ready/usable for that project.
- If any tool suggestions appear, they should reflect only enabled tools.

### 3. Re-enabling the tool restores internal-first planning behavior

Goal:
- Confirm that re-enabling the same tool changes planning and execution options.

Steps:
1. Re-enable `Web Search` for the same project.
2. Start a fresh intake or draft flow.
3. Use the same prompt again.

Prompt:
```text
Create a plan to research the top competitors for AI observability platforms and summarize public positioning, pricing clues, and product messaging.
```

Expected outcome:
- Generated tasks should be concrete and research-oriented rather than generic placeholders.
- At least some tasks should reflect web-research intent.
- Preflight/runtime should treat the internal search tool as available without asking for a third-party connection.

### 4. Task generation is concrete instead of generic

Goal:
- Confirm the planner produces objective-specific tasks and not vague boilerplate.

Steps:
1. Start a new project intake or objective draft.
2. Use the prompt below.

Prompt:
```text
Help me prepare a content gap analysis for our website. I want to compare our key solution pages against competitors, identify missing topics, and propose a prioritized update plan.
```

Expected outcome:
- Tasks should be specific to content-gap analysis.
- Good examples:
  - reviewing current solution pages
  - identifying competitor pages
  - comparing topic coverage
  - drafting update recommendations
- Poor examples that should not dominate:
  - “Do research”
  - “Analyze data”
  - “Create final output”

### 5. Optional tools do not block progression

Goal:
- Confirm optional tool suggestions do not create hard blockers.

Steps:
1. Disable one useful but non-essential internal tool, such as `page_extractor` or `site_crawler`.
2. Start a new draft.
3. Use the prompt below.

Prompt:
```text
Review our homepage messaging and produce a recommendation memo for improving clarity, positioning, and calls to action. Use public website information if available, but proceed even if some website tooling is unavailable.
```

Expected outcome:
- The planner may suggest helpful tools, but the draft should still be able to proceed.
- Preflight should not hard-block on optional tools.
- The task/run should still be executable through analysis-only behavior if required tools are available.

### 6. Required tools still create correct blockers

Goal:
- Confirm that truly required tooling still blocks when unavailable.

Steps:
1. Disable `document_search` or another project-required internal tool used for project-scoped retrieval.
2. Start a draft with the prompt below.

Prompt:
```text
Search the project documents and produce a summary of the latest brief, requirements, and any risks called out in uploaded files.
```

Expected outcome:
- The draft or run should indicate that the required capability is unavailable.
- Blocking guidance should be specific to the missing tool/capability.
- The product should not mislabel this as a generic Composio connection problem if the missing tool is internal.

### 7. Internal tool manual invocation works from the dashboard

Goal:
- Confirm internal tools can be tested directly from the detail sheet.

Steps:
1. Open the tools dashboard.
2. Open `Web Search`.
3. Click `Reset` to load sample input.
4. Click `Run test`.

Expected outcome:
- The tool executes successfully.
- The execution output panel shows a structured JSON result.
- The result should include a successful status and tool-specific output.

Suggested input:
```json
{
  "query": "best llm observability platforms",
  "domainFilters": [],
  "resultLimit": 5
}
```

Expected outcome details:
- The result status should be `succeeded` when search provider configuration exists.
- If the search provider is not configured, the failure should be clear and explicit, not silent.

### 8. Write-gated internal tools require confirmation

Goal:
- Confirm write confirmation is enforced for write-capable internal tools.

Steps:
1. Open `Artifact Store` from the Internal tab.
2. Click `Reset`.
3. Leave `Allow write execution` turned off.
4. Click `Run test`.

Suggested input:
```json
{
  "label": "Internal tool smoke test",
  "assetType": "test_note",
  "content": "This is a stored artifact created from the internal tools dashboard.",
  "metadata": {
    "source": "tools-dashboard"
  },
  "writeMemorySummary": false,
  "summary": ""
}
```

Expected outcome:
- The tool should return a `confirmation_required` style result.
- It should not silently write data.

Follow-up:
1. Turn on `Allow write execution`.
2. Run the same test again.

Expected outcome:
- The tool should now succeed.
- A stored artifact/result identifier should be returned if applicable.

### 9. Project chat uses internal tools during answer generation

Goal:
- Confirm project chat can call internal tools as part of a response.

Steps:
1. Open project chat for a project with `web_search` enabled.
2. Send the prompt below.

Prompt:
```text
Research recent public positioning for the leading AI observability vendors and summarize the most common themes you see across their websites.
```

Expected outcome:
- The assistant should behave like it has access to first-party search capability.
- The response should reflect tool-assisted research behavior rather than only generic brainstorming.
- If the app exposes tool execution details in the chat UI, the internal tool call should be visible there.

### 10. Draft preflight respects internal-only readiness

Goal:
- Confirm internal readiness does not collapse into “connect external tools” language.

Steps:
1. Create a draft that depends on enabled internal tools.
2. Use the prompt below.

Prompt:
```text
Extract the key claims from the target webpage, compare them against our messaging, and prepare a rewrite brief.
```

Expected outcome:
- Preflight should recognize internal tools as first-party available tools.
- If all required internal tools are enabled, there should be no external connection prompt.
- If a required internal tool is disabled, the blocker should describe that internal capability gap accurately.

### 11. Run execution only blocks on required tools

Goal:
- Confirm run progression matches the new required/optional tool semantics.

Steps:
1. Create a run from a draft that includes a mix of required and optional tool usage.
2. Disable one optional tool.
3. Execute the run.

Prompt:
```text
Build a competitor messaging brief for our product category. Use web research where helpful, but still complete the brief even if some enrichment tools are unavailable.
```

Expected outcome:
- The run should proceed if required tools are available.
- Missing optional tools should not create a hard stop.
- Tasks may degrade gracefully to analysis-only behavior where appropriate.

### 12. Internal custom tools resolve and execute when in scope

Goal:
- Confirm `internal_custom` tools are available only within their configured scope.

Steps:
1. Create or identify a company-scoped internal custom tool.
2. Ensure it is enabled for the active project if project enablement applies.
3. Open the Internal tab and verify the tool is visible.
4. Invoke it from the detail sheet or use a workflow that should match it.

Suggested prompt:
```text
Use the internal company tool for product taxonomy lookup and apply it to classify our current objective.
```

Expected outcome:
- The custom tool appears in the Internal tab, not the Composio tab.
- It resolves only where its company/project scope allows.
- Execution follows the internal runtime path and returns a structured result.

## Suggested QA Recording Template

Use this for each scenario:

- Scenario:
- Project:
- Tool state:
- Prompt used:
- Actual result:
- Expected result met:
- Notes/screenshots:

## Recommended Pass Criteria For This Round

This round should be considered complete if:

- Internal tools appear and behave as first-party tools across dashboard, preflight, chat, drafts, and runs.
- Task generation is concrete and objective-specific in the tested flows.
- Optional tools do not create blockers.
- Required tools do create accurate blockers.
- Internal custom tools resolve only within scope.
- Manual dashboard invocation works for read and write-gated internal tools.
- No tested internal-only scenario incorrectly tells the user to connect a Composio integration.
