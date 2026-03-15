import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  Annotation,
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
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

const ProjectChatState = Annotation.Root({
  ...MessagesAnnotation.spec,
  projectName: Annotation<string>({ reducer: (_c, u) => u, default: () => "" }),
  projectDescription: Annotation<string>({ reducer: (_c, u) => u, default: () => "" }),
  objectiveTitle: Annotation<string | null>({ reducer: (_c, u) => u, default: () => null }),
  objectiveDescription: Annotation<string | null>({ reducer: (_c, u) => u, default: () => null }),
  memoryContextMarkdown: Annotation<string>({ reducer: (_c, u) => u, default: () => "" }),
  citedMemoryIds: Annotation<string[]>({ reducer: (_c, u) => u, default: () => [] }),
  routedAgentId: Annotation<(typeof agentIds)[number] | null>({
    reducer: (_c, u) => u,
    default: () => null,
  }),
  responseStyle: Annotation<string>({ reducer: (_c, u) => u, default: () => "Clear and direct." }),
});

let projectChatCheckpointerPromise: Promise<BaseCheckpointSaver<number>> | null = null;
let compiledProjectChatGraphPromise: Promise<ReturnType<typeof createProjectChatGraph>> | null = null;

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

function getLatestUserMessage(messages: BaseMessage[]) {
  const latestHuman = [...messages].reverse().find((message) => message._getType() === "human");
  return latestHuman ? normalizeMessageContent(latestHuman.content) : "";
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

async function getProjectChatCheckpointer() {
  if (!projectChatCheckpointerPromise) {
    projectChatCheckpointerPromise = (async () => {
      const connectionString =
        process.env.LANGGRAPH_CHECKPOINT_DATABASE_URL ??
        process.env.DATABASE_URL ??
        process.env.POSTGRES_URL ??
        null;

      if (!connectionString) {
        return new MemorySaver();
      }

      try {
        const checkpointPackage = await import("@langchain/langgraph-checkpoint-postgres");
        const saver = checkpointPackage.PostgresSaver.fromConnString(connectionString);
        await saver.setup();
        return saver;
      } catch (error) {
        console.warn("[project-chat] Falling back to MemorySaver", error);
        return new MemorySaver();
      }
    })();
  }

  return projectChatCheckpointerPromise;
}

function createProjectChatGraph(checkpointer: Awaited<ReturnType<typeof getProjectChatCheckpointer>>) {
  const routeNode = async (state: typeof ProjectChatState.State) => {
    const latestUserMessage = getLatestUserMessage(state.messages);
    const model = getConfiguredChatModel();

    if (!latestUserMessage) {
      return { routedAgentId: "orchestrator" as const, responseStyle: "Clear and direct." };
    }

    if (!model) {
      return createRoutingFallback(latestUserMessage);
    }

    try {
      return await model.withStructuredOutput(chatRoutingDecisionSchema, {
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
        new HumanMessage(latestUserMessage),
      ]);
    } catch (error) {
      console.warn("[project-chat] Route fallback", error);
      return createRoutingFallback(latestUserMessage);
    }
  };

  const answerNode = async (state: typeof ProjectChatState.State) => {
    const latestUserMessage = getLatestUserMessage(state.messages);
    const model = getConfiguredChatModel();
    const agentId = state.routedAgentId ?? "orchestrator";
    const citedMemoryIds = state.citedMemoryIds ?? [];

    if (!latestUserMessage) {
      return { messages: [new AIMessage("I’m missing the question for this thread.")], citedMemoryIds };
    }

    if (!model) {
      return {
        messages: [
          new AIMessage(
            [
              `${AGENT_STYLES[agentId].label} view for ${state.projectName}:`,
              latestUserMessage,
              "",
              state.memoryContextMarkdown || "No stored memory yet.",
            ].join("\n"),
          ),
        ],
        citedMemoryIds,
      };
    }

    const response = await model.invoke([
      new SystemMessage(
        [
          getAgentPrompt(agentId),
          "Answer only from the active project, optional objective, retrieved long-term memory, and the current chat thread.",
          "Do not pull in context from other projects.",
          `Preferred style: ${state.responseStyle}`,
          "",
          "Retrieved context:",
          state.memoryContextMarkdown || "No stored memory yet.",
        ].join("\n"),
      ),
      ...state.messages,
    ]);

    return {
      messages: [new AIMessage(normalizeMessageContent(response.content))],
      citedMemoryIds,
    };
  };

  return new StateGraph(ProjectChatState)
    .addNode("route", routeNode)
    .addNode("answer", answerNode)
    .addEdge(START, "route")
    .addEdge("route", "answer")
    .addEdge("answer", END)
    .compile({ checkpointer });
}

async function getCompiledProjectChatGraph() {
  if (!compiledProjectChatGraphPromise) {
    compiledProjectChatGraphPromise = getProjectChatCheckpointer().then((checkpointer) =>
      createProjectChatGraph(checkpointer),
    );
  }
  return compiledProjectChatGraphPromise;
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
  const [graph, memoryContext] = await Promise.all([
    getCompiledProjectChatGraph(),
    appendChatTurn(supabase, {
      userId: params.userId,
      companyKey: params.companyKey,
      project: params.project,
      objective: params.objective ?? null,
      threadId: params.threadId,
      message: params.message,
    }),
  ]);

  const citedMemoryIds = collectCitedMemoryIds(memoryContext);
  const result = await graph.invoke(
    {
      messages: [new HumanMessage(params.message)],
      projectName: params.project.name,
      projectDescription: params.project.description,
      objectiveTitle: params.objective?.title ?? null,
      objectiveDescription: params.objective?.description ?? null,
      memoryContextMarkdown: formatMemoryContext(params.project, memoryContext, params.objective ?? null),
      citedMemoryIds,
    },
    { configurable: { thread_id: params.threadId } },
  );

  return {
    threadId: params.threadId,
    routedAgentId: result.routedAgentId ?? "orchestrator",
    answer: normalizeMessageContent(result.messages.at(-1)?.content ?? ""),
    citedMemoryIds: result.citedMemoryIds ?? citedMemoryIds,
  };
}

function getNodeUpdate(
  chunk: unknown,
  nodeName: string,
): Record<string, unknown> | null {
  if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) {
    return null;
  }

  const nodeUpdate = (chunk as Record<string, unknown>)[nodeName];
  if (!nodeUpdate || typeof nodeUpdate !== "object" || Array.isArray(nodeUpdate)) {
    return null;
  }

  return nodeUpdate as Record<string, unknown>;
}

