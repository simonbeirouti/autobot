import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { getConfiguredClarifier } from "@/lib/agents/model";
import {
  clarificationResultSchema,
  type ClarificationQuestionDraft,
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
- Ask only for information that is still missing.
- Prefer structured options over open-ended text when a small set of likely answers exists.
- Keep questions concrete and decision-oriented.
- Use stable question ids that can survive follow-up rounds when the question meaning is unchanged.
- Limit each response to at most 8 clarification questions.
- Only mark ready_to_execute when a useful first execution plan is possible.
- Use one of these agent ids for tasks: orchestrator, researcher, operator, analyst.
`;

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
  activeToolkitSlugs: Annotation<string[]>({
    reducer: (_current, update) => update,
    default: () => [],
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

function slugifyQuestionId(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "question"
  );
}

function createSelectQuestion(params: {
  id: string;
  prompt: string;
  helpText: string;
  options: Array<{
    id: string;
    label: string;
    description?: string;
    isRecommended?: boolean;
  }>;
  allowOther?: boolean;
  optional?: boolean;
  recommendedOptionIds?: string[];
  otherLabel?: string;
  otherPlaceholder?: string;
}): ClarificationQuestionDraft {
  return {
    id: slugifyQuestionId(params.id),
    prompt: params.prompt,
    helpText: params.helpText,
    inputKind: "single_select",
    options: params.options.map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description ?? "",
      isRecommended: option.isRecommended ?? false,
    })),
    allowOther: params.allowOther ?? false,
    optional: params.optional ?? false,
    otherLabel: params.otherLabel ?? "Other",
    otherPlaceholder: params.otherPlaceholder ?? "Add a different answer",
    prefill: {
      selectedOptionIds: params.recommendedOptionIds ?? [],
      otherText: "",
      text: "",
    },
  };
}

function createTextQuestion(params: {
  id: string;
  prompt: string;
  helpText: string;
  optional?: boolean;
  placeholder?: string;
}): ClarificationQuestionDraft {
  return {
    id: slugifyQuestionId(params.id),
    prompt: params.prompt,
    helpText: params.helpText,
    inputKind: "text",
    options: [],
    allowOther: false,
    optional: params.optional ?? false,
    otherLabel: "Other",
    otherPlaceholder: params.placeholder ?? "Add the missing context",
    prefill: {
      selectedOptionIds: [],
      otherText: "",
      text: "",
    },
  };
}

function buildDraftMarkdown(params: {
  objective: string;
  summary: string;
  executionMode: ExecutionMode;
  tasks: ClarificationTaskDraft[];
  eventNarrative: string[];
}) {
  const taskLines = params.tasks
    .map((task, index) => {
      const agentId = normalizeAgentId(task.agentId);
      return `${index + 1}. **${task.title}** (${AGENT_STYLES[agentId].label})${task.description ? `\n   - ${task.description}` : ""}`;
    })
    .join("\n");

  const narrativeLines = params.eventNarrative.map((item) => `- ${item}`).join("\n");

  return [
    "# Plan of action",
    "",
    "## Objective",
    params.objective,
    "",
    "## Intake summary",
    params.summary,
    "",
    "## Execution mode",
    params.executionMode === "multi_agent" ? "Multi-agent" : "Single-agent",
    "",
    "## Initial tasks",
    taskLines || "- No tasks generated yet.",
    "",
    "## Notes",
    narrativeLines || "- No additional notes.",
  ].join("\n");
}

function normalizeToolkitSlug(value: string) {
  return value.trim().toLowerCase();
}

function planTaskTools(params: {
  objective: string;
  task: ClarificationTaskDraft;
  availableToolkitSlugs?: string[];
  selectedToolkitSlugs?: string[];
}): Pick<
  ClarificationTaskDraft,
  "requiredToolkitSlugs" | "requiredToolIds" | "executionStrategy" | "toolSummary"
> {
  const availableToolkitSlugs = (params.availableToolkitSlugs ?? []).map(normalizeToolkitSlug);
  const selectedToolkitSlugs = (params.selectedToolkitSlugs ?? []).map(normalizeToolkitSlug);
  const knownToolkitSlugs = Array.from(new Set([...availableToolkitSlugs, ...selectedToolkitSlugs]));
  const haystack = `${params.objective}\n${params.task.title}\n${params.task.description ?? ""}`.toLowerCase();
  const matchedToolkits = knownToolkitSlugs.filter((toolkitSlug) => haystack.includes(toolkitSlug));
  const fallbackToolkit =
    matchedToolkits.length > 0
      ? matchedToolkits
      : params.task.agentId === "operator" && availableToolkitSlugs.length > 0
        ? availableToolkitSlugs.slice(0, 2)
        : [];

  const taskText = `${params.task.title} ${params.task.description ?? ""}`.toLowerCase();
  const likelyToolTask =
    params.task.agentId === "operator" &&
    /(execute|send|sync|update|connect|publish|create|deliver|post|upload|integrat)/.test(taskText);
  const setupTask = /(connect|auth|authorize|api key|credential|login|setup|configure)/.test(taskText);

  const executionStrategy =
    setupTask
      ? ("manual_setup" as const)
      : likelyToolTask && (availableToolkitSlugs.length > 0 || selectedToolkitSlugs.length > 0)
        ? ("tool_execution" as const)
        : ("analysis_only" as const);

  const toolSummary =
    executionStrategy === "manual_setup"
      ? fallbackToolkit.length > 0
        ? `This task depends on connecting ${fallbackToolkit.join(", ")} before execution can continue.`
        : "This task is a prerequisite setup step for tool-backed execution."
      : executionStrategy === "tool_execution"
        ? fallbackToolkit.length > 0
          ? `Use connected toolkit(s) ${fallbackToolkit.join(", ")} to complete the task when possible.`
          : "Use available connected tools to complete the task when possible."
        : fallbackToolkit.length > 0
          ? `Tool context to consider: ${fallbackToolkit.join(", ")}.`
          : "";

  return {
    requiredToolkitSlugs: fallbackToolkit,
    requiredToolIds: params.task.requiredToolIds ?? [],
    executionStrategy,
    toolSummary,
  };
}

function enrichClarificationTasks(params: {
  objective: string;
  tasks: ClarificationTaskDraft[];
  availableToolkitSlugs?: string[];
  selectedToolkitSlugs?: string[];
}) {
  return params.tasks.map((task) => ({
    ...task,
    ...planTaskTools({
      objective: params.objective,
      task,
      availableToolkitSlugs: params.availableToolkitSlugs,
      selectedToolkitSlugs: params.selectedToolkitSlugs,
    }),
  }));
}

function createTaskDraft(task: {
  title: string;
  description: string;
  agentId: AgentId;
}): ClarificationTaskDraft {
  return {
    ...task,
    requiredToolkitSlugs: [],
    requiredToolIds: [],
    executionStrategy: "analysis_only",
    toolSummary: "",
  };
}

function fallbackClarification(
  objective: string,
  transcript: TranscriptTurn[],
  clarificationRounds = 0,
): ClarificationResult {
  const userTurns = transcript.filter((turn) => turn.role === "user");
  const objectiveLower = objective.toLowerCase();
  const isBroadObjective =
    objective.length > 120 ||
    /(launch|pipeline|workflow|research|automate|campaign|roadmap|multi)/.test(objectiveLower);
  const latestUserTurn = userTurns.at(-1)?.content ?? "";
  const hasStructuredAnswers = countStructuredAnswers(latestUserTurn) >= 2;
  const hasEnoughAnswers =
    userTurns.length >= 3 || transcript.length >= 4 || hasStructuredAnswers;
  const hasHitRoundLimit = clarificationRounds >= 3;

  if (!hasEnoughAnswers && !hasHitRoundLimit) {
    return {
      status: "needs_input",
      summary: "The objective is promising, but the agent still needs a few constraints before execution.",
      confidenceToProceed: 0.42,
      executionMode: isBroadObjective ? "multi_agent" : "single_agent",
      questions: [
        createTextQuestion({
          id: "success_outcome",
          prompt: "What specific outcome would make this objective a success?",
          helpText:
            "The agent needs a clear definition of success so it can optimize the plan around a concrete result.",
        }),
        createSelectQuestion({
          id: "primary_audience",
          prompt: "Who is the primary audience or customer for this work?",
          helpText:
            "The intended audience changes the scope, tone, and execution priorities.",
          options: [
            {
              id: "existing_customers",
              label: "Existing customers",
              description: "Optimize for current users and retention or expansion work.",
            },
            {
              id: "new_prospects",
              label: "New prospects",
              description: "Optimize for acquisition and first-touch clarity.",
              isRecommended: true,
            },
            {
              id: "internal_team",
              label: "Internal team",
              description: "Optimize for internal stakeholders or operations.",
            },
          ],
          allowOther: true,
          recommendedOptionIds: ["new_prospects"],
        }),
        createSelectQuestion({
          id: "time_constraint",
          prompt: "What timeline should AutoBot optimize for?",
          helpText:
            "Time and delivery pressure affect how ambitious the first plan should be.",
          options: [
            {
              id: "asap",
              label: "As soon as possible",
              description: "Bias toward immediate progress and a smaller first delivery slice.",
              isRecommended: true,
            },
            {
              id: "this_week",
              label: "Within this week",
              description: "Balance speed with a more complete first plan.",
            },
            {
              id: "no_fixed_deadline",
              label: "No fixed deadline",
              description: "Optimize for completeness over speed.",
            },
          ],
          allowOther: true,
          optional: true,
          recommendedOptionIds: ["asap"],
          otherLabel: "Different deadline",
          otherPlaceholder: "Add a date, milestone, or operating constraint",
        }),
      ],
      draftMarkdown: "",
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
          createTaskDraft({
            title: "Map the objective into a clear execution brief",
            description: "Capture goals, constraints, target audience, and success metrics.",
            agentId: "orchestrator",
          }),
          createTaskDraft({
            title: "Research supporting facts, context, and dependencies",
            description: "Gather the inputs needed to de-risk the objective.",
            agentId: "researcher",
          }),
          createTaskDraft({
            title: "Execute the first delivery slice",
            description: "Start tangible work against the brief and produce an initial result.",
            agentId: "operator",
          }),
          createTaskDraft({
            title: "Review output quality and close open gaps",
            description: "Assess whether the produced result satisfies the business goal.",
            agentId: "analyst",
          }),
        ]
      : [
          createTaskDraft({
            title: "Convert the objective into an execution brief",
            description: "Summarize goals, constraints, and the immediate deliverable.",
            agentId: "orchestrator",
          }),
          createTaskDraft({
            title: "Complete the first meaningful task",
            description: "Produce a concrete output toward the business objective.",
            agentId: "operator",
          }),
          createTaskDraft({
            title: "Review and finalize the response",
            description: "Confirm the output answers the clarified objective.",
            agentId: "analyst",
          }),
        ];

  const summary =
    executionMode === "multi_agent"
      ? hasHitRoundLimit
        ? "The objective is broad, and AutoBot is proceeding with explicit assumptions after reaching the clarification limit."
        : "The objective is actionable and broad enough to justify specialist delegation."
      : hasHitRoundLimit
        ? "The objective is actionable enough to proceed, and AutoBot is filling the remaining gaps with explicit assumptions."
        : "The objective is actionable and compact enough for a focused single-agent run.";
  const eventNarrative = [
    "Clarification is complete.",
    ...(hasHitRoundLimit
      ? ["AutoBot reached the clarification round limit and proceeded using explicit working assumptions."]
      : []),
    executionMode === "multi_agent"
      ? "The orchestrator selected a delegated execution path."
      : "The orchestrator selected a focused single-agent path.",
  ];

  return {
    status: "ready_to_execute",
    summary,
    confidenceToProceed: 0.82,
    executionMode,
    questions: [],
    draftMarkdown: buildDraftMarkdown({
      objective,
      summary,
      executionMode,
      tasks,
      eventNarrative,
    }),
    tasks,
    eventNarrative,
  };
}

async function callStructuredClarifier(
  objective: string,
  transcript: TranscriptTurn[],
  clarificationRounds: number,
) {
  const clarifier = getConfiguredClarifier();

  if (!clarifier) {
    console.warn("[clarifier] No configured model found; using fallback clarification.", {
      objectiveLength: objective.length,
      clarificationRounds,
      transcriptTurns: transcript.length,
    });
    return fallbackClarification(objective, transcript, clarificationRounds);
  }

  try {
    const parsed = clarificationResultSchema.parse(
      await clarifier.generateClarification({
        systemPrompt: clarifierSystemPrompt,
        userPrompt: buildTranscriptPrompt(objective, transcript),
      }),
    );

    return {
      ...parsed,
      draftMarkdown:
        parsed.draftMarkdown ||
        (parsed.status === "ready_to_execute"
          ? buildDraftMarkdown({
              objective,
              summary: parsed.summary,
              executionMode: parsed.executionMode,
              tasks: parsed.tasks,
              eventNarrative: parsed.eventNarrative,
            })
          : ""),
      questions: parsed.questions.map<ClarificationQuestionDraft>((question) => ({
        id: slugifyQuestionId(question.id || question.prompt),
        prompt: question.prompt,
        helpText: question.helpText,
        optional: question.optional ?? false,
        inputKind: question.inputKind ?? "text",
        options: question.options ?? [],
        allowOther: question.allowOther ?? false,
        otherLabel: question.otherLabel ?? "Other",
        otherPlaceholder: question.otherPlaceholder ?? "Add a different answer",
        prefill: {
          selectedOptionIds: question.prefill?.selectedOptionIds ?? [],
          otherText: question.prefill?.otherText ?? "",
          text: question.prefill?.text ?? "",
        },
      })),
    };
  } catch {
    return fallbackClarification(objective, transcript, clarificationRounds);
  }
}

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
        metadata: {
          taskId: selectedTask.id,
          tool: "execute_task",
          activeToolkitSlugs: state.activeToolkitSlugs,
        },
      }),
      ...(state.activeToolkitSlugs.length > 0
        ? [
            createEvent({
              runId: state.runId,
              type: "tool",
              agentId,
              message: `Connected toolkits available: ${state.activeToolkitSlugs.join(", ")}`,
              metadata: { taskId: selectedTask.id, toolkits: state.activeToolkitSlugs },
            }),
          ]
        : []),
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
  clarificationRounds?: number;
}) {
  const result = await callStructuredClarifier(
    params.objective,
    params.transcript,
    params.clarificationRounds ?? 0,
  );

  return result ?? fallbackClarification(
    params.objective,
    params.transcript,
    params.clarificationRounds ?? 0,
  );
}

export function buildInitialRunPayload(params: {
  runId: string;
  sessionId: string;
  objective: string;
  result: ClarificationResult;
  activeToolkitSlugs?: string[];
  selectedToolkitSlugs?: string[];
}) {
  const plannedTasks = enrichClarificationTasks({
    objective: params.objective,
    tasks: params.result.tasks,
    availableToolkitSlugs: params.activeToolkitSlugs,
    selectedToolkitSlugs: params.selectedToolkitSlugs,
  });

  const tasks = plannedTasks.map((task, index) => {
    const agentId = normalizeAgentId(task.agentId);
    return {
      runId: params.runId,
      title: task.title,
      description: task.description || null,
      status: "waiting" as const,
      position: index,
      agentId,
      agentLabel: AGENT_STYLES[agentId].label,
      requiredToolkitSlugs: task.requiredToolkitSlugs ?? [],
      requiredToolIds: task.requiredToolIds ?? [],
      executionStrategy: task.executionStrategy ?? "analysis_only",
      toolSummary: task.toolSummary || null,
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
    ...plannedTasks
      .filter(
        (task) =>
          (task.requiredToolkitSlugs?.length ?? 0) > 0 ||
          Boolean(task.toolSummary),
      )
      .map((task) =>
        createEvent({
          runId: params.runId,
          type: "tool",
          agentId: normalizeAgentId(task.agentId),
          message:
            task.toolSummary ||
            `Planned tool context: ${(task.requiredToolkitSlugs ?? []).join(", ")}`,
          metadata: {
            taskTitle: task.title,
            executionStrategy: task.executionStrategy ?? "analysis_only",
            requiredToolkitSlugs: task.requiredToolkitSlugs ?? [],
            requiredToolIds: task.requiredToolIds ?? [],
          },
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
  activeToolkitSlugs?: string[];
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
    activeToolkitSlugs: params.activeToolkitSlugs ?? [],
  });

  return {
    status: result.status,
    finalSummary: result.finalSummary,
    tasks: result.tasks,
    events: result.newEvents,
    usage: result.newUsage,
  };
}
