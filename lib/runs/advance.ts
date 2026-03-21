import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { advanceRunExecution } from "@/lib/agents/orchestrator";
import {
  applyActionRequiredToTasks,
  buildToolAuthActionRequired,
  isManualPauseActionRequired,
  isRunAwaitingUserAction,
  resolveRunAttentionNotification,
  resolveRunBlockedNotification,
  sendRunBlockedInAppNotification,
} from "@/lib/runs/action-required";
import {
  fetchWorkspace,
  insertRunEvents,
  insertUsageRecords,
  syncRunTasks,
  updateRunStatus,
} from "@/lib/runs/repository";
import type { RunActionRequired, RunEvent, RunTask, UsageRecord, WorkspacePayload } from "@/lib/runs/types";
import { fetchObjective, fetchProject } from "@/lib/projects/repository";
import {
  buildMissingToolkitChecklist,
  executeToolAssistedPrompt,
  resolveProjectToolRuntime,
} from "@/lib/tools/runtime";
import { buildToolPreflightFromReadiness } from "@/lib/tools/preflight";
import type { ResolvedProjectToolRuntime, ToolkitReadinessItem } from "@/lib/tools/types";

function createRunEvent(
  runId: string,
  type: RunEvent["type"],
  message: string,
  metadata?: Record<string, unknown>,
): Omit<RunEvent, "id" | "createdAt"> {
  return {
    runId,
    type,
    agentId: "operator",
    agentLabel: "Operator",
    colorToken: type === "tool" ? "emerald" : "amber",
    message,
    metadata: metadata ?? null,
  };
}

function createUsageRecord(
  runId: string,
  name: string,
  resultSummary: string,
): Omit<UsageRecord, "id" | "startedAt" | "finishedAt"> & {
  startedAt?: string;
  finishedAt?: string | null;
} {
  const now = new Date().toISOString();

  return {
    runId,
    sessionId: null,
    category: "tool",
    name,
    agentId: "operator",
    status: "succeeded",
    inputSummary: null,
    resultSummary,
    tokenCount: null,
    latencyMs: null,
    costEstimate: null,
    startedAt: now,
    finishedAt: now,
  };
}

function reindexTasks(tasks: RunTask[]) {
  return tasks.map((task, index) => ({
    ...task,
    position: index,
  }));
}

function getTaskRequiredToolkitSlugs(
  task: RunTask,
  _fallbackToolRuntime: ResolvedProjectToolRuntime | null,
  taskPlan?: {
    title: string;
    toolRequirement: "none" | "optional" | "required";
    requiredToolkitSlugs: string[];
    optionalToolkitSlugs: string[];
  }[] | null,
) {
  if (task.requiredToolkitSlugs.length > 0) {
    return task.requiredToolkitSlugs;
  }

  const plannedMatch = taskPlan?.find((item) => item.title === task.title);
  if (plannedMatch && plannedMatch.requiredToolkitSlugs.length > 0) {
    return plannedMatch.requiredToolkitSlugs;
  }

  return [];
}

function getTaskPreferredToolkitSlugs(
  task: RunTask,
  fallbackToolRuntime: ResolvedProjectToolRuntime | null,
  taskPlan?: {
    title: string;
    toolRequirement: "none" | "optional" | "required";
    requiredToolkitSlugs: string[];
    optionalToolkitSlugs: string[];
  }[] | null,
) {
  if (task.requiredToolkitSlugs.length > 0) {
    return task.requiredToolkitSlugs;
  }

  if (task.optionalToolkitSlugs.length > 0) {
    return task.optionalToolkitSlugs;
  }

  const plannedMatch = taskPlan?.find((item) => item.title === task.title);
  if (plannedMatch?.requiredToolkitSlugs.length) {
    return plannedMatch.requiredToolkitSlugs;
  }
  if (plannedMatch?.optionalToolkitSlugs.length) {
    return plannedMatch.optionalToolkitSlugs;
  }

  return fallbackToolRuntime?.activeToolkitSlugs ?? [];
}