function getMetadataNodeName(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).langgraph_node;
  return typeof value === "string" ? value : null;
}

function getChunkText(chunk: unknown) {
  if (!chunk || typeof chunk !== "object") {
    return "";
  }

  const content = (chunk as { content?: BaseMessage["content"] }).content;
  return normalizeMessageContent(content ?? "");
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
  const [graph, memoryContext] = await Promise.all([
    getCompiledProjectChatGraph(),
    appendChatTurn(supabase, {
      userId: params.userId,
      companyKey: params.companyKey,
      project: params.project,
      objective: params.objective ?? null,
      threadId: params.threadId,
      message: params.message,
    }),
  ]);

  const citedMemoryIds = collectCitedMemoryIds(memoryContext);
  let routedAgentId = "orchestrator";
  let answer = "";

  const stream = await graph.stream(
    {
      messages: [new HumanMessage(params.message)],
      projectName: params.project.name,
      projectDescription: params.project.description,
      objectiveTitle: params.objective?.title ?? null,
      objectiveDescription: params.objective?.description ?? null,
      memoryContextMarkdown: formatMemoryContext(params.project, memoryContext, params.objective ?? null),
      citedMemoryIds,
    },
    {
      configurable: { thread_id: params.threadId },
      streamMode: ["updates", "messages"],
    },
  );

  for await (const [mode, chunk] of stream) {
    if (mode === "updates") {
      const routeUpdate = getNodeUpdate(chunk, "route");
      const nextAgentId = routeUpdate?.routedAgentId;
      if (typeof nextAgentId === "string" && nextAgentId.length > 0 && nextAgentId !== routedAgentId) {
        routedAgentId = nextAgentId;
        yield { type: "route", routedAgentId };
      }

      const answerUpdate = getNodeUpdate(chunk, "answer");
      const nextCitedMemoryIds = answerUpdate?.citedMemoryIds;
      if (Array.isArray(nextCitedMemoryIds)) {
        citedMemoryIds.splice(0, citedMemoryIds.length, ...nextCitedMemoryIds.filter((id): id is string => typeof id === "string"));
      }

      const nextMessages = answerUpdate?.messages;
      if (!answer && Array.isArray(nextMessages) && nextMessages.length > 0) {
        const finalMessage = nextMessages.at(-1);
        const finalText = getChunkText(finalMessage);
        if (finalText) {
          answer = finalText;
        }
      }

      continue;
    }

    if (mode !== "messages" || !Array.isArray(chunk)) {
      continue;
    }

    const [messageChunk, metadata] = chunk;
    if (getMetadataNodeName(metadata) !== "answer") {
      continue;
    }

    const token = getChunkText(messageChunk);
    if (!token) {
      continue;
    }

    answer += token;
    yield { type: "token", text: token };
  }

  return {
    threadId: params.threadId,
    routedAgentId,
    answer,
    citedMemoryIds,
  };
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
