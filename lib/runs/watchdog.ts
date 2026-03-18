import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyActionRequiredToTasks,
  buildToolAuthActionRequired,
  ensureRunBlockedNotification,
  resolveRunAttentionNotification,
  sendRunAttentionInAppNotification,
} from "@/lib/runs/action-required";
import { advanceRunWorkspace } from "@/lib/runs/advance";
import {
  fetchWorkspace,
  insertRunEvents,
  listRunsForWatchdog,
  syncRunTasks,
  updateRunStatus,
} from "@/lib/runs/repository";
import type { WorkspacePayload } from "@/lib/runs/types";

const STALLED_RUN_THRESHOLD_MS = 45 * 1000;

function isRunStalled(workspace: WorkspacePayload, now = Date.now()) {
  if (workspace.run.status !== "ready" && workspace.run.status !== "running") {
    return false;
  }

  const hasUnderwayTask = workspace.tasks.some((task) => task.status === "underway");
  if (hasUnderwayTask) {
    return false;
  }

  const hasWaitingTask = workspace.tasks.some((task) => task.status === "waiting");
  if (!hasWaitingTask) {
    return false;
  }

  const updatedAt = Date.parse(workspace.run.updatedAt);
  if (Number.isNaN(updatedAt)) {
    return true;
  }

  return now - updatedAt >= STALLED_RUN_THRESHOLD_MS;
}

function getStalledTaskTitle(workspace: WorkspacePayload) {
  return workspace.tasks.find((task) => task.status === "waiting")?.title ?? null;
}

async function recordRunAttention(params: {
  supabase: SupabaseClient;
  workspace: WorkspacePayload;
  title?: string;
  body?: string;
}) {
  if (!params.workspace.run.userId) {
    return;
  }

  await sendRunAttentionInAppNotification(params.supabase, {
    userId: params.workspace.run.userId,
    runId: params.workspace.run.id,
    objective: params.workspace.run.objective,
    title: params.title,
    body: params.body,
    blockingTaskTitle: getStalledTaskTitle(params.workspace),
  });
  await insertRunEvents(params.supabase, [
    {
      runId: params.workspace.run.id,
      type: "system",
      agentId: "orchestrator",
      agentLabel: "Orchestrator",
      colorToken: "rose",
      message:
        params.body ??
        "Run watchdog detected that this run needs attention before it can continue.",
      metadata: {
        source: "runs_watchdog",
      },
    },
  ]);
}

async function handleBlockedRun(params: {
  supabase: SupabaseClient;
  workspace: WorkspacePayload;
}) {
  const { workspace } = params;
  if (!workspace.run.userId) {
    return workspace;
  }
  const actionRequired = workspace.run.actionRequired;

  if (!actionRequired || actionRequired.resolvedAt) {
    await resolveRunAttentionNotification(params.supabase, {
      userId: workspace.run.userId,
      runId: workspace.run.id,
    }).catch(() => undefined);
    return workspace;
  }

  await ensureRunBlockedNotification(params.supabase, {
    userId: workspace.run.userId,
    runId: workspace.run.id,
    objective: workspace.run.objective,
    status: workspace.run.status,
    actionRequired,
  });
  await resolveRunAttentionNotification(params.supabase, {
    userId: workspace.run.userId,
    runId: workspace.run.id,
  });

  return workspace;
}

