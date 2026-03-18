import type { RunToolPreflight, ToolActionTarget, ToolTaskPlanItem, ToolkitReadinessItem } from "@/lib/tools/types";

export const RUN_STATUSES = [
  "clarifying",
  "ready",
  "running",
  "completed",
  "blocked",
  "failed",
] as const;

export const TASK_STATUSES = ["waiting", "underway", "complete"] as const;

export const EVENT_TYPES = ["system", "agent", "tool", "handoff", "task"] as const;

export const USAGE_CATEGORIES = ["chat", "tool", "automation", "agent_handoff"] as const;

export const USAGE_STATUSES = ["started", "succeeded", "failed", "cancelled"] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type UsageCategory = (typeof USAGE_CATEGORIES)[number];
export type UsageStatus = (typeof USAGE_STATUSES)[number];
export type ExecutionMode = "single_agent" | "multi_agent";
export type RunActionRequiredKind =
  | "tool_authentication"
  | "manual_setup"
  | "tool_confirmation"
  | "manual_pause";

export type RunActionRequired = {
  kind: RunActionRequiredKind;
  title: string;
  body: string;
  reason: string;
  blockingTaskTitle: string | null;
  requiredToolkitSlugs: string[];
  readiness: ToolkitReadinessItem[];
  taskToolPlan: ToolTaskPlanItem[];
  actionLabel: string | null;
  actionHref: string | null;
  actionTarget: ToolActionTarget | null;
  resumeLabel: string | null;
  canResume: boolean;
  autoResume: boolean;
  notifiedAt: string | null;
  emailFallbackAt: string | null;
  emailEscalatedAt: string | null;
  resolvedAt: string | null;
};

export type TranscriptRole = "user" | "assistant";

export type ClarificationMessage = {
  id: string;
  sessionId: string;
  role: TranscriptRole;
  content: string;
  questions: string[];
  createdAt: string;
};

export type RunRecord = {
  id: string;
  sessionId: string;
  userId: string | null;
  projectId: string | null;
  objectiveId: string | null;
  objective: string;
  status: RunStatus;
  executionMode: ExecutionMode;
  readinessSummary: string | null;
  finalSummary: string | null;
  actionRequired: RunActionRequired | null;
  createdAt: string;
  updatedAt: string;
};

export type RunListItem = RunRecord;

export type RunTask = {
  id: string;
  runId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
  agentId: string | null;
  agentLabel: string | null;
  requiredToolkitSlugs: string[];
  requiredToolIds: string[];
  executionStrategy: "manual_setup" | "tool_execution" | "analysis_only";
  toolSummary: string | null;
  actionRequired: RunActionRequired | null;
  createdAt: string;
  updatedAt: string;
};

export type RunEvent = {
  id: string;
  runId: string;
  type: EventType;
  agentId: string | null;
  agentLabel: string | null;
  colorToken: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type UsageRecord = {
  id: string;
  runId: string | null;
  sessionId: string | null;
  category: UsageCategory;
  name: string;
  agentId: string | null;
  status: UsageStatus;
  inputSummary: string | null;
  resultSummary: string | null;
  tokenCount: number | null;
  latencyMs: number | null;
  costEstimate: number | null;
  startedAt: string;
  finishedAt: string | null;
};

export type AutomationRun = {
  id: string;
  automationKey: string;
  status: UsageStatus;
  resultSummary: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type WorkspacePayload = {
  run: RunRecord;
  tasks: RunTask[];
  events: RunEvent[];
  usage: UsageRecord[];
  toolPreflight: RunToolPreflight | null;
};
