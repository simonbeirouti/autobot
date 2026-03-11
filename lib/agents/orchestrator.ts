import { createDeepAgent } from "deepagents";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { getConfiguredModel } from "@/lib/agents/model";
import {
  clarificationResultSchema,
  type ClarificationResult,
  type ClarificationTaskDraft,
} from "@/lib/agents/schemas";
import type {
  EventType,
  ExecutionMode,
  RunEvent,
  RunTask,
  RunStatus,
  UsageRecord,
} from "@/lib/runs/types";

type TranscriptTurn = {
  role: "user" | "assistant";
  content: string;
};

type RunEventDraft = Omit<RunEvent, "id" | "createdAt">;
type UsageRecordDraft = Omit<UsageRecord, "id" | "startedAt" | "finishedAt"> & {
  startedAt?: string;
  finishedAt?: string | null;
};

export const AGENT_STYLES = {
  orchestrator: { label: "Orchestrator", colorToken: "amber" },
  researcher: { label: "Researcher", colorToken: "cyan" },
  operator: { label: "Operator", colorToken: "emerald" },
  analyst: { label: "Analyst", colorToken: "rose" },
} as const;

type AgentId = keyof typeof AGENT_STYLES;

const clarifierSystemPrompt = `
You are AutoBot's intake orchestrator.

Your job:
- Understand a user's business objective.
- Ask concise clarification questions only when required.
- Proceed only when the objective is actionable.
- Choose single_agent for narrow work and multi_agent for broader or specialized work.
- When ready, produce initial tasks in execution order.

Rules:
- Return operational summaries only. Never reveal hidden chain-of-thought.
- Ask at most 3 clarification questions.
- Keep questions concrete and decision-oriented.
- Only mark ready_to_execute when a useful first execution plan is possible.
- Use one of these agent ids for tasks: orchestrator, researcher, operator, analyst.
`;