function createSetupTasks(params: {
  runId: string;
  runtime: ResolvedProjectToolRuntime;
  actionRequired: RunActionRequired;
}) {
  return buildMissingToolkitChecklist(params.runtime).map((item) => ({
    id: randomUUID(),
    runId: params.runId,
    title: item.title,
    description: item.description,
    status: "waiting" as const,
    position: 0,
    agentId: "operator",
    agentLabel: "Operator",
    toolRequirement: "required" as const,
    requiredToolkitSlugs: [item.toolkitSlug],
    optionalToolkitSlugs: [],
    requiredToolIds: [],
    executionStrategy: "manual_setup" as const,
    toolSummary: item.description,
    actionRequired: params.actionRequired,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

function filterSyntheticSetupTasks(tasks: RunTask[]) {
  return tasks.filter(
    (task) => !(task.executionStrategy === "manual_setup" && task.actionRequired?.kind === "tool_authentication"),
  );
}

function getRelevantReadiness(
  runtime: ResolvedProjectToolRuntime,
  requiredToolkitSlugs: string[],
): ToolkitReadinessItem[] {
  const items = runtime.missingPrerequisites.map((item) => ({
    toolkitSlug: item.toolkitSlug,
    status: item.reason,
    message: item.message,
  }));

  if (requiredToolkitSlugs.length === 0) {
    return items;
  }

  return items.filter((item) => requiredToolkitSlugs.includes(item.toolkitSlug));
}

async function maybeNotifyBlockedRun(params: {
  supabase: SupabaseClient;
  userId: string;
  objective: string;
  runId: string;
  currentActionRequired: RunActionRequired | null;
  nextActionRequired: RunActionRequired;
}) {
  if (params.currentActionRequired?.notifiedAt) {
    return {
      ...params.nextActionRequired,
      notifiedAt: params.currentActionRequired.notifiedAt,
      emailFallbackAt:
        params.currentActionRequired.emailFallbackAt ?? params.nextActionRequired.emailFallbackAt,
      emailEscalatedAt: params.currentActionRequired.emailEscalatedAt,
    };
  }

  await sendRunBlockedInAppNotification(params.supabase, {
    userId: params.userId,
    runId: params.runId,
    objective: params.objective,
    actionRequired: params.nextActionRequired,
  });

  return {
    ...params.nextActionRequired,
    notifiedAt: new Date().toISOString(),
  };
}

export async function advanceRunWorkspace(params: {
  supabase: SupabaseClient;
  user: {
    sub: string;
    email?: string | null;
    user_metadata?: {
      full_name?: string | null;
      name?: string | null;
    };
  };
  runId: string;
  force?: boolean;
}) {
  console.log("[runs.advance] start", {
    runId: params.runId,
    userId: params.user.sub,
    force: params.force ?? false,
  });
  const workspace = await fetchWorkspace(params.supabase, {
    runId: params.runId,
    userId: params.user.sub,
  });

  console.log("[runs.advance] workspace loaded", {
    runId: workspace.run.id,
    status: workspace.run.status,
    actionRequired: workspace.run.actionRequired?.reason ?? null,
    taskStatuses: workspace.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      strategy: task.executionStrategy,
    })),
  });

  if (workspace.run.status === "completed" || workspace.run.status === "failed") {
    console.log("[runs.advance] exiting early for terminal status", {
      runId: workspace.run.id,
      status: workspace.run.status,
    });
    return workspace;
  }

  const toolRuntime =
    workspace.run.projectId
      ? await resolveProjectToolRuntime(params.supabase, {
          projectId: workspace.run.projectId,
          userId: params.user.sub,
          query: workspace.run.objective,
        })
      : null;

  if (isRunAwaitingUserAction(workspace.run) && !params.force) {
    console.log("[runs.advance] blocked and not forced, returning current workspace", {
      runId: workspace.run.id,
      actionRequired: workspace.run.actionRequired?.reason ?? null,
    });
    return workspace;
  }

  let currentWorkspace = workspace;

  if (isRunAwaitingUserAction(workspace.run)) {
    const clearedTasks = reindexTasks(
      applyActionRequiredToTasks(filterSyntheticSetupTasks(workspace.tasks), null),
    );

    if (isManualPauseActionRequired(workspace.run.actionRequired)) {
      console.log("[runs.advance] clearing manual pause", {
        runId: workspace.run.id,
      });
      await syncRunTasks(params.supabase, {
        runId: workspace.run.id,
        tasks: clearedTasks,
      });
      await updateRunStatus(params.supabase, {
        runId: workspace.run.id,
        userId: params.user.sub,
        status: "ready",
        actionRequired: null,
      });
      await resolveRunBlockedNotification(params.supabase, {
        userId: params.user.sub,
        runId: workspace.run.id,
      });

      currentWorkspace = await fetchWorkspace(params.supabase, {
        runId: params.runId,
        userId: params.user.sub,
      });

      if (params.force) {
        console.log("[runs.advance] manual pause cleared via force resume", {
          runId: currentWorkspace.run.id,
          status: currentWorkspace.run.status,
        });
        return currentWorkspace;
      }
    } else if (toolRuntime) {
      const remaining = getRelevantReadiness(
        toolRuntime,
        workspace.run.actionRequired?.requiredToolkitSlugs ?? [],
      );

      if (remaining.some((item) => item.status !== "ready")) {
        console.log("[runs.advance] still waiting on tool readiness", {
          runId: workspace.run.id,
          remaining,
        });
        return workspace;
      }

      console.log("[runs.advance] clearing tool blocker", {
        runId: workspace.run.id,
      });
      await syncRunTasks(params.supabase, {
        runId: workspace.run.id,
        tasks: clearedTasks,
      });
      await updateRunStatus(params.supabase, {
        runId: workspace.run.id,
        userId: params.user.sub,
        status: "ready",
        actionRequired: null,
      });
      await resolveRunBlockedNotification(params.supabase, {
        userId: params.user.sub,
        runId: workspace.run.id,
      });

      currentWorkspace = await fetchWorkspace(params.supabase, {
        runId: params.runId,
        userId: params.user.sub,
      });
    }
  }

  const result = await advanceRunExecution({
    runId: currentWorkspace.run.id,
    status: currentWorkspace.run.status,
    executionMode: currentWorkspace.run.executionMode,
    tasks: currentWorkspace.tasks,
    events: currentWorkspace.events,
    usage: currentWorkspace.usage,
    finalSummary: currentWorkspace.run.finalSummary,
    activeToolkitSlugs: toolRuntime?.activeToolkitSlugs ?? [],
  });

  console.log("[runs.advance] execution graph returned", {
    runId: currentWorkspace.run.id,
    nextStatus: result.status,
    tasks: result.tasks.map((task) => ({
      title: task.title,
      status: task.status,
      strategy: task.executionStrategy,
      requiredToolkitSlugs: task.requiredToolkitSlugs,
    })),
  });

  let nextTasks = result.tasks;
  let nextEvents = result.events;
  let nextUsage = result.usage;
  let nextStatus = result.status;
  let nextFinalSummary = result.finalSummary;
  let nextActionRequired: RunActionRequired | null | undefined = undefined;

  const startedTask = result.tasks.find((task) => task.status === "underway");

  if (startedTask && currentWorkspace.run.projectId && toolRuntime) {
    console.log("[runs.advance] evaluating started task", {
      runId: currentWorkspace.run.id,
      taskTitle: startedTask.title,
      strategy: startedTask.executionStrategy,
      requiredToolkitSlugs: startedTask.requiredToolkitSlugs,
    });
    const requiredToolkitSlugs = getTaskRequiredToolkitSlugs(
      startedTask,
      toolRuntime,
      currentWorkspace.toolPreflight?.taskToolPlan ?? null,
    );
    const preferredToolkitSlugs = getTaskPreferredToolkitSlugs(
      startedTask,
      toolRuntime,
      currentWorkspace.toolPreflight?.taskToolPlan ?? null,
    );
    const relevantMissingPrerequisites =
      requiredToolkitSlugs.length > 0
        ? toolRuntime.missingPrerequisites.filter((item) =>
            requiredToolkitSlugs.includes(item.toolkitSlug),
          )
        : [];
    const taskRuntimeCandidates =
      preferredToolkitSlugs.length > 0
        ? toolRuntime.toolCandidates.filter((candidate) =>
            preferredToolkitSlugs.includes(candidate.toolkitSlug),
          )
        : toolRuntime.toolCandidates;
    const effectiveExecutionStrategy =
      startedTask.executionStrategy === "manual_setup" && relevantMissingPrerequisites.length === 0
        ? taskRuntimeCandidates.length > 0 || requiredToolkitSlugs.length > 0
          ? ("tool_execution" as const)
          : ("analysis_only" as const)
        : startedTask.executionStrategy === "tool_execution" &&
            startedTask.toolRequirement === "optional" &&
            taskRuntimeCandidates.length === 0
          ? ("analysis_only" as const)
        : startedTask.executionStrategy;

    const shouldBlockForToolReadiness =
      relevantMissingPrerequisites.length > 0 &&
      (effectiveExecutionStrategy === "tool_execution" ||
        startedTask.requiredToolkitSlugs.length > 0 ||
        taskRuntimeCandidates.length === 0);

    if (
      (effectiveExecutionStrategy === "manual_setup" && relevantMissingPrerequisites.length > 0) ||
      shouldBlockForToolReadiness
    ) {
      console.log("[runs.advance] blocking on toolkit readiness", {
        runId: currentWorkspace.run.id,
        taskTitle: startedTask.title,
        requiredToolkitSlugs,
        preferredToolkitSlugs,
        relevantMissingPrerequisites,
      });
      const readiness = relevantMissingPrerequisites.map((item) => ({
        toolkitSlug: item.toolkitSlug,
        status: item.reason,
        message: item.message,
      }));
      const blockedPreflight = buildToolPreflightFromReadiness({
        tasks: result.tasks.map((task) => ({
          title: task.title,
          toolRequirement: task.toolRequirement,
          executionStrategy: task.executionStrategy,
          toolSummary: task.toolSummary,
          requiredToolkitSlugs: task.requiredToolkitSlugs,
          optionalToolkitSlugs: task.optionalToolkitSlugs,
        })),
        readiness: currentWorkspace.toolPreflight?.readiness ?? readiness,
        nextPath: `/dashboard/runs?runId=${currentWorkspace.run.id}`,
      });
      const blockedAction = buildToolAuthActionRequired({
        runId: currentWorkspace.run.id,
        readiness,
        preflight: blockedPreflight,
        blockingTaskTitle: startedTask.title,
        title: `Connect tools for "${startedTask.title}"`,
        body: `Finish the required provider setup for "${startedTask.title}" to continue this run.`,
        actionHref: `/dashboard/runs?runId=${currentWorkspace.run.id}&connectTools=1`,
      });
      nextActionRequired = await maybeNotifyBlockedRun({
        supabase: params.supabase,
        userId: params.user.sub,
        objective: currentWorkspace.run.objective,
        runId: currentWorkspace.run.id,
        currentActionRequired: currentWorkspace.run.actionRequired,
        nextActionRequired: blockedAction,
      });

      const setupTasks = createSetupTasks({
        runId: currentWorkspace.run.id,
        runtime: {
          ...toolRuntime,
          missingPrerequisites: relevantMissingPrerequisites,
        },
        actionRequired: nextActionRequired,
      });

      nextTasks = reindexTasks([
        ...setupTasks,
        ...result.tasks.map((task) =>
          task.id === startedTask.id
            ? { ...task, status: "waiting" as const, actionRequired: nextActionRequired ?? null }
            : { ...task, actionRequired: nextActionRequired ?? null },
        ),
      ]);
      nextStatus = "blocked";
      nextEvents = [
        ...nextEvents,
        createRunEvent(
          currentWorkspace.run.id,
          "system",
          `Blocked pending toolkit setup: ${relevantMissingPrerequisites
            .map((item) => item.toolkitSlug)
            .join(", ")}`,
          { taskId: startedTask.id },
        ),
      ];
      nextUsage = [
        ...nextUsage,
        createUsageRecord(
          currentWorkspace.run.id,
          "tool_setup_blocked",
          "Run blocked until the required toolkit setup tasks are completed.",
        ),
      ];
    } else if (
      effectiveExecutionStrategy === "tool_execution" &&
      taskRuntimeCandidates.length > 0
    ) {
      console.log("[runs.advance] executing tool-backed task", {
        runId: currentWorkspace.run.id,
        taskTitle: startedTask.title,
        candidateCount: taskRuntimeCandidates.length,
        preferredToolkitSlugs,
      });
      const project = await fetchProject(params.supabase, {
        projectId: currentWorkspace.run.projectId,
        userId: params.user.sub,
      });
      const objective = currentWorkspace.run.objectiveId
        ? await fetchObjective(params.supabase, {
            objectiveId: currentWorkspace.run.objectiveId,
            projectId: currentWorkspace.run.projectId,
            userId: params.user.sub,
          }).catch(() => null)
        : null;
      const taskEvents: RunEvent[] = [];
      let confirmationRequired = false;
      let toolFailed = false;

      const execution = await executeToolAssistedPrompt({
        supabase: params.supabase,
        context: {
          userId: params.user.sub,
          projectId: currentWorkspace.run.projectId,
          objectiveId: currentWorkspace.run.objectiveId,
          threadId: null,
          runId: currentWorkspace.run.id,
          allowedToolkitSlugs: preferredToolkitSlugs,
          confirmedWriteActions: false,
        },
        systemPrompt: [
          `You are executing the run task "${startedTask.title}".`,
          startedTask.description ? `Task details: ${startedTask.description}` : "",
          `Project: ${project.name}.`,
          objective ? `Objective: ${objective.title}.` : "",
          startedTask.toolSummary ?? "",
          preferredToolkitSlugs.length > 0
            ? `Prefer these toolkits: ${preferredToolkitSlugs.join(", ")}.`
            : "Use connected tools when they materially help complete this task.",
          "If the available tools are insufficient, explain what remains blocked.",
          "Return a concise execution summary.",
        ]
          .filter(Boolean)
          .join("\n"),
        userMessage: [startedTask.title, startedTask.description].filter(Boolean).join("\n\n"),
        runtime: {
          ...toolRuntime,
          toolCandidates: taskRuntimeCandidates,
        },
        onEvent: (event) => {
          if (event.type === "tool_confirmation_required") {
            confirmationRequired = true;
          }

          if (event.type === "tool_call_failed") {
            toolFailed = true;
          }

          const message =
            event.type === "tool_call_started"
              ? `Executing ${event.toolName} (${event.toolkitSlug})`
              : event.type === "tool_call_completed"
                ? `${event.toolName} completed: ${event.summary}`
                : event.type === "tool_call_failed"
                  ? `${event.toolName} failed: ${event.error}`
                  : `${event.toolName} requires confirmation: ${event.reason}`;

          taskEvents.push({
            id: randomUUID(),
            runId: currentWorkspace.run.id,
            type: "tool",
            agentId: "operator",
            agentLabel: "Operator",
            colorToken:
              event.type === "tool_call_failed" || event.type === "tool_confirmation_required"
                ? "rose"
                : "emerald",
            message,
            metadata: {
              taskId: startedTask.id,
              toolkitSlug: event.toolkitSlug,
              toolName: event.toolName,
            },
            createdAt: new Date().toISOString(),
          });
        },
      });

      nextEvents = [
        ...nextEvents,
        ...taskEvents.map((taskEvent) => ({
          runId: taskEvent.runId,
          type: taskEvent.type,
          agentId: taskEvent.agentId,
          agentLabel: taskEvent.agentLabel,
          colorToken: taskEvent.colorToken,
          message: taskEvent.message,
          metadata: taskEvent.metadata,
        })),
        createRunEvent(currentWorkspace.run.id, "agent", execution.answer || "Task executed.", {
          taskId: startedTask.id,
        }),
      ];
      nextUsage = [
        ...nextUsage,
        createUsageRecord(
          currentWorkspace.run.id,
          "tool_task_execution",
          execution.answer || "Tool-backed task execution attempted.",
        ),
      ];

      if (confirmationRequired || toolFailed) {
        console.log("[runs.advance] tool execution blocked after execution attempt", {
          runId: currentWorkspace.run.id,
          taskTitle: startedTask.title,
          confirmationRequired,
          toolFailed,
        });
        nextTasks = result.tasks.map((task) =>
          task.id === startedTask.id ? { ...task, status: "waiting" as const } : task,
        );
        nextStatus = "blocked";
      } else {
        console.log("[runs.advance] tool execution completed successfully", {
          runId: currentWorkspace.run.id,
          taskTitle: startedTask.title,
        });
        nextTasks = result.tasks.map((task) =>
          task.id === startedTask.id ? { ...task, status: "complete" as const } : task,
        );
        nextStatus = nextTasks.every((task) => task.status === "complete")
          ? "completed"
          : "running";
        nextActionRequired = null;
        if (nextStatus === "completed") {
          nextFinalSummary =
            execution.answer || "All current tasks have moved through execution and review.";
        }
      }
    } else if (effectiveExecutionStrategy === "analysis_only") {
      console.log("[runs.advance] completing analysis-only task", {
        runId: currentWorkspace.run.id,
        taskTitle: startedTask.title,
      });
      nextEvents = [
        ...nextEvents,
        createRunEvent(
          currentWorkspace.run.id,
          "agent",
          startedTask.toolSummary || `${startedTask.title} does not require tool execution.`,
          { taskId: startedTask.id, executionStrategy: effectiveExecutionStrategy },
        ),
      ];
      nextTasks = result.tasks.map((task) =>
        task.id === startedTask.id ? { ...task, status: "complete" as const } : task,
      );
      nextStatus = nextTasks.every((task) => task.status === "complete")
        ? "completed"
        : "running";
      nextActionRequired = null;
    }
  }

  await syncRunTasks(params.supabase, {
    runId: currentWorkspace.run.id,
    tasks: nextTasks,
  });
  console.log("[runs.advance] tasks synced", {
    runId: currentWorkspace.run.id,
    nextStatus,
    actionRequired: nextActionRequired?.reason ?? null,
  });
  await updateRunStatus(params.supabase, {
    runId: currentWorkspace.run.id,
    userId: params.user.sub,
    status: nextStatus,
    finalSummary: nextFinalSummary,
    actionRequired: nextActionRequired,
  });
  if (nextStatus !== "blocked" || !nextActionRequired) {
    await resolveRunBlockedNotification(params.supabase, {
      userId: params.user.sub,
      runId: currentWorkspace.run.id,
    });
  }
  const isStillStalled =
    (nextStatus === "ready" || nextStatus === "running") &&
    nextTasks.some((task) => task.status === "waiting") &&
    !nextTasks.some((task) => task.status === "underway");
  if (!isStillStalled) {
    await resolveRunAttentionNotification(params.supabase, {
      userId: params.user.sub,
      runId: currentWorkspace.run.id,
    });
  }
  await insertRunEvents(params.supabase, nextEvents);
  await insertUsageRecords(params.supabase, params.user.sub, nextUsage);

  console.log("[runs.advance] completed", {
    runId: currentWorkspace.run.id,
    nextStatus,
    finalSummary: nextFinalSummary,
    actionRequired: nextActionRequired?.reason ?? null,
  });

  return fetchWorkspace(params.supabase, {
    runId: params.runId,
    userId: params.user.sub,
  });
}

export async function autoResumeBlockedRunsForToolkit(params: {
  supabase: SupabaseClient;
  user: {
    sub: string;
    email?: string | null;
    user_metadata?: {
      full_name?: string | null;
      name?: string | null;
    };
  };
  runs: WorkspacePayload[];
}) {
  const resumedRunIds: string[] = [];

  for (const workspace of params.runs) {
    if (!isRunAwaitingUserAction(workspace.run)) {
      continue;
    }

    await advanceRunWorkspace({
      supabase: params.supabase,
      user: params.user,
      runId: workspace.run.id,
      force: true,
    });
    resumedRunIds.push(workspace.run.id);
  }

  return resumedRunIds;
}
