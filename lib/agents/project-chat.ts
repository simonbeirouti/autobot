import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getConfiguredChatModel } from "@/lib/agents/model";
import { AGENT_STYLES } from "@/lib/agents/orchestrator";
import { agentIds } from "@/lib/agents/schemas";
import {
  chatRoutingDecisionSchema,
  createPromotionFallback,
  createRoutingFallback,
  durableMemoryWriteSchema,
  formatMemoryContext,
  shouldPromoteMemory,
} from "@/lib/memory/policy";
import { resolveMemoryContext, writeLongTermMemory } from "@/lib/memory/repository";
import type { MemoryContext } from "@/lib/memory/types";
import type {
  Objective,
  Project,
  ProjectChatResponse,
  ProjectChatStreamEvent,
} from "@/lib/projects/types";
import { executeToolAssistedPrompt, resolveProjectToolRuntime } from "@/lib/tools/runtime";

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

function getAgentPrompt(agentId: (typeof agentIds)[number]) {
  if (agentId === "researcher") {
    return "You are the Researcher. Answer with context, evidence, assumptions, and what is still unknown.";
  }
  if (agentId === "operator") {
    return "You are the Operator. Answer with execution detail, operational status, next steps, and workflow clarity.";
  }
  if (agentId === "analyst") {
    return "You are the Analyst. Answer with metrics, tradeoffs, impact framing, and decision support.";
  }
  return "You are the Orchestrator. Resolve ambiguity, summarize what matters, and hand back the clearest answer for this project or objective.";
}

async function routeProjectChat(
  message: string,
): Promise<{
  routedAgentId: (typeof agentIds)[number];
  responseStyle: string;
}> {
  const model = getConfiguredChatModel();

  if (!message.trim()) {
    return { routedAgentId: "orchestrator" as const, responseStyle: "Clear and direct." };
  }

  if (!model) {
    const fallback = createRoutingFallback(message);
    return {
      routedAgentId: fallback.agentId,
      responseStyle: fallback.responseStyle,
    };
  }

  try {
    const result = await model.withStructuredOutput(chatRoutingDecisionSchema, {
      name: "project_chat_routing",
      strict: true,
    }).invoke([
      new SystemMessage(
        [
          "Route the project question to one agent.",
          "Use orchestrator for ambiguity, coordination, or mixed questions.",
          "Use researcher for context, background, comparisons, or what we know.",
          "Use operator for execution, workflow, tooling, ownership, and next steps.",
          "Use analyst for metrics, outcomes, tradeoffs, and performance.",
        ].join("\n"),
      ),
      new HumanMessage(message),
    ]);

    return {
      routedAgentId: result.agentId,
      responseStyle: result.responseStyle,
    };
  } catch (error) {
    console.warn("[project-chat] Route fallback", error);
    const fallback = createRoutingFallback(message);
    return {
      routedAgentId: fallback.agentId,
      responseStyle: fallback.responseStyle,
    };
  }
}

function collectCitedMemoryIds(memoryContext: MemoryContext) {
  return [
    ...memoryContext.company,
    ...memoryContext.project,
    ...memoryContext.objective,
    ...memoryContext.user,
  ]
    .map((memory) => memory.id)
    .slice(0, 8);
}

function streamText(text: string, onEvent?: (event: ProjectChatStreamEvent) => void) {
  if (!onEvent || !text) {
    return;
  }

  for (const chunk of text.split(/(\s+)/).filter(Boolean)) {
    onEvent({ type: "token", text: chunk });
  }
}

