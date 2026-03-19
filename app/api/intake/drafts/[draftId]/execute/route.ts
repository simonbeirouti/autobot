import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { buildInitialRunPayload } from "@/lib/agents/orchestrator";
import { buildToolAuthActionRequired, sendRunBlockedInAppNotification } from "@/lib/runs/action-required";
import type { RunActionRequired } from "@/lib/runs/types";
import { writeLongTermMemory } from "@/lib/memory/repository";
import { resolveCompanyKey } from "@/lib/projects/context";
import { createObjective, updateObjective } from "@/lib/projects/repository";
import { fetchIntakeDraftWithQuestions, updateIntakeDraft } from "@/lib/intake/repository";
import {
  appendClarificationMessage,
  createRun,
  fetchLatestRunBySessionId,
  insertRunEvents,
  insertRunTasks,
  insertUsageRecords,
  updateRunStatus,
} from "@/lib/runs/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { buildProjectToolPreflight } from "@/lib/tools/preflight";
import { buildMissingToolkitChecklist, resolveProjectToolRuntime } from "@/lib/tools/runtime";

function reindexTasks<T extends { position: number }>(tasks: T[]) {
  return tasks.map((task, index) => ({
    ...task,
    position: index,
  }));
}

type RunTaskRecord = {
  runId: string;
  title: string;
  description: string | null;
  status: "waiting" | "underway" | "complete";
  position: number;
  agentId: string | null;
  agentLabel: string | null;
  requiredToolkitSlugs: string[];
  requiredToolIds: string[];
  executionStrategy: "manual_setup" | "tool_execution" | "analysis_only";
  toolSummary: string | null;
  actionRequired?: RunActionRequired | null;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ draftId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { draftId } = await context.params;
    const supabase = await createClient();
    const { draft } = await fetchIntakeDraftWithQuestions(supabase, { draftId, userId: user.sub });

    if (draft.runId) {
      await updateIntakeDraft(supabase, {
        draftId,
        userId: user.sub,
        patch: {
          status: "archived",
          completedAt: draft.completedAt ?? new Date().toISOString(),
        },
      });
      return NextResponse.json({ runId: draft.runId });
    }

    const existingRun = await fetchLatestRunBySessionId(supabase, {
      sessionId: draft.sessionId,
      userId: user.sub,
    });

    if (existingRun) {
      await updateIntakeDraft(supabase, {
        draftId,
        userId: user.sub,
        patch: {
          status: "archived",
          runId: existingRun.id,
          completedAt: draft.completedAt ?? new Date().toISOString(),
        },
      });
      return NextResponse.json({ runId: existingRun.id });
    }

    if (draft.status !== "review_ready") {
      return NextResponse.json({ error: "Draft is not ready for execution." }, { status: 409 });
    }

    if (!draft.executionMode) {
      return NextResponse.json({ error: "Draft is missing an execution mode." }, { status: 409 });
    }
    if (!draft.projectId) {
      return NextResponse.json({ error: "Draft is missing a project." }, { status: 409 });
    }

    const toolRuntime = await resolveProjectToolRuntime(supabase, {
      userId: user.sub,
      projectId: draft.projectId,
      query: draft.objective,
    });

    const previewPayload = buildInitialRunPayload({
      runId: "preview",
      sessionId: draft.sessionId,
      objective: draft.objective,
      activeToolkitSlugs: toolRuntime.activeToolkitSlugs,
      selectedToolkitSlugs: toolRuntime.selectedToolkitSlugs,
      result: {
        status: "ready_to_execute",
        summary: draft.clarificationSummary ?? "Draft approved for execution.",
        confidenceToProceed: draft.confidenceToProceed ?? 0.8,
        executionMode: draft.executionMode,
        questions: [],
        draftMarkdown: draft.draftMarkdown ?? draft.generatedMarkdown ?? "",
        tasks: draft.taskDrafts,
        eventNarrative: draft.eventNarrative,
      },
    });
    const toolPreflight = await buildProjectToolPreflight(supabase, {
      userId: user.sub,
      projectId: draft.projectId,
      objective: draft.objective,
      tasks: previewPayload.tasks.map((task) => ({
        title: task.title,
        executionStrategy: task.executionStrategy,
        toolSummary: task.toolSummary,
        requiredToolkitSlugs: task.requiredToolkitSlugs,
      })),
      nextPath: `/dashboard/drafts?draftId=${draft.id}`,
      discoverMissingToolkitRequirements: true,
    });

    if (toolPreflight.launchState === "blocked") {
      return NextResponse.json(
        {
          error: "Connect the required tools before starting execution.",
          toolPreflight,
        },
        { status: 409 },
      );
    }

    const run = await createRun(supabase, {
      sessionId: draft.sessionId,
      userId: user.sub,
      projectId: draft.projectId,
      objectiveId: draft.objectiveId,
      objective: draft.objective,
      executionMode: draft.executionMode,
      readinessSummary: draft.clarificationSummary ?? "Draft approved for execution.",
    });

    const companyKey = resolveCompanyKey({
      sub: user.sub,
      email: typeof user.email === "string" ? user.email : null,
    });
    const objective = draft.objectiveId
      ? await updateObjective(supabase, {
          objectiveId: draft.objectiveId,
          projectId: draft.projectId,
          userId: user.sub,
          patch: {
            title: draft.objective,
            description: draft.clarificationSummary ?? "",
            sourceRunId: run.id,
            sourceDraftId: draft.id,
            status: "active",
          },
        })
      : await createObjective(supabase, {
          projectId: draft.projectId,
          userId: user.sub,
          title: draft.objective,
          description: draft.clarificationSummary ?? "",
          sourceRunId: run.id,
          sourceDraftId: draft.id,
          status: "active",
        });

    const initialPayload = {
      ...previewPayload,
      tasks: previewPayload.tasks.map((task) => ({
        ...task,
        runId: run.id,
      })),
      events: previewPayload.events.map((event) => ({
        ...event,
        runId: run.id,
      })),
      usage: previewPayload.usage.map((usage) => ({
        ...usage,
        runId: run.id,
      })),
    };

    await appendClarificationMessage(supabase, {
      sessionId: draft.sessionId,
      userId: user.sub,
      role: "assistant",
      content: `Execution confirmed.\n\n${draft.draftMarkdown ?? draft.generatedMarkdown ?? draft.clarificationSummary ?? ""}`,
    });

    let actionRequired: RunActionRequired | null = null;
    let taskRecords: RunTaskRecord[] = initialPayload.tasks;

    if (toolRuntime.missingPrerequisites.length > 0) {
      actionRequired = buildToolAuthActionRequired({
        runId: run.id,
        readiness: toolRuntime.missingPrerequisites.map((item) => ({
          toolkitSlug: item.toolkitSlug,
          status: item.reason,
          message: item.message,
        })),
        preflight: {
          ...toolPreflight,
          recommendedAction:
            toolPreflight.recommendedAction
              ? {
                  ...toolPreflight.recommendedAction,
                  href: `/dashboard/runs?runId=${run.id}&connectTools=1`,
                  target: {
                    kind: "connect_tools_modal",
                    href: `/dashboard/runs?runId=${run.id}&connectTools=1`,
                  },
                }
              : null,
        },
        title: "Connect tools to start this run",
        body: "This run is ready, but it needs provider authentication or setup before execution can begin.",
        actionHref: `/dashboard/runs?runId=${run.id}&connectTools=1`,
      });

      const setupTasks = buildMissingToolkitChecklist(toolRuntime).map((item) => ({
        id: randomUUID(),
        runId: run.id,
        title: item.title,
        description: item.description,
        status: "waiting" as const,
        position: 0,
        agentId: "operator" as const,
        agentLabel: "Operator" as const,
        requiredToolkitSlugs: [item.toolkitSlug],
        requiredToolIds: [] as string[],
        executionStrategy: "manual_setup" as const,
        toolSummary: item.description,
        actionRequired,
      }));

      taskRecords = reindexTasks([
        ...setupTasks,
        ...initialPayload.tasks.map((task) => ({
          ...task,
          status: "waiting" as const,
          actionRequired,
        })),
      ]);
    }

    await insertRunTasks(supabase, taskRecords);
    await insertRunEvents(supabase, initialPayload.events);
    await insertUsageRecords(supabase, user.sub, [
      ...initialPayload.usage,
      {
        runId: run.id,
        sessionId: draft.sessionId,
        category: "chat",
        name: "draft_execution_confirmation",
        agentId: "orchestrator",
        status: "succeeded",
        inputSummary: draft.objective,
        resultSummary: draft.draftMarkdown ?? draft.generatedMarkdown ?? draft.clarificationSummary,
        tokenCount: null,
        latencyMs: null,
        costEstimate: null,
      },
    ]);

    if (actionRequired) {
      await updateRunStatus(supabase, {
        runId: run.id,
        userId: user.sub,
        status: "blocked",
        actionRequired,
      });
    }

    await updateIntakeDraft(supabase, {
      draftId,
      userId: user.sub,
      patch: {
        status: "archived",
        runId: run.id,
        projectId: draft.projectId,
        objectiveId: objective.id,
        completedAt: new Date().toISOString(),
      },
    });

    if (actionRequired) {
      try {
        await sendRunBlockedInAppNotification(supabase, {
          userId: user.sub,
          runId: run.id,
          objective: run.objective,
          actionRequired,
        });

        actionRequired = {
          ...actionRequired,
          notifiedAt: new Date().toISOString(),
        };

        await updateRunStatus(supabase, {
          runId: run.id,
          userId: user.sub,
          status: "blocked",
          actionRequired,
        });
      } catch (notificationError) {
        console.error("Unable to send blocked-run notification after draft execution", {
          error: notificationError,
          draftId,
          runId: run.id,
          userId: user.sub,
        });
      }
    }

    try {
      await writeLongTermMemory(supabase, {
        userId: user.sub,
        companyKey,
        projectId: draft.projectId,
        objectiveId: objective.id,
        scope: "objective",
        kind: "objective",
        sourceType: "draft_execution",
        sourceId: draft.id,
        summary: draft.clarificationSummary ?? `Execution objective for ${objective.title}`,
        content: draft.draftMarkdown ?? draft.generatedMarkdown ?? draft.objective,
        metadata: {
          draftId: draft.id,
          runId: run.id,
          projectId: draft.projectId,
          objectiveId: objective.id,
        },
      });
    } catch (memoryError) {
      console.error("Unable to persist draft execution memory", {
        error: memoryError,
        draftId,
        runId: run.id,
        userId: user.sub,
      });
    }

    return NextResponse.json({
      runId: run.id,
      runStatus: actionRequired ? "blocked" : run.status,
      actionRequired,
    });
  } catch (error) {
    console.error("POST /api/intake/drafts/[draftId]/execute failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to execute draft." },
      { status: 500 },
    );
  }
}
