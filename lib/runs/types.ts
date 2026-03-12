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
  objective: string;
  status: RunStatus;
  executionMode: ExecutionMode;
  readinessSummary: string | null;
  finalSummary: string | null;
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
};