const ClarificationGraphState = Annotation.Root({
  objective: Annotation<string>(),
  transcript: Annotation<TranscriptTurn[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  result: Annotation<ClarificationResult | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
});

const ExecutionGraphState = Annotation.Root({
  runId: Annotation<string>(),
  status: Annotation<RunStatus>(),
  executionMode: Annotation<ExecutionMode>(),
  finalSummary: Annotation<string | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  tasks: Annotation<RunTask[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  events: Annotation<RunEvent[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  usage: Annotation<UsageRecord[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  newEvents: Annotation<RunEventDraft[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  newUsage: Annotation<UsageRecordDraft[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  selectedTaskId: Annotation<string | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  selectedAction: Annotation<"start" | "complete" | "finish" | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
});

function normalizeAgentId(agentId?: string): AgentId {
  if (agentId && agentId in AGENT_STYLES) {
    return agentId as AgentId;
  }

  return "orchestrator";
}

function buildTranscriptPrompt(objective: string, transcript: TranscriptTurn[]) {
  const renderedTranscript = transcript
    .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
    .join("\n");

  return `Objective:\n${objective}\n\nConversation:\n${renderedTranscript || "User: " + objective}`;
}

function countStructuredAnswers(content: string) {
  return Array.from(
    content.matchAll(/Answer:\s*([\s\S]*?)(?=\n\d+\.\s|\s*$)/g),
  ).filter((match) => match[1]?.trim().length > 0).length;
}

function fallbackClarification(objective: string, transcript: TranscriptTurn[]): ClarificationResult {
  const userTurns = transcript.filter((turn) => turn.role === "user");
  const objectiveLower = objective.toLowerCase();
  const isBroadObjective =
    objective.length > 120 ||
    /(launch|pipeline|workflow|research|automate|campaign|roadmap|multi)/.test(objectiveLower);
  const latestUserTurn = userTurns.at(-1)?.content ?? "";
  const hasStructuredAnswers = countStructuredAnswers(latestUserTurn) >= 2;
  const hasEnoughAnswers =
    userTurns.length >= 3 || transcript.length >= 4 || hasStructuredAnswers;

  if (!hasEnoughAnswers) {
    return {
      status: "needs_input",
      summary: "The objective is promising, but the agent still needs a few constraints before execution.",
      confidenceToProceed: 0.42,
      executionMode: isBroadObjective ? "multi_agent" : "single_agent",
      questions: [
        "What specific outcome would make this objective a success?",
        "Who is the primary audience or customer for this work?",
        "What deadline or operating constraint should the agent respect?",
      ],
      tasks: [],
      eventNarrative: [
        "Intake review started.",
        "The objective needs clearer success criteria before execution can begin.",
      ],
    };
  }

  const executionMode: ExecutionMode = isBroadObjective ? "multi_agent" : "single_agent";
  const tasks: ClarificationTaskDraft[] =
    executionMode === "multi_agent"
      ? [
          {
            title: "Map the objective into a clear execution brief",
            description: "Capture goals, constraints, target audience, and success metrics.",
            agentId: "orchestrator",
          },
          {
            title: "Research supporting facts, context, and dependencies",
            description: "Gather the inputs needed to de-risk the objective.",
            agentId: "researcher",
          },
          {
            title: "Execute the first delivery slice",
            description: "Start tangible work against the brief and produce an initial result.",
            agentId: "operator",
          },
          {
            title: "Review output quality and close open gaps",
            description: "Assess whether the produced result satisfies the business goal.",
            agentId: "analyst",
          },
        ]
      : [
          {
            title: "Convert the objective into an execution brief",
            description: "Summarize goals, constraints, and the immediate deliverable.",
            agentId: "orchestrator",
          },
          {
            title: "Complete the first meaningful task",
            description: "Produce a concrete output toward the business objective.",
            agentId: "operator",
          },
          {
            title: "Review and finalize the response",
            description: "Confirm the output answers the clarified objective.",
            agentId: "analyst",
          },
        ];

  return {
    status: "ready_to_execute",
    summary:
      executionMode === "multi_agent"
        ? "The objective is actionable and broad enough to justify specialist delegation."
        : "The objective is actionable and compact enough for a focused single-agent run.",
    confidenceToProceed: 0.82,
    executionMode,
    questions: [],
    tasks,
    eventNarrative: [
      "Clarification is complete.",
      executionMode === "multi_agent"
        ? "The orchestrator selected a delegated execution path."
        : "The orchestrator selected a focused single-agent path.",
    ],
  };
}

async function callDeepClarifier(objective: string, transcript: TranscriptTurn[]) {
  const model = getConfiguredModel();

  if (!model) {
    return fallbackClarification(objective, transcript);
  }

  const agent = createDeepAgent({
    model,
    responseFormat:
      clarificationResultSchema as unknown as NonNullable<
        Parameters<typeof createDeepAgent>[0]
      >["responseFormat"],
    systemPrompt: clarifierSystemPrompt,
    subagents: [
      {
        name: "researcher",
        description: "Investigates context, evidence, and dependencies for business work.",
        systemPrompt: "Find the facts, assumptions, and gaps that affect execution.",
      },
      {
        name: "operator",
        description: "Turns an agreed plan into concrete execution steps.",
        systemPrompt: "Focus on practical delivery and concise operational updates.",
      },
      {
        name: "analyst",
        description: "Reviews output quality, risks, and success criteria.",
        systemPrompt: "Evaluate completeness, risks, and whether the objective is satisfied.",
      },
    ],
  });

  try {
    const result = await agent.invoke({
      messages: [
        {
          role: "user",
          content: buildTranscriptPrompt(objective, transcript),
        },
      ],
    });
    const structuredResponse = (result as { structuredResponse?: unknown }).structuredResponse;

    return clarificationResultSchema.parse(structuredResponse);
  } catch {
    return fallbackClarification(objective, transcript);
  }
}

const clarificationGraph = new StateGraph(ClarificationGraphState)
  .addNode("clarify", async (state) => {
    const result = await callDeepClarifier(state.objective, state.transcript);
    return { result };
  })
  .addEdge(START, "clarify")
  .addEdge("clarify", END)
  .compile();

function createEvent(params: {
  runId: string;
  type: EventType;
  message: string;
  agentId?: AgentId | null;
  metadata?: Record<string, unknown>;
}): Omit<RunEvent, "id" | "createdAt"> {
  const agentId = params.agentId ?? null;
  const agent = agentId ? AGENT_STYLES[agentId] : null;

  return {
    runId: params.runId,
    type: params.type,
    agentId,
    agentLabel: agent?.label ?? null,
    colorToken: agent?.colorToken ?? null,
    message: params.message,
    metadata: params.metadata ?? null,
  };
}

function createUsage(params: {
  runId: string | null;
  sessionId: string | null;
  category: "chat" | "tool" | "automation" | "agent_handoff";
  name: string;
  status?: "started" | "succeeded" | "failed" | "cancelled";
  agentId?: AgentId | null;
  inputSummary?: string | null;
  resultSummary?: string | null;
}): Omit<UsageRecord, "id" | "startedAt" | "finishedAt"> & {
  startedAt?: string;
  finishedAt?: string | null;
} {
  const now = new Date().toISOString();

  return {
    runId: params.runId,
    sessionId: params.sessionId,
    category: params.category,
    name: params.name,
    agentId: params.agentId ?? null,
    status: params.status ?? "succeeded",
    inputSummary: params.inputSummary ?? null,
    resultSummary: params.resultSummary ?? null,
    tokenCount: null,
    latencyMs: null,
    costEstimate: null,
    startedAt: now,
    finishedAt: now,
  };
}

function findLastActiveAgent(events: RunEvent[]) {
  const lastAgentEvent = [...events].reverse().find((event) => event.agentId);
  return lastAgentEvent?.agentId ? normalizeAgentId(lastAgentEvent.agentId) : null;
}

const executionGraph = new StateGraph(ExecutionGraphState)
  .addNode("select_action", async (state) => {
    const underwayTask = state.tasks.find((task) => task.status === "underway");
    if (underwayTask) {
      return { selectedAction: "complete" as const, selectedTaskId: underwayTask.id };
    }

    const waitingTask = state.tasks.find((task) => task.status === "waiting");
    if (waitingTask) {
      return { selectedAction: "start" as const, selectedTaskId: waitingTask.id };
    }

    return { selectedAction: "finish" as const, selectedTaskId: null };
  })
  .addNode("start_task", async (state) => {
    const selectedTask = state.tasks.find((task) => task.id === state.selectedTaskId);
    if (!selectedTask) {
      return {};
    }

    const agentId = normalizeAgentId(selectedTask.agentId ?? undefined);
    const previousAgentId = findLastActiveAgent(state.events);
    const updatedTasks = state.tasks.map((task) =>
      task.id === selectedTask.id
        ? { ...task, status: "underway" as const }
        : task,
    );

    const nextEvents: RunEventDraft[] = [];
    const nextUsage: UsageRecordDraft[] = [];

    if (
      state.executionMode === "multi_agent" &&
      previousAgentId &&
      previousAgentId !== agentId
    ) {
      nextEvents.push(
        createEvent({
          runId: state.runId,
          type: "handoff",
          agentId,
          message: `${AGENT_STYLES[previousAgentId].label} -> ${AGENT_STYLES[agentId].label}`,
          metadata: {
            from: previousAgentId,
            to: agentId,
          },
        }),
      );
      nextUsage.push(
        createUsage({
          runId: state.runId,
          sessionId: null,
          category: "agent_handoff",
          name: "agent_handoff",
          agentId,
          inputSummary: `${previousAgentId} -> ${agentId}`,
          resultSummary: selectedTask.title,
        }),
      );
    }

    nextEvents.push(
      createEvent({
        runId: state.runId,
        type: "task",
        agentId,
        message: `${AGENT_STYLES[agentId].label} started "${selectedTask.title}".`,
        metadata: { taskId: selectedTask.id, status: "underway" },
      }),
      createEvent({
        runId: state.runId,
        type: "tool",
        agentId,
        message: `tool.execute_task(${selectedTask.title})`,
        metadata: { taskId: selectedTask.id, tool: "execute_task" },
      }),
    );

    nextUsage.push(
      createUsage({
        runId: state.runId,
        sessionId: null,
        category: "tool",
        name: "execute_task",
        agentId,
        inputSummary: selectedTask.title,
        resultSummary: "Task moved to underway.",
      }),
    );

    return {
      status: "running" as const,
      tasks: updatedTasks,
      newEvents: [...state.newEvents, ...nextEvents],
      newUsage: [...state.newUsage, ...nextUsage],
    };
  })
  .addNode("complete_task", async (state) => {
    const selectedTask = state.tasks.find((task) => task.id === state.selectedTaskId);
    if (!selectedTask) {
      return {};
    }

    const agentId = normalizeAgentId(selectedTask.agentId ?? undefined);
    const updatedTasks = state.tasks.map((task) =>
      task.id === selectedTask.id
        ? { ...task, status: "complete" as const }
        : task,
    );
    const remainingTask = updatedTasks.some((task) => task.status !== "complete");
    const nextStatus: RunStatus = remainingTask ? "running" : "completed";
    const finalSummary = remainingTask
      ? state.finalSummary
      : "All current tasks have moved through execution and review.";

    const nextEvents: RunEventDraft[] = [
      createEvent({
        runId: state.runId,
        type: "agent",
        agentId,
        message: `${AGENT_STYLES[agentId].label} completed "${selectedTask.title}".`,
        metadata: { taskId: selectedTask.id, status: "complete" },
      }),
      ...(!remainingTask
        ? [
            createEvent({
              runId: state.runId,
              type: "system",
              agentId: "orchestrator",
              message: "Run completed. All tracked work items are in the complete column.",
              metadata: { status: "completed" },
            }),
          ]
        : []),
    ];

    const nextUsage: UsageRecordDraft[] = [
      createUsage({
        runId: state.runId,
        sessionId: null,
        category: "tool",
        name: "complete_task",
        agentId,
        inputSummary: selectedTask.title,
        resultSummary: remainingTask ? "Task completed." : "Task completed and run closed.",
      }),
    ];

    return {
      status: nextStatus,
      finalSummary,
      tasks: updatedTasks,
      newEvents: [...state.newEvents, ...nextEvents],
      newUsage: [...state.newUsage, ...nextUsage],
    };
  })
  .addNode("finish_run", async (state) => ({
    status: "completed" as const,
    finalSummary:
      state.finalSummary ?? "All current tasks have moved through execution and review.",
  }))
  .addConditionalEdges("select_action", (state) => {
    if (state.selectedAction === "start") {
      return "start_task";
    }

    if (state.selectedAction === "complete") {
      return "complete_task";
    }

    return "finish_run";
  })
  .addEdge(START, "select_action")
  .addEdge("start_task", END)
  .addEdge("complete_task", END)
  .addEdge("finish_run", END)
  .compile();

export async function clarifyObjective(params: {
  objective: string;
  transcript: TranscriptTurn[];
}) {
  const result = await clarificationGraph.invoke({
    objective: params.objective,
    transcript: params.transcript,
    result: null,
  });

  return result.result ?? fallbackClarification(params.objective, params.transcript);
}

export function buildInitialRunPayload(params: {
  runId: string;
  sessionId: string;
  objective: string;
  result: ClarificationResult;
}) {
  const tasks = params.result.tasks.map((task, index) => {
    const agentId = normalizeAgentId(task.agentId);
    return {
      runId: params.runId,
      title: task.title,
      description: task.description || null,
      status: "waiting" as const,
      position: index,
      agentId,
      agentLabel: AGENT_STYLES[agentId].label,
    };
  });

  const events = [
    createEvent({
      runId: params.runId,
      type: "system",
      agentId: "orchestrator",
      message: "Run created from clarified intake.",
      metadata: { status: "ready" },
    }),
    createEvent({
      runId: params.runId,
      type: "agent",
      agentId: "orchestrator",
      message: params.result.summary,
      metadata: {
        executionMode: params.result.executionMode,
        confidenceToProceed: params.result.confidenceToProceed,
      },
    }),
    ...params.result.eventNarrative.map((message) =>
      createEvent({
        runId: params.runId,
        type: "agent",
        agentId: "orchestrator",
        message,
      }),
    ),
  ];

  const usage = [
    createUsage({
      runId: params.runId,
      sessionId: params.sessionId,
      category: "chat",
      name: "clarification_resolution",
      agentId: "orchestrator",
      inputSummary: params.objective,
      resultSummary: params.result.summary,
    }),
  ];

  return {
    tasks,
    events,
    usage,
  };
}

export async function advanceRunExecution(params: {
  runId: string;
  status: RunStatus;
  executionMode: ExecutionMode;
  tasks: RunTask[];
  events: RunEvent[];
  usage: UsageRecord[];
  finalSummary: string | null;
}) {
  const result = await executionGraph.invoke({
    runId: params.runId,
    status: params.status,
    executionMode: params.executionMode,
    finalSummary: params.finalSummary,
    tasks: params.tasks,
    events: params.events,
    usage: params.usage,
    newEvents: [],
    newUsage: [],
    selectedTaskId: null,
    selectedAction: null,
  });

  return {
    status: result.status,
    finalSummary: result.finalSummary,
    tasks: result.tasks,
    events: result.newEvents,
    usage: result.newUsage,
  };
}
