import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { jsonSchemaToZodSchema } from "@composio/core";
import { tool, type DynamicStructuredTool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getConfiguredChatModel } from "@/lib/agents/model";
import { getComposioToolsForToolkit } from "@/lib/tools/catalog";
import { getComposioSession } from "@/lib/tools/composio";
import { insertToolInvocation } from "@/lib/tools/repository";
import type {
  ProviderConnection,
  ResolvedProjectToolRuntime,
  ResolvedToolCandidate,
  ToolkitReadinessItem,
  ToolkitReadinessStatus,
  ToolExecutionMode,
  ToolExecutionResult,
  ToolRiskLevel,
  ToolRuntimeContext,
  ToolRuntimeEvent,
} from "@/lib/tools/types";

type SearchResponse = {
  results?: Array<{
    primaryToolSlugs?: string[];
    relatedToolSlugs?: string[];
    executionGuidance?: string;
  }>;
  toolSchemas?: Record<
    string,
    {
      toolSlug?: string;
      toolkit?: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
      outputSchema?: Record<string, unknown>;
    }
  >;
};

type ToolRouterExecuteResponse = {
  data: Record<string, unknown>;
  error: string | null;
  logId: string;
};

function summarizeText(value: string, maxLength = 240) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}...`;
}

function safeJsonSummary(value: unknown, maxLength = 400) {
  try {
    const text = JSON.stringify(value);
    if (!text) {
      return null;
    }

    return summarizeText(text, maxLength);
  } catch {
    return null;
  }
}

function inferExecutionMode(toolSlug: string): ToolExecutionMode {
  const normalized = toolSlug.toLowerCase();

  if (/(delete|remove|archive|disable|revoke|terminate)/.test(normalized)) {
    return "admin";
  }

  if (/(create|update|send|post|write|upload|invite|publish|assign|append)/.test(normalized)) {
    return "write";
  }

  return "read";
}

function inferRiskLevel(executionMode: ToolExecutionMode): ToolRiskLevel {
  if (executionMode === "admin") return "high";
  if (executionMode === "write") return "medium";
  return "low";
}

function formatToolTitle(toolSlug: string) {
  return toolSlug
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLangChainToolName(toolSlug: string) {
  return toolSlug.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 64);
}

function createFallbackSchema() {
  return z.object({
    payload: z.record(z.string(), z.unknown()).optional(),
  });
}

function toZodSchema(inputSchema: Record<string, unknown> | null) {
  if (!inputSchema) {
    return createFallbackSchema();
  }

  try {
    return jsonSchemaToZodSchema(inputSchema, {
      strict: false,
    }) as unknown as z.ZodTypeAny;
  } catch {
    return createFallbackSchema();
  }
}

async function searchToolkitTools(params: {
  connection: ProviderConnection;
  query: string;
}): Promise<ResolvedToolCandidate[]> {
  if (!params.connection.composioSessionId) {
    return [];
  }

  const session = await getComposioSession(params.connection.composioSessionId);
  const response = (await session.search({
    query: params.query,
    toolkits: [params.connection.toolkitSlug],
  })) as SearchResponse;

  const results = response.results ?? [];
  const toolSchemas = response.toolSchemas ?? {};
  const seen = new Set<string>();
  const candidates: ResolvedToolCandidate[] = [];

  for (const result of results) {
    const orderedToolSlugs = [...(result.primaryToolSlugs ?? []), ...(result.relatedToolSlugs ?? [])];
    for (const toolSlug of orderedToolSlugs) {
      if (seen.has(toolSlug)) {
        continue;
      }

      seen.add(toolSlug);
      const schemaRecord = toolSchemas[toolSlug];
      const executionMode = inferExecutionMode(toolSlug);
      candidates.push({
        id: `${params.connection.toolkitSlug}:${toolSlug}`,
        toolSlug,
        toolkitSlug: params.connection.toolkitSlug,
        sessionId: params.connection.composioSessionId,
        title: formatToolTitle(toolSlug),
        description: schemaRecord?.description ?? `Execute ${toolSlug} via ${params.connection.toolkitSlug}.`,
        inputSchema: schemaRecord?.inputSchema ?? null,
        outputSchema: schemaRecord?.outputSchema ?? null,
        executionMode,
        riskLevel: inferRiskLevel(executionMode),
        supportsChat: true,
        supportsRunTasks: true,
        executionGuidance: result.executionGuidance ?? null,
      });
    }
  }

  return candidates;
}

function buildReadinessMessage(toolkitSlug: string, status: ToolkitReadinessStatus) {
  switch (status) {
    case "ready":
      return `${toolkitSlug} is connected and ready to use.`;
    case "missing_session":
      return `${toolkitSlug} is connected but missing a Composio session for execution.`;
    case "auth_in_progress":
      return `${toolkitSlug} is waiting for authentication to complete.`;
    case "confirmation_required":
      return `${toolkitSlug} needs confirmation before write actions can continue.`;
    case "not_connected":
    default:
      return `${toolkitSlug} is selected for this project but not connected yet.`;
  }
}

function resolveToolkitReadinessStatus(
  connection: ProviderConnection | undefined,
): ToolkitReadinessStatus {
  if (!connection) {
    return "not_connected";
  }

  if (connection.status === "initiated") {
    return "auth_in_progress";
  }

  if (connection.status !== "active") {
    return "not_connected";
  }

  if (!connection.composioSessionId) {
    return "missing_session";
  }

  return "ready";
}

const toolkitDiscoverySchema = z.object({
  requiresTools: z.boolean().default(false),
  toolkitSlugs: z.array(z.string().min(1)).max(4).default([]),
  rationale: z.string().max(280).default(""),
});

const toolkitCandidateDiscoverySchema = z.object({
  toolkitSlugs: z.array(z.string().min(1)).max(6).default([]),
  rationale: z.string().max(280).default(""),
});

async function summarizeToolkitForDiscovery(toolkitSlug: string) {
  const tools = await getComposioToolsForToolkit(toolkitSlug).catch(() => []);
  const toolPreview = tools
    .slice(0, 12)
    .map((tool) => `${tool.slug}: ${tool.description}`)
    .join("\n");

  return {
    toolkitSlug,
    toolPreview,
  };
}

export async function discoverTaskToolkitNeeds(params: {
  objective: string;
  taskTitle: string;
  taskDescription?: string | null;
  candidateToolkitSlugs: string[];
}) {
  if (params.candidateToolkitSlugs.length === 0) {
    return {
      requiresTools: false,
      toolkitSlugs: [],
      rationale: "",
    };
  }

  const model = getConfiguredChatModel();
  if (!model) {
    return {
      requiresTools: false,
      toolkitSlugs: [],
      rationale: "",
    };
  }

  const toolkitSummaries = await Promise.all(
    params.candidateToolkitSlugs.map((toolkitSlug) => summarizeToolkitForDiscovery(toolkitSlug)),
  );

  const structured = model.withStructuredOutput(toolkitDiscoverySchema, {
    name: "toolkit_discovery",
    strict: true,
  });
  const result = await structured.invoke([
    new SystemMessage([
      "Decide whether the task requires external tools and, if so, which provided Composio toolkit slugs are the best fit.",
      "Only choose from the provided toolkit slugs.",
      "Return requiresTools=false when the task can be completed without external tools.",
      "Prefer the minimum set of toolkits needed for execution.",
    ].join("\n")),
    new HumanMessage([
      `Objective: ${params.objective}`,
      `Task title: ${params.taskTitle}`,
      params.taskDescription ? `Task description: ${params.taskDescription}` : "",
      "Available toolkits and example tools:",
      ...toolkitSummaries.map((summary) =>
        `Toolkit ${summary.toolkitSlug}\n${summary.toolPreview || "No tool preview available."}`,
      ),
    ].filter(Boolean).join("\n\n")),
  ]);

  return {
    requiresTools: result.requiresTools,
    toolkitSlugs: result.toolkitSlugs
      .map((value) => value.trim().toLowerCase())
      .filter((value) => params.candidateToolkitSlugs.includes(value)),
    rationale: result.rationale,
  };
}

export async function discoverRelevantToolkitCandidates(params: {
  objective: string;
  taskTitle: string;
  taskDescription?: string | null;
  toolkitCatalog: Array<{
    slug: string;
    name: string;
    description: string | null;
  }>;
}) {
  const model = getConfiguredChatModel();
  if (!model || params.toolkitCatalog.length === 0) {
    return {
      toolkitSlugs: [],
      rationale: "",
    };
  }

  const structured = model.withStructuredOutput(toolkitCandidateDiscoverySchema, {
    name: "toolkit_candidate_discovery",
    strict: true,
  });
  const result = await structured.invoke([
    new SystemMessage([
      "Select the toolkit slugs most likely needed to execute this task.",
      "Use only the provided toolkit slugs.",
      "Prefer the smallest possible set.",
      "Include toolkit slugs even if the user may not have connected them yet.",
    ].join("\n")),
    new HumanMessage([
      `Objective: ${params.objective}`,
      `Task title: ${params.taskTitle}`,
      params.taskDescription ? `Task description: ${params.taskDescription}` : "",
      "Available toolkit catalog:",
      ...params.toolkitCatalog.map((toolkit) =>
        `${toolkit.slug} (${toolkit.name})${toolkit.description ? `: ${toolkit.description}` : ""}`,
      ),
    ].filter(Boolean).join("\n\n")),
  ]);

  return {
    toolkitSlugs: result.toolkitSlugs
      .map((value) => value.trim().toLowerCase())
      .filter((value) => params.toolkitCatalog.some((toolkit) => toolkit.slug === value)),
    rationale: result.rationale,
  };
}

export function resolveToolkitReadiness(params: {
  selectedToolkitSlugs: string[];
  providerConnections: ProviderConnection[];
}) {
  const latestByToolkit = new Map<string, ProviderConnection>();

  for (const connection of params.providerConnections) {
    if (!latestByToolkit.has(connection.toolkitSlug)) {
      latestByToolkit.set(connection.toolkitSlug, connection);
    }
  }

  const readiness = params.selectedToolkitSlugs.map<ToolkitReadinessItem>((toolkitSlug) => {
    const connection = latestByToolkit.get(toolkitSlug);
    const status = resolveToolkitReadinessStatus(connection);

    return {
      toolkitSlug,
      status,
      message: buildReadinessMessage(toolkitSlug, status),
    };
  });

  return readiness;
}

export async function resolveProjectToolRuntime(
  supabase: SupabaseClient,
  params: {
    userId: string;
    projectId: string;
    query?: string | null;
  },
): Promise<ResolvedProjectToolRuntime> {
  const { resolveProjectTools } = await import("@/lib/tools/resolver");
  const { fetchProviderConnections } = await import("@/lib/tools/repository");

  const base = await resolveProjectTools(supabase, {
    projectId: params.projectId,
    userId: params.userId,
  });
  const providerConnections = await fetchProviderConnections(supabase, {
    userId: params.userId,
  });
  const readiness = resolveToolkitReadiness({
    selectedToolkitSlugs: base.selectedToolkitSlugs,
    providerConnections,
  });

  const activeConnections = providerConnections.filter(
    (connection) =>
      base.activeToolkitSlugs.includes(connection.toolkitSlug) &&
      connection.status === "active",
  );

  const missingPrerequisites = readiness
    .filter((item) => item.status !== "ready")
    .map((item) => ({
      toolkitSlug: item.toolkitSlug,
      reason: item.status as Exclude<typeof item.status, "ready">,
      message: item.message,
    }));

  if (!params.query?.trim()) {
    return {
      ...base,
      toolCandidates: [],
      missingPrerequisites,
    };
  }

  const searchableConnections = activeConnections.filter((connection) => connection.composioSessionId);
  const toolCandidates = (
    await Promise.all(
      searchableConnections.map((connection) =>
        searchToolkitTools({
          connection,
          query: params.query!.trim(),
        }).catch(() => []),
      ),
    )
  ).flat();

  return {
    ...base,
    toolCandidates,
    missingPrerequisites,
  };
}

export async function executeResolvedTool(params: {
  supabase: SupabaseClient;
  context: ToolRuntimeContext;
  candidate: ResolvedToolCandidate;
  input: Record<string, unknown>;
  onEvent?: (event: ToolRuntimeEvent) => void;
}): Promise<ToolExecutionResult> {
  const inputSummary = safeJsonSummary(params.input);

  params.onEvent?.({
    type: "tool_call_started",
    toolName: params.candidate.title,
    toolkitSlug: params.candidate.toolkitSlug,
  });

  if (
    (params.candidate.executionMode === "write" || params.candidate.executionMode === "admin") &&
    !params.context.confirmedWriteActions
  ) {
    const reason = `Confirmation is required before ${params.candidate.executionMode} actions can run.`;
    await insertToolInvocation(params.supabase, {
      userId: params.context.userId,
      projectId: params.context.projectId,
      objectiveId: params.context.objectiveId,
      threadId: params.context.threadId,
      runId: params.context.runId,
      toolkitSlug: params.candidate.toolkitSlug,
      toolSlug: params.candidate.toolSlug,
      status: "confirmation_required",
      inputSummary,
      resultSummary: reason,
      metadata: {
        executionMode: params.candidate.executionMode,
        riskLevel: params.candidate.riskLevel,
      },
    });

    params.onEvent?.({
      type: "tool_confirmation_required",
      toolName: params.candidate.title,
      toolkitSlug: params.candidate.toolkitSlug,
      reason,
    });

    return {
      status: "confirmation_required",
      toolSlug: params.candidate.toolSlug,
      toolkitSlug: params.candidate.toolkitSlug,
      message: reason,
      data: null,
      logId: null,
    };
  }

  const session = await getComposioSession(params.candidate.sessionId);

  try {
    const result = (await session.execute(
      params.candidate.toolSlug,
      params.input,
    )) as ToolRouterExecuteResponse;
    const status = result.error ? "failed" : "succeeded";
    const summary =
      result.error ?? safeJsonSummary(result.data) ?? `${params.candidate.title} completed.`;

    await insertToolInvocation(params.supabase, {
      userId: params.context.userId,
      projectId: params.context.projectId,
      objectiveId: params.context.objectiveId,
      threadId: params.context.threadId,
      runId: params.context.runId,
      toolkitSlug: params.candidate.toolkitSlug,
      toolSlug: params.candidate.toolSlug,
      status,
      inputSummary,
      resultSummary: summary,
      metadata: {
        executionMode: params.candidate.executionMode,
        riskLevel: params.candidate.riskLevel,
        logId: result.logId,
      },
    });

    if (result.error) {
      params.onEvent?.({
        type: "tool_call_failed",
        toolName: params.candidate.title,
        toolkitSlug: params.candidate.toolkitSlug,
        error: result.error,
      });

      return {
        status: "failed",
        toolSlug: params.candidate.toolSlug,
        toolkitSlug: params.candidate.toolkitSlug,
        message: result.error,
        data: result.data,
        logId: result.logId,
      };
    }

    params.onEvent?.({
      type: "tool_call_completed",
      toolName: params.candidate.title,
      toolkitSlug: params.candidate.toolkitSlug,
      summary: summary,
    });

    return {
      status: "succeeded",
      toolSlug: params.candidate.toolSlug,
      toolkitSlug: params.candidate.toolkitSlug,
      message: summary,
      data: result.data,
      logId: result.logId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool execution failed.";

    await insertToolInvocation(params.supabase, {
      userId: params.context.userId,
      projectId: params.context.projectId,
      objectiveId: params.context.objectiveId,
      threadId: params.context.threadId,
      runId: params.context.runId,
      toolkitSlug: params.candidate.toolkitSlug,
      toolSlug: params.candidate.toolSlug,
      status: "failed",
      inputSummary,
      resultSummary: message,
      metadata: {
        executionMode: params.candidate.executionMode,
        riskLevel: params.candidate.riskLevel,
      },
    });

    params.onEvent?.({
      type: "tool_call_failed",
      toolName: params.candidate.title,
      toolkitSlug: params.candidate.toolkitSlug,
      error: message,
    });

    return {
      status: "failed",
      toolSlug: params.candidate.toolSlug,
      toolkitSlug: params.candidate.toolkitSlug,
      message,
      data: null,
      logId: null,
    };
  }
}

export function createLangChainTools(params: {
  supabase: SupabaseClient;
  context: ToolRuntimeContext;
  candidates: ResolvedToolCandidate[];
  onEvent?: (event: ToolRuntimeEvent) => void;
}): DynamicStructuredTool[] {
  return params.candidates.map((candidate) =>
    tool(
      async (input) => {
        const payload =
          input && typeof input === "object" && !Array.isArray(input)
            ? (input as Record<string, unknown>)
            : {};

        const result = await executeResolvedTool({
          supabase: params.supabase,
          context: params.context,
          candidate,
          input: payload,
          onEvent: params.onEvent,
        });

        return JSON.stringify({
          status: result.status,
          message: result.message,
          data: result.data,
          toolSlug: result.toolSlug,
          toolkitSlug: result.toolkitSlug,
        });
      },
      {
        name: formatLangChainToolName(candidate.toolSlug),
        description: [
          candidate.description,
          candidate.executionGuidance ? `Guidance: ${candidate.executionGuidance}` : null,
          `Toolkit: ${candidate.toolkitSlug}.`,
          `Execution mode: ${candidate.executionMode}.`,
        ]
          .filter(Boolean)
          .join(" "),
        schema: toZodSchema(candidate.inputSchema),
      },
    ),
  );
}

export function buildMissingToolkitChecklist(runtime: ResolvedProjectToolRuntime) {
  return runtime.missingPrerequisites.map((item) => ({
    toolkitSlug: item.toolkitSlug,
    title: `Connect ${item.toolkitSlug}`,
    description: item.message,
  }));
}

function normalizeMessageContent(content: BaseMessage["content"]) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        return "text" in part && typeof part.text === "string" ? part.text : "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

export async function executeToolAssistedPrompt(params: {
  supabase: SupabaseClient;
  context: ToolRuntimeContext;
  systemPrompt: string;
  userMessage: string;
  runtime: ResolvedProjectToolRuntime;
  onEvent?: (event: ToolRuntimeEvent) => void;
}) {
  const model = getConfiguredChatModel();

  if (!model || params.runtime.toolCandidates.length === 0) {
    return {
      answer: "",
      usedTools: false,
    };
  }

  const tools = createLangChainTools({
    supabase: params.supabase,
    context: params.context,
    candidates: params.runtime.toolCandidates.slice(0, 6),
    onEvent: params.onEvent,
  });
  const boundModel = model.bindTools(tools);
  const conversation: BaseMessage[] = [
    new SystemMessage(params.systemPrompt),
    new HumanMessage(params.userMessage),
  ];
  let finalAnswer = "";
  let usedTools = false;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await boundModel.invoke(conversation);
    const responseText = normalizeMessageContent(response.content);
    const toolCalls = Array.isArray(response.tool_calls) ? response.tool_calls : [];

    if (toolCalls.length === 0) {
      finalAnswer = responseText;
      break;
    }

    usedTools = true;
    conversation.push(response as BaseMessage);

    for (const toolCall of toolCalls) {
      const matchingTool = tools.find((candidate) => candidate.name === toolCall.name);
      if (!matchingTool) {
        continue;
      }

      const toolResult = await matchingTool.invoke(toolCall.args ?? {});
      conversation.push(
        new ToolMessage({
          content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
          tool_call_id: toolCall.id ?? matchingTool.name,
        }),
      );
    }
  }

  if (!finalAnswer) {
    const fallback = await model.invoke(conversation);
    finalAnswer = normalizeMessageContent(fallback.content);
  }

  return {
    answer: finalAnswer,
    usedTools,
  };
}
