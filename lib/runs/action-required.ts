import type { SupabaseClient } from "@supabase/supabase-js";

import { createNotification, ensureNotificationPreferences } from "@/lib/notifications/repository";
import { sendNotificationEmail } from "@/lib/notifications/email";
import type { RunActionRequired, RunRecord, RunTask } from "@/lib/runs/types";
import { updateRunStatus } from "@/lib/runs/repository";
import type { ToolkitReadinessItem } from "@/lib/tools/types";

const EMAIL_FALLBACK_DELAY_MS = 60 * 60 * 1000;

export function isRunAwaitingUserAction(run: Pick<RunRecord, "status" | "actionRequired">) {
  return run.status === "blocked" && Boolean(run.actionRequired && !run.actionRequired.resolvedAt);
}

export function buildToolAuthActionRequired(params: {
  runId: string;
  readiness: ToolkitReadinessItem[];
  title?: string;
  body?: string;
  actionHref?: string | null;
  now?: string;
}): RunActionRequired {
  const now = params.now ?? new Date().toISOString();
  const emailFallbackAt = new Date(Date.parse(now) + EMAIL_FALLBACK_DELAY_MS).toISOString();
  const requiredToolkitSlugs = params.readiness
    .filter((item) => item.status !== "ready")
    .map((item) => item.toolkitSlug);
  const actionHref =
    params.actionHref ??
    `/onboarding/providers?next=${encodeURIComponent(`/dashboard/runs?runId=${params.runId}`)}`;

  return {
    kind: "tool_authentication",
    title: params.title ?? "Connect tools to continue this run",
    body:
      params.body ??
      "This run is waiting for provider authentication or setup before tool-backed work can continue.",
    reason: "tool_prerequisites_missing",
    requiredToolkitSlugs,
    readiness: params.readiness,
    actionLabel: "Connect tools",
    actionHref,
    resumeLabel: "Resume run",
    canResume: true,
    autoResume: true,
    notifiedAt: null,
    emailFallbackAt,
    emailEscalatedAt: null,
    resolvedAt: null,
  };
}

export function buildManualPauseActionRequired(params: {
  runId: string;
  title?: string;
  body?: string;
}): RunActionRequired {
  return {
    kind: "manual_pause",
    title: params.title ?? "Run stopped",
    body: params.body ?? "This run was stopped manually and will stay paused until you resume it.",
    reason: "user_paused_run",
    requiredToolkitSlugs: [],
    readiness: [],
    actionLabel: null,
    actionHref: null,
    resumeLabel: "Run",
    canResume: true,
    autoResume: false,
    notifiedAt: null,
    emailFallbackAt: null,
    emailEscalatedAt: null,
    resolvedAt: null,
  };
}

export function isManualPauseActionRequired(actionRequired: RunActionRequired | null | undefined) {
  return Boolean(
    actionRequired &&
      !actionRequired.resolvedAt &&
      (actionRequired.kind === "manual_pause" || actionRequired.reason === "user_paused_run"),
  );
}

export function clearResolvedActionRequired(actionRequired: RunActionRequired | null) {
  if (!actionRequired) {
    return null;
  }

  return {
    ...actionRequired,
    resolvedAt: new Date().toISOString(),
  };
}

export function applyActionRequiredToTasks(tasks: RunTask[], actionRequired: RunActionRequired | null) {
  return tasks.map((task) =>
    task.status === "complete"
      ? task
      : {
          ...task,
          actionRequired,
        },
  );
}

export async function sendRunBlockedInAppNotification(
  supabase: SupabaseClient,
  params: {
    userId: string;
    runId: string;
    objective: string;
    actionRequired: RunActionRequired;
  },
) {
  await ensureNotificationPreferences(supabase, { userId: params.userId });

  await createNotification(supabase, {
    userId: params.userId,
    category: "platform_updates",
    channel: "in_app",
    kind: "run_blocked",
    title: params.actionRequired.title,
    body: params.actionRequired.body,
    href: `/dashboard/runs?runId=${params.runId}`,
    actionLabel: params.actionRequired.actionLabel,
    actionHref: params.actionRequired.actionHref,
    dedupeKey: `run:${params.runId}:blocked:in_app`,
    metadata: {
      runId: params.runId,
      objective: params.objective,
      requiredToolkitSlugs: params.actionRequired.requiredToolkitSlugs,
      reason: params.actionRequired.reason,
    },
  });
}

export async function sendDueRunBlockedEmail(
  supabase: SupabaseClient,
  params: {
    userId: string;
    recipientEmail: string | null;
    recipientName: string | null;
    run: RunRecord;
  },
) {
  const actionRequired = params.run.actionRequired;
  if (!actionRequired || !params.recipientEmail) {
    return false;
  }

  if (actionRequired.resolvedAt || actionRequired.emailEscalatedAt || !actionRequired.emailFallbackAt) {
    return false;
  }

  const fallbackTime = Date.parse(actionRequired.emailFallbackAt);
  if (Number.isNaN(fallbackTime) || fallbackTime > Date.now()) {
    return false;
  }

  const preferences = await ensureNotificationPreferences(supabase, {
    userId: params.userId,
  });
  if (!preferences.platformUpdatesEmail) {
    return false;
  }

  try {
    await createNotification(supabase, {
      userId: params.userId,
      category: "platform_updates",
      channel: "email",
      kind: "run_blocked_email_fallback",
      title: actionRequired.title,
      body: actionRequired.body,
      href: `/dashboard/runs?runId=${params.run.id}`,
      actionLabel: actionRequired.actionLabel,
      actionHref: actionRequired.actionHref,
      dedupeKey: `run:${params.run.id}:blocked:email`,
      metadata: {
        runId: params.run.id,
        requiredToolkitSlugs: actionRequired.requiredToolkitSlugs,
        reason: actionRequired.reason,
      },
    });

    await sendNotificationEmail({
      actionLabel: actionRequired.actionLabel,
      actionUrl: actionRequired.actionHref ?? `/dashboard/runs?runId=${params.run.id}`,
      body: actionRequired.body,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      subject: actionRequired.title,
    });
  } catch (error) {
    console.error("Failed to send run blocked fallback email", {
      error,
      runId: params.run.id,
      userId: params.userId,
    });
    return false;
  }

  await updateRunStatus(supabase, {
    runId: params.run.id,
    userId: params.userId,
    status: params.run.status,
    actionRequired: {
      ...actionRequired,
      emailEscalatedAt: new Date().toISOString(),
    },
  });

  return true;
}