async function answerProjectChat(params: {
  supabase: SupabaseClient;
  userId: string;
  project: Project;
  objective?: Objective | null;
  threadId: string;
  message: string;
  routedAgentId: (typeof agentIds)[number];
  responseStyle: string;
  memoryContext: MemoryContext;
  onEvent?: (event: ProjectChatStreamEvent) => void;
}): Promise<ProjectChatResponse> {
  const model = getConfiguredChatModel();
  const citedMemoryIds = collectCitedMemoryIds(params.memoryContext);
  const runtime = await resolveProjectToolRuntime(params.supabase, {
    userId: params.userId,
    projectId: params.project.id,
    query: params.message,
  });
  const memoryContextMarkdown = formatMemoryContext(
    params.project,
    params.memoryContext,
    params.objective ?? null,
  );

  if (!model) {
    const answer = [
      `${AGENT_STYLES[params.routedAgentId].label} view for ${params.project.name}:`,
      params.message,
      "",
      memoryContextMarkdown || "No stored memory yet.",
      "",
      runtime.markdown,
    ].join("\n");

    streamText(answer, params.onEvent);

    return {
      threadId: params.threadId,
      routedAgentId: params.routedAgentId,
      answer,
      citedMemoryIds,
    };
  }

  const baseMessages: BaseMessage[] = [
    new SystemMessage(
      [
        getAgentPrompt(params.routedAgentId),
        "Answer only from the active project, optional objective, retrieved long-term memory, and the current chat thread.",
        "Do not pull in context from other projects.",
        `Preferred style: ${params.responseStyle}`,
        "",
        "Retrieved context:",
        memoryContextMarkdown || "No stored memory yet.",
        "",
        runtime.markdown,
        runtime.toolCandidates.length > 0
          ? "Use connected tools when they materially help answer the user."
          : "No executable tools are currently available for this request.",
        runtime.missingPrerequisites.length > 0
          ? `Missing setup: ${runtime.missingPrerequisites.map((item) => item.message).join(" ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    new HumanMessage(params.message),
  ];

  if (runtime.toolCandidates.length === 0) {
    const response = await model.invoke(baseMessages);
    const answer = normalizeMessageContent(response.content);
    streamText(answer, params.onEvent);

    return {
      threadId: params.threadId,
      routedAgentId: params.routedAgentId,
      answer,
      citedMemoryIds,
    };
  }

  const { answer: finalAnswer } = await executeToolAssistedPrompt({
    supabase: params.supabase,
    context: {
      userId: params.userId,
      projectId: params.project.id,
      objectiveId: params.objective?.id ?? null,
      threadId: params.threadId,
      runId: null,
      allowedToolkitSlugs: runtime.activeToolkitSlugs,
      confirmedWriteActions: false,
    },
    systemPrompt: normalizeMessageContent((baseMessages[0] as SystemMessage).content),
    userMessage: params.message,
    runtime,
    onEvent: (event) => params.onEvent?.(event),
  });

  streamText(finalAnswer, params.onEvent);

  return {
    threadId: params.threadId,
    routedAgentId: params.routedAgentId,
    answer: finalAnswer,
    citedMemoryIds,
  };
}

export async function appendChatTurn(
  supabase: SupabaseClient,
  params: {
    userId: string;
    companyKey: string;
    project: Project;
    objective?: Objective | null;
    threadId: string;
    message: string;
  },
) {
  return resolveMemoryContext(supabase, {
    userId: params.userId,
    companyKey: params.companyKey,
    projectId: params.project.id,
    objectiveId: params.objective?.id ?? null,
    query: params.message,
  });
}

export async function invokeProjectChat(
  supabase: SupabaseClient,
  params: {
    userId: string;
    companyKey: string;
    project: Project;
    objectiveId?: string | null;
    objective?: Objective | null;
    threadId: string;
    message: string;
  },
): Promise<ProjectChatResponse> {
  const memoryContext = await appendChatTurn(supabase, params);
  const routing = await routeProjectChat(params.message);

  return answerProjectChat({
    supabase,
    userId: params.userId,
    project: params.project,
    objective: params.objective ?? null,
    threadId: params.threadId,
    message: params.message,
    routedAgentId: routing.routedAgentId ?? "orchestrator",
    responseStyle: routing.responseStyle ?? "Clear and direct.",
    memoryContext,
  });
}

export async function* streamProjectChat(
  supabase: SupabaseClient,
  params: {
    userId: string;
    companyKey: string;
    project: Project;
    objectiveId?: string | null;
    objective?: Objective | null;
    threadId: string;
    message: string;
  },
): AsyncGenerator<ProjectChatStreamEvent, ProjectChatResponse, void> {
  const memoryContext = await appendChatTurn(supabase, params);
  const routing = await routeProjectChat(params.message);
  const routedAgentId = routing.routedAgentId ?? "orchestrator";

  yield { type: "route", routedAgentId };

  const queuedEvents: ProjectChatStreamEvent[] = [];
  const response = await answerProjectChat({
    supabase,
    userId: params.userId,
    project: params.project,
    objective: params.objective ?? null,
    threadId: params.threadId,
    message: params.message,
    routedAgentId,
    responseStyle: routing.responseStyle ?? "Clear and direct.",
    memoryContext,
    onEvent: (event) => {
      queuedEvents.push(event);
    },
  });

  for (const event of queuedEvents) {
    yield event;
  }

  return response;
}

export async function promoteDurableFactsFromTurn(
  supabase: SupabaseClient,
  params: {
    userId: string;
    companyKey: string;
    project: Project;
    objectiveId?: string | null;
    threadId: string;
    userMessage: string;
    assistantMessage: string;
    agentId: (typeof agentIds)[number];
  },
) {
  const model = getConfiguredChatModel();
  let decision = createPromotionFallback({
    userMessage: params.userMessage,
    assistantMessage: params.assistantMessage,
    agentId: params.agentId,
    objectiveId: params.objectiveId ?? null,
  });

  if (model) {
    try {
      decision = await model.withStructuredOutput(durableMemoryWriteSchema, {
        name: "durable_memory_write",
        strict: true,
      }).invoke([
        new SystemMessage(
          [
            "Decide if this exchange should become curated long-term memory.",
            "Promote only durable facts, objectives, decisions, constraints, artifacts, or stable preferences.",
            "Do not store raw transcript or temporary chat.",
          ].join("\n"),
        ),
        new HumanMessage(
          [`User: ${params.userMessage}`, `Assistant: ${params.assistantMessage}`].join("\n"),
        ),
      ]);
    } catch (error) {
      console.warn("[project-chat] Memory promotion fallback", error);
    }
  }

  if (!decision.shouldWrite || !shouldPromoteMemory(decision.kind, decision.scope)) {
    return null;
  }

  return writeLongTermMemory(supabase, {
    userId: params.userId,
    companyKey: params.companyKey,
    projectId: params.project.id,
    objectiveId: decision.scope === "objective" ? params.objectiveId ?? null : null,
    scope: decision.scope,
    kind: decision.kind,
    sourceType: "project_chat",
    sourceId: params.threadId,
    summary: decision.summary,
    content: decision.content,
    metadata: {
      agentId: params.agentId,
      projectId: params.project.id,
      objectiveId: params.objectiveId ?? null,
      threadId: params.threadId,
    },
  });
}
