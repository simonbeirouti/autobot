import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ClarificationMessage,
  RunEvent,
  RunActionRequired,
  RunListItem,
  RunRecord,
  RunTask,
  TaskStatus,
  UsageRecord,
  WorkspacePayload,
  ExecutionMode,
  RunStatus,
} from "@/lib/runs/types";
import { buildProjectToolPreflight } from "@/lib/tools/preflight";

function asObject<T>(value: T) {
  return value;
}

export function createSessionId() {
  return randomUUID();
}

export async function appendClarificationMessage(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
    questions?: string[];
  },
) {
  const { error } = await supabase.from("clarification_messages").insert({
    session_id: params.sessionId,
    user_id: params.userId,
    role: params.role,
    content: params.content,
    questions: params.questions ?? [],
  });

  if (error) {
    throw error;
  }
}

export async function fetchClarificationTranscript(
  supabase: SupabaseClient,
  params: { sessionId: string; userId: string },
) {
  const { data, error } = await supabase
    .from("clarification_messages")
    .select("id, session_id, role, content, questions, created_at")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map<ClarificationMessage>((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    questions: (row.questions ?? []) as string[],
    createdAt: row.created_at,
  }));
}

export async function fetchRuns(
  supabase: SupabaseClient,
  params: { userId: string; projectId?: string | null },
) {
  let query = supabase
    .from("runs")
    .select(
      "id, user_id, session_id, project_id, objective_id, objective, status, execution_mode, readiness_summary, final_summary, action_required, created_at, updated_at",
    )
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false });

  if (params.projectId) {
    query = query.eq("project_id", params.projectId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map<RunListItem>(mapRun);
}

export async function fetchLatestRunBySessionId(
  supabase: SupabaseClient,
  params: { sessionId: string; userId: string },
) {
  const { data, error } = await supabase
    .from("runs")
    .select(
      "id, user_id, session_id, project_id, objective_id, objective, status, execution_mode, readiness_summary, final_summary, action_required, created_at, updated_at",
    )
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRun(data) : null;
}

export async function createRun(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    userId: string;
    projectId?: string | null;
    objectiveId?: string | null;
    objective: string;
    executionMode: ExecutionMode;
    readinessSummary: string;
    actionRequired?: RunActionRequired | null;
  },
) {
  const { data, error } = await supabase
    .from("runs")
    .insert({
      session_id: params.sessionId,
      user_id: params.userId,
      project_id: params.projectId ?? null,
      objective_id: params.objectiveId ?? null,
      objective: params.objective,
      status: "ready",
      execution_mode: params.executionMode,
      readiness_summary: params.readinessSummary,
      action_required: params.actionRequired ?? null,
    })
    .select("id, user_id, session_id, project_id, objective_id, objective, status, execution_mode, readiness_summary, final_summary, action_required, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapRun(data);
}

export async function insertRunTasks(
  supabase: SupabaseClient,
  tasks: Array<{
    runId: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    position: number;
    agentId: string | null;
    agentLabel: string | null;
    toolRequirement: "none" | "optional" | "required";
    requiredToolkitSlugs: string[];
    optionalToolkitSlugs: string[];
    requiredToolIds: string[];
    executionStrategy: "manual_setup" | "tool_execution" | "analysis_only";
    toolSummary: string | null;
    actionRequired?: RunActionRequired | null;
  }>,
) {
  if (tasks.length === 0) {
    return;
  }

  const { error } = await supabase.from("run_tasks").insert(
    tasks.map((task) => ({
      run_id: task.runId,
      title: task.title,
      description: task.description,
        status: task.status,
        position: task.position,
        agent_id: task.agentId,
        agent_label: task.agentLabel,
        tool_requirement: task.toolRequirement,
        required_toolkit_slugs: task.requiredToolkitSlugs,
        optional_toolkit_slugs: task.optionalToolkitSlugs,
        required_tool_ids: task.requiredToolIds,
        execution_strategy: task.executionStrategy,
        tool_summary: task.toolSummary,
        action_required: task.actionRequired ?? null,
      })),
  );

  if (error) {
    throw error;
  }
}

export async function insertRunEvents(
  supabase: SupabaseClient,
  events: Array<Omit<RunEvent, "id" | "createdAt">>,
) {
  if (events.length === 0) {
    return;
  }

  const { error } = await supabase.from("run_events").insert(
    events.map((event) => ({
      run_id: event.runId,
      type: event.type,
      agent_id: event.agentId,
      agent_label: event.agentLabel,
      color_token: event.colorToken,
      message: event.message,
      metadata: event.metadata,
    })),
  );

  if (error) {
    throw error;
  }
}

export async function insertUsageRecords(
  supabase: SupabaseClient,
  userId: string,
  usageRecords: Array<
    Omit<UsageRecord, "id" | "startedAt" | "finishedAt"> & {
      startedAt?: string;
      finishedAt?: string | null;
    }
  >,
) {
  if (usageRecords.length === 0) {
    return;
  }

  const normalizeTimestamp = (value: string | null | undefined) => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
  };

  const { error } = await supabase.from("usage_records").insert(
    usageRecords.map((record) => {
      const startedAt = normalizeTimestamp(record.startedAt) ?? new Date().toISOString();
      const finishedAt = normalizeTimestamp(record.finishedAt);
      const row = {
        run_id: record.runId,
        session_id: record.sessionId,
        user_id: userId,
        category: record.category,
        name: record.name,
        agent_id: record.agentId,
        status: record.status,
        input_summary: record.inputSummary,
        result_summary: record.resultSummary,
        token_count: record.tokenCount,
        latency_ms: record.latencyMs,
        cost_estimate: record.costEstimate,
        started_at: startedAt,
        ...(record.finishedAt !== undefined && finishedAt ? { finished_at: finishedAt } : {}),
      };

      return row;
    }),
  );

  if (error) {
    throw error;
  }
}

