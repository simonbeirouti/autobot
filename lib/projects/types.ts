import type { MemoryRecord } from "@/lib/memory/types";
import type { ProjectToolkitSelection, ProviderConnection } from "@/lib/tools/types";

export const OBJECTIVE_STATUSES = ["draft", "active", "completed", "archived"] as const;
export const PROJECT_STATUSES = ["active", "archived", "deleted"] as const;

export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type Project = {
  id: string;
  userId: string;
  companyKey: string;
  name: string;
  description: string;
  iconKey: string;
  status: ProjectStatus;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListItem = Project;

export type Objective = {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  description: string;
  sourceRunId: string | null;
  sourceDraftId: string | null;
  status: ObjectiveStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectAsset = {
  id: string;
  projectId: string;
  userId: string;
  label: string;
  assetType: string;
  storagePath: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ProjectChatThread = {
  id: string;
  projectId: string;
  objectiveId: string | null;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectChatMessage = {
  id: string;
  threadId: string;
  projectId: string;
  objectiveId: string | null;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  agentId: string | null;
  citedMemoryIds: string[];
  createdAt: string;
};

export type ProjectWorkspace = {
  project: Project;
  objectives: Objective[];
  assets: ProjectAsset[];
  threads: ProjectChatThread[];
  activeThread: ProjectChatThread | null;
  messages: ProjectChatMessage[];
  recentMemories: MemoryRecord[];
  toolkitSelections: ProjectToolkitSelection[];
  providerConnections: ProviderConnection[];
};

export type ProjectChatRequest = {
  projectId: string;
  objectiveId?: string | null;
  message: string;
  threadId?: string | null;
};

export type ProjectChatResponse = {
  threadId: string;
  routedAgentId: string;
  answer: string;
  citedMemoryIds: string[];
};

export type ProjectChatStreamEvent =
  | {
      type: "thread";
      threadId: string;
    }
  | {
      type: "route";
      routedAgentId: string;
    }
  | {
      type: "token";
      text: string;
    }
  | {
      type: "tool_call_started";
      toolName: string;
      toolkitSlug: string;
    }
  | {
      type: "tool_call_completed";
      toolName: string;
      toolkitSlug: string;
      summary: string;
    }
  | {
      type: "tool_call_failed";
      toolName: string;
      toolkitSlug: string;
      error: string;
    }
  | {
      type: "tool_confirmation_required";
      toolName: string;
      toolkitSlug: string;
      reason: string;
    }
  | ({
      type: "final";
    } & ProjectChatResponse)
  | {
      type: "error";
      error: string;
    };

export type ProjectOnboardingRequest = {
  name: string;
  description: string;
};