async function handleReadyOrRunningRun(params: {
  supabase: SupabaseClient;
  workspace: WorkspacePayload;
}) {
  const initialWorkspace = params.workspace;
  if (!initialWorkspace.run.userId) {
    return initialWorkspace;
  }
  const blockingReadiness =
    initialWorkspace.toolPreflight?.readiness.filter((item) =>
      initialWorkspace.toolPreflight?.blockingToolkitSlugs.includes(item.toolkitSlug),
    ) ?? [];

  if (
    initialWorkspace.toolPreflight?.launchState === "blocked" &&
    blockingReadiness.length > 0 &&
    initialWorkspace.run.userId
  ) {
    console.log("[runs.watchdog] converting run to tool blocker", {
      runId: initialWorkspace.run.id,
      blockingToolkitSlugs: initialWorkspace.toolPreflight.blockingToolkitSlugs,
    });
    const blockedAction = buildToolAuthActionRequired({
      runId: initialWorkspace.run.id,
      readiness: blockingReadiness,
      preflight: initialWorkspace.toolPreflight,
      blockingTaskTitle: getStalledTaskTitle(initialWorkspace),
      body: "This run cannot continue until the required tools are connected and ready.",
      actionHref: `/dashboard/runs?runId=${initialWorkspace.run.id}&connectTools=1`,
    });

    await syncRunTasks(params.supabase, {
      runId: initialWorkspace.run.id,
      tasks: applyActionRequiredToTasks(initialWorkspace.tasks, blockedAction),
    });
    await updateRunStatus(params.supabase, {
      runId: initialWorkspace.run.id,
      userId: initialWorkspace.run.userId,
      status: "blocked",
      actionRequired: blockedAction,
    });
    await ensureRunBlockedNotification(params.supabase, {
      userId: initialWorkspace.run.userId,
      runId: initialWorkspace.run.id,
      objective: initialWorkspace.run.objective,
      status: "blocked",
      actionRequired: blockedAction,
    });
    await resolveRunAttentionNotification(params.supabase, {
      userId: initialWorkspace.run.userId,
      runId: initialWorkspace.run.id,
    });

    return fetchWorkspace(params.supabase, {
      runId: initialWorkspace.run.id,
      userId: initialWorkspace.run.userId,
    });
  }

  const user = {
    sub: initialWorkspace.run.userId,
  };
  let advancedWorkspace = initialWorkspace;

  try {
    console.log("[runs.watchdog] attempting background advance", {
      runId: initialWorkspace.run.id,
      status: initialWorkspace.run.status,
    });
    advancedWorkspace = await advanceRunWorkspace({
      supabase: params.supabase,
      user,
      runId: initialWorkspace.run.id,
    });
  } catch (error) {
    console.error("[runs.watchdog] background advance failed", {
      runId: initialWorkspace.run.id,
      error,
    });
    await recordRunAttention({
      supabase: params.supabase,
      workspace: initialWorkspace,
      title: "Run needs attention",
      body:
        "AutoBot could not advance this run automatically. Open the run to review the current task and required tools.",
    });
    return initialWorkspace;
  }

  console.log("[runs.watchdog] background advance result", {
    runId: advancedWorkspace.run.id,
    status: advancedWorkspace.run.status,
    updatedAt: advancedWorkspace.run.updatedAt,
    hasUnderwayTask: advancedWorkspace.tasks.some((task) => task.status === "underway"),
    waitingTasks: advancedWorkspace.tasks.filter((task) => task.status === "waiting").length,
  });

  if (advancedWorkspace.run.status === "blocked") {
    if (advancedWorkspace.run.userId) {
      await resolveRunAttentionNotification(params.supabase, {
        userId: advancedWorkspace.run.userId,
        runId: advancedWorkspace.run.id,
      });
    }
    return advancedWorkspace;
  }

  if (isRunStalled(advancedWorkspace) && advancedWorkspace.run.userId) {
    console.log("[runs.watchdog] run remains stalled after advance", {
      runId: advancedWorkspace.run.id,
      updatedAt: advancedWorkspace.run.updatedAt,
    });
    const blockedTaskTitle = getStalledTaskTitle(advancedWorkspace);
    await recordRunAttention({
      supabase: params.supabase,
      workspace: advancedWorkspace,
      body: blockedTaskTitle
        ? `"${blockedTaskTitle}" is still waiting and no operator progress was recorded.`
        : "No operator progress was recorded for this run.",
    });
    return advancedWorkspace;
  }

  if (advancedWorkspace.run.userId) {
    await resolveRunAttentionNotification(params.supabase, {
      userId: advancedWorkspace.run.userId,
      runId: advancedWorkspace.run.id,
    });
  }

  return advancedWorkspace;
}

export async function sweepRunsWatchdog(params: {
  supabase: SupabaseClient;
  userId?: string;
}) {
  console.log("[runs.watchdog] sweep start", {
    userId: params.userId ?? null,
  });
  const candidates = await listRunsForWatchdog(params.supabase, {
    userId: params.userId,
    statuses: ["ready", "running", "blocked"],
  });

  const results = {
    processed: 0,
    blockedNotified: 0,
    stalledNotified: 0,
    advanced: 0,
  };

  for (const candidate of candidates) {
    if (!candidate.userId) {
      continue;
    }

    console.log("[runs.watchdog] inspecting run", {
      runId: candidate.id,
      userId: candidate.userId,
      status: candidate.status,
      updatedAt: candidate.updatedAt,
    });

    const workspace = await fetchWorkspace(params.supabase, {
      runId: candidate.id,
      userId: candidate.userId,
    }).catch(() => null);

    if (!workspace) {
      continue;
    }

    results.processed += 1;

    if (workspace.run.status === "blocked") {
      const beforeNotifiedAt = workspace.run.actionRequired?.notifiedAt ?? null;
      await handleBlockedRun({
        supabase: params.supabase,
        workspace,
      });
      if (!beforeNotifiedAt && workspace.run.actionRequired) {
        results.blockedNotified += 1;
      }
      continue;
    }

    const beforeUpdatedAt = workspace.run.updatedAt;
    const nextWorkspace = await handleReadyOrRunningRun({
      supabase: params.supabase,
      workspace,
    });

    if (nextWorkspace.run.updatedAt !== beforeUpdatedAt || nextWorkspace.run.status !== workspace.run.status) {
      results.advanced += 1;
    }

    if (isRunStalled(nextWorkspace)) {
      results.stalledNotified += 1;
    }
  }

  console.log("[runs.watchdog] sweep complete", results);
  return results;
}