export async function fetchWorkspace(
  supabase: SupabaseClient,
  params: { runId: string; userId: string },
) {
  const { data: runRow, error: runError } = await supabase
    .from("runs")
    .select("id, user_id, session_id, project_id, objective_id, objective, status, execution_mode, readiness_summary, final_summary, action_required, created_at, updated_at")
    .eq("id", params.runId)
    .eq("user_id", params.userId)
    .single();

  if (runError) {
    throw runError;
  }

  const [{ data: taskRows, error: taskError }, { data: eventRows, error: eventError }, { data: usageRows, error: usageError }] =
    await Promise.all([
      supabase
        .from("run_tasks")
        .select("id, run_id, title, description, status, position, agent_id, agent_label, tool_requirement, required_toolkit_slugs, optional_toolkit_slugs, required_tool_ids, execution_strategy, tool_summary, action_required, created_at, updated_at")
        .eq("run_id", params.runId)
        .order("position", { ascending: true }),
      supabase
        .from("run_events")
        .select("id, run_id, type, agent_id, agent_label, color_token, message, metadata, created_at")
        .eq("run_id", params.runId)
        .order("created_at", { ascending: true }),
      supabase
        .from("usage_records")
        .select("id, run_id, session_id, category, name, agent_id, status, input_summary, result_summary, token_count, latency_ms, cost_estimate, started_at, finished_at")
        .eq("run_id", params.runId)
        .order("started_at", { ascending: true }),
    ]);

  if (taskError) {
    throw taskError;
  }
  if (eventError) {
    throw eventError;
  }
  if (usageError) {
    throw usageError;
  }

  const run = mapRun(runRow);
  const tasks = (taskRows ?? []).map(mapTask);

  return asObject<WorkspacePayload>({
    run,
    tasks,
    events: (eventRows ?? []).map(mapEvent),
    usage: (usageRows ?? []).map(mapUsage),
    toolPreflight:
      run.projectId
        ? await buildProjectToolPreflight(supabase, {
            userId: params.userId,
            projectId: run.projectId,
            objective: run.objective,
            tasks,
            nextPath: `/dashboard/runs?runId=${run.id}`,
          })
        : null,
  });
}

export async function updateRunStatus(
  supabase: SupabaseClient,
  params: {
    runId: string;
    userId: string;
    status: RunStatus;
    finalSummary?: string | null;
    actionRequired?: RunActionRequired | null;
  },
) {
  const payload: Record<string, unknown> = {
    status: params.status,
  };

  if (params.finalSummary !== undefined) {
    payload.final_summary = params.finalSummary;
  }
  if (params.actionRequired !== undefined) {
    payload.action_required = params.actionRequired;
  }

  const { error } = await supabase
    .from("runs")
    .update(payload)
    .eq("id", params.runId)
    .eq("user_id", params.userId);

  if (error) {
    throw error;
  }
}

export async function updateTaskStatuses(
  supabase: SupabaseClient,
  params: {
    runId: string;
    userId: string;
    tasks: RunTask[];
  },
) {
  for (const task of params.tasks) {
    const { error } = await supabase
      .from("run_tasks")
      .update({
        status: task.status,
        agent_id: task.agentId,
        agent_label: task.agentLabel,
        tool_requirement: task.toolRequirement,
        required_toolkit_slugs: task.requiredToolkitSlugs,
        optional_toolkit_slugs: task.optionalToolkitSlugs,
        required_tool_ids: task.requiredToolIds,
        execution_strategy: task.executionStrategy,
        tool_summary: task.toolSummary,
        action_required: task.actionRequired ?? null,
      })
      .eq("id", task.id)
      .eq("run_id", params.runId);

    if (error) {
      throw error;
    }
  }
}

