import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { advanceRunExecution } from "@/lib/agents/orchestrator";
import { fetchObjective, fetchProject } from "@/lib/projects/repository";
import {
  syncRunTasks,
  fetchWorkspace,
  insertRunEvents,
  insertUsageRecords,
  updateRunStatus,
} from "@/lib/runs/repository";
import type { RunEvent, RunTask, UsageRecord } from "@/lib/runs/types";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildMissingToolkitChecklist,
  executeToolAssistedPrompt,
  resolveProjectToolRuntime,
} from "@/lib/tools/runtime";

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

function getTaskRequiredToolkitSlugs(task: RunTask, fallbackToolRuntime: NonNullable<Awaited<ReturnType<typeof resolveProjectToolRuntime>>> | null) {
  if (task.requiredToolkitSlugs.length > 0) {
    return task.requiredToolkitSlugs;
  }

  return fallbackToolRuntime?.activeToolkitSlugs ?? [];
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { runId } = await context.params;
    const supabase = await createClient();
    const workspace = await fetchWorkspace(supabase, { runId, userId: user.sub });
    const toolRuntime =
      workspace.run.projectId
        ? await resolveProjectToolRuntime(supabase, {
            projectId: workspace.run.projectId,
            userId: user.sub,
            query: workspace.run.objective,
          })
        : null;

    if (workspace.run.status === "completed" || workspace.run.status === "failed") {
      return NextResponse.json(workspace);
    }

    const result = await advanceRunExecution({
      runId: workspace.run.id,
      status: workspace.run.status,
      executionMode: workspace.run.executionMode,
      tasks: workspace.tasks,
      events: workspace.events,
      usage: workspace.usage,
      finalSummary: workspace.run.finalSummary,
      activeToolkitSlugs: toolRuntime?.activeToolkitSlugs ?? [],
    });

    let nextTasks = result.tasks;
    let nextEvents = result.events;
    let nextUsage = result.usage;
    let nextStatus = result.status;
    let nextFinalSummary = result.finalSummary;

    const startedTask = result.tasks.find((task) => task.status === "underway");

    if (startedTask && workspace.run.projectId && toolRuntime) {
      const requiredToolkitSlugs = getTaskRequiredToolkitSlugs(startedTask, toolRuntime);
      const relevantMissingPrerequisites =
        requiredToolkitSlugs.length > 0
          ? toolRuntime.missingPrerequisites.filter((item) =>
              requiredToolkitSlugs.includes(item.toolkitSlug),
            )
          : toolRuntime.missingPrerequisites;
      const taskRuntimeCandidates =
        requiredToolkitSlugs.length > 0
          ? toolRuntime.toolCandidates.filter((candidate) =>
              requiredToolkitSlugs.includes(candidate.toolkitSlug),
            )
          : toolRuntime.toolCandidates;

      if (
        startedTask.executionStrategy === "manual_setup" ||
        relevantMissingPrerequisites.length > 0
      ) {
        const setupTasks = buildMissingToolkitChecklist({
          ...toolRuntime,
          missingPrerequisites: relevantMissingPrerequisites,
        }).map((item) => ({
          id: randomUUID(),
          runId: workspace.run.id,
          title: item.title,
          description: item.description,
          status: "waiting" as const,
          position: 0,
          agentId: "operator",
          agentLabel: "Operator",
          requiredToolkitSlugs: [item.toolkitSlug],
          requiredToolIds: [],
          executionStrategy: "manual_setup" as const,
          toolSummary: item.description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        nextTasks = reindexTasks([
          ...setupTasks,
          ...result.tasks.map((task) =>
            task.id === startedTask.id ? { ...task, status: "waiting" as const } : task,
          ),
        ]);
        nextStatus = "blocked";
        nextEvents = [
          ...nextEvents,
          createRunEvent(
            workspace.run.id,
            "system",
            `Blocked pending toolkit setup: ${toolRuntime.missingPrerequisites
              .map((item) => item.toolkitSlug)
              .join(", ")}`,
            { taskId: startedTask.id },
          ),
        ];
        nextUsage = [
          ...nextUsage,
          createUsageRecord(
            workspace.run.id,
            "tool_setup_blocked",
            "Run blocked until the required toolkit setup tasks are completed.",
          ),
        ];
      } else if (
        startedTask.executionStrategy === "tool_execution" &&
        taskRuntimeCandidates.length > 0
      ) {
        const project = await fetchProject(supabase, {
          projectId: workspace.run.projectId,
          userId: user.sub,
        });
        const objective = workspace.run.objectiveId
          ? await fetchObjective(supabase, {
              objectiveId: workspace.run.objectiveId,
              projectId: workspace.run.projectId,
              userId: user.sub,
            }).catch(() => null)
          : null;
        const taskEvents: RunEvent[] = [];
        let confirmationRequired = false;
        let toolFailed = false;

        const execution = await executeToolAssistedPrompt({
          supabase,
          context: {
            userId: user.sub,
            projectId: workspace.run.projectId,
            objectiveId: workspace.run.objectiveId,
            threadId: null,
            runId: workspace.run.id,
            allowedToolkitSlugs: requiredToolkitSlugs,
            confirmedWriteActions: false,
          },
          systemPrompt: [
            `You are executing the run task "${startedTask.title}".`,
            startedTask.description ? `Task details: ${startedTask.description}` : "",
            `Project: ${project.name}.`,
            objective ? `Objective: ${objective.title}.` : "",
            startedTask.toolSummary ?? "",
            requiredToolkitSlugs.length > 0
              ? `Prefer these toolkits: ${requiredToolkitSlugs.join(", ")}.`
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
              runId: workspace.run.id,
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
          createRunEvent(workspace.run.id, "agent", execution.answer || "Task executed.", {
            taskId: startedTask.id,
          }),
        ];
        nextUsage = [
          ...nextUsage,
          createUsageRecord(
            workspace.run.id,
            "tool_task_execution",
            execution.answer || "Tool-backed task execution attempted.",
          ),
        ];

        if (confirmationRequired || toolFailed) {
          nextTasks = result.tasks.map((task) =>
            task.id === startedTask.id ? { ...task, status: "waiting" as const } : task,
          );
          nextStatus = "blocked";
        } else {
          nextTasks = result.tasks.map((task) =>
            task.id === startedTask.id ? { ...task, status: "complete" as const } : task,
          );
          nextStatus = nextTasks.every((task) => task.status === "complete")
            ? "completed"
            : "running";
          if (nextStatus === "completed") {
            nextFinalSummary =
              execution.answer || "All current tasks have moved through execution and review.";
          }
        }
      } else if (startedTask.executionStrategy === "analysis_only") {
        nextEvents = [
          ...nextEvents,
          createRunEvent(
            workspace.run.id,
            "agent",
            startedTask.toolSummary || `${startedTask.title} does not require tool execution.`,
            { taskId: startedTask.id, executionStrategy: startedTask.executionStrategy },
          ),
        ];
        nextTasks = result.tasks.map((task) =>
          task.id === startedTask.id ? { ...task, status: "complete" as const } : task,
        );
        nextStatus = nextTasks.every((task) => task.status === "complete")
          ? "completed"
          : "running";
      }
    }

    await syncRunTasks(supabase, {
      runId: workspace.run.id,
      tasks: nextTasks,
    });
    await updateRunStatus(supabase, {
      runId: workspace.run.id,
      userId: user.sub,
      status: nextStatus,
      finalSummary: nextFinalSummary,
    });
    await insertRunEvents(supabase, nextEvents);
    await insertUsageRecords(supabase, user.sub, nextUsage);

    const nextWorkspace = await fetchWorkspace(supabase, { runId, userId: user.sub });
    return NextResponse.json(nextWorkspace);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to advance run." },
      { status: 500 },
    );
  }
}