export async function syncRunTasks(
  supabase: SupabaseClient,
  params: {
    runId: string;
    tasks: RunTask[];
  },
) {
  const { error: deleteError } = await supabase
    .from("run_tasks")
    .delete()
    .eq("run_id", params.runId);

  if (deleteError) {
    throw deleteError;
  }

  if (params.tasks.length === 0) {
    return;
  }

  const { error } = await supabase.from("run_tasks").insert(
    params.tasks.map((task) => ({
      id: task.id,
      run_id: task.runId,
      title: task.title,
      description: task.description,
      status: task.status,
      position: task.position,
      agent_id: task.agentId,
      agent_label: task.agentLabel,
      tool_requirement: task.toolRequirement,
      required_toolkit_slugs: task.requiredToolkitSlugs,
      optional_toolkit_slugs: task.optionalToolkitSlugs,
      required_tool_ids: task.requiredToolIds,
      execution_strategy: task.executionStrategy,
      tool_summary: task.toolSummary,
      action_required: task.actionRequired ?? null,
    })),
  );

  if (error) {
    throw error;
  }
}

export async function listBlockedRunsForUser(
  supabase: SupabaseClient,
  params: { userId: string },
) {
  const { data, error } = await supabase
    .from("runs")
    .select(
      "id, user_id, session_id, project_id, objective_id, objective, status, execution_mode, readiness_summary, final_summary, action_required, created_at, updated_at",
    )
    .eq("user_id", params.userId)
    .eq("status", "blocked")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRun);
}

export async function listRunsForWatchdog(
  supabase: SupabaseClient,
  params: {
    userId?: string;
    statuses?: RunStatus[];
    limit?: number;
  },
) {
  let query = supabase
    .from("runs")
    .select(
      "id, user_id, session_id, project_id, objective_id, objective, status, execution_mode, readiness_summary, final_summary, action_required, created_at, updated_at",
    )
    .order("updated_at", { ascending: true });

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  }

  if (params.statuses && params.statuses.length > 0) {
    query = query.in("status", params.statuses);
  }

  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRun);
}

function mapRun(row: {
  id: string;
  user_id?: string | null;
  session_id: string;
  project_id: string | null;
  objective_id: string | null;
  objective: string;
  status: RunStatus;
  execution_mode: ExecutionMode;
  readiness_summary: string | null;
  final_summary: string | null;
  action_required?: RunActionRequired | null;
  created_at: string;
  updated_at: string;
}): RunRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id ?? null,
    projectId: row.project_id,
    objectiveId: row.objective_id,
    objective: row.objective,
    status: row.status,
    executionMode: row.execution_mode,
    readinessSummary: row.readiness_summary,
    finalSummary: row.final_summary,
    actionRequired: row.action_required ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: {
  id: string;
  run_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
  agent_id: string | null;
  agent_label: string | null;
  tool_requirement: "none" | "optional" | "required";
  required_toolkit_slugs: string[] | null;
  optional_toolkit_slugs: string[] | null;
  required_tool_ids: string[] | null;
  execution_strategy: "manual_setup" | "tool_execution" | "analysis_only";
  tool_summary: string | null;
  action_required: RunActionRequired | null;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: row.id,
    runId: row.run_id,
    title: row.title,
    description: row.description,
    status: row.status,
    position: row.position,
    agentId: row.agent_id,
    agentLabel: row.agent_label,
    toolRequirement: row.tool_requirement ?? "none",
    requiredToolkitSlugs: row.required_toolkit_slugs ?? [],
    optionalToolkitSlugs: row.optional_toolkit_slugs ?? [],
    requiredToolIds: row.required_tool_ids ?? [],
    executionStrategy: row.execution_strategy,
    toolSummary: row.tool_summary,
    actionRequired: row.action_required ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: {
  id: string;
  run_id: string;
  type: RunEvent["type"];
  agent_id: string | null;
  agent_label: string | null;
  color_token: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}) {
  return {
    id: row.id,
    runId: row.run_id,
    type: row.type,
    agentId: row.agent_id,
    agentLabel: row.agent_label,
    colorToken: row.color_token,
    message: row.message,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function mapUsage(row: {
  id: string;
  run_id: string | null;
  session_id: string | null;
  category: UsageRecord["category"];
  name: string;
  agent_id: string | null;
  status: UsageRecord["status"];
  input_summary: string | null;
  result_summary: string | null;
  token_count: number | null;
  latency_ms: number | null;
  cost_estimate: number | null;
  started_at: string;
  finished_at: string | null;
}) {
  return {
    id: row.id,
    runId: row.run_id,
    sessionId: row.session_id,
    category: row.category,
    name: row.name,
    agentId: row.agent_id,
    status: row.status,
    inputSummary: row.input_summary,
    resultSummary: row.result_summary,
    tokenCount: row.token_count,
    latencyMs: row.latency_ms,
    costEstimate: row.cost_estimate,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}
