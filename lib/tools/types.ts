export type ComposioToolCategoryRecord = {
  id: string;
  name: string;
  toolkitCount: number;
};

export type ComposioToolkitCategoryTag = {
  id: string;
  name: string;
};

export type ComposioToolkitRecord = {
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  appUrl: string | null;
  toolCount: number;
  noAuth: boolean;
  authSchemes: string[];
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  categories: ComposioToolkitCategoryTag[];
  connectionStatus: ToolkitConnectionStatus;
  connectionAuthScheme: string | null;
  apiKeyLastFour: string | null;
  apiKeyUpdatedAt: string | null;
};

export type ComposioToolDetailRecord = {
  slug: string;
  name: string;
  description: string;
  noAuth: boolean;
  scopes: string[];
  tags: string[];
  toolkitSlug: string;
};

export type ComposioToolCatalog = {
  generatedAt: string;
  toolkitCount: number;
  categories: ComposioToolCategoryRecord[];
  toolkits: ComposioToolkitRecord[];
};

export type ToolkitConnectionStatus =
  | "not_connected"
  | "initiated"
  | "active"
  | "failed"
  | "expired"
  | "disabled";

export type RecommendedToolkit = {
  slug: string;
  title: string;
  description: string;
  category: "calendar" | "cms" | "messaging" | "work" | "crm" | "search";
  isRecommended: boolean;
};

export type UserToolOnboarding = {
  userId: string;
  selectedToolkitSlugs: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderConnection = {
  id: string;
  userId: string;
  toolkitSlug: string;
  composioSessionId: string | null;
  connectedAccountId: string | null;
  authScheme: string | null;
  apiKeyLastFour: string | null;
  apiKeyUpdatedAt: string | null;
  status: ToolkitConnectionStatus;
  redirectUrl: string | null;
  callbackUrl: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectToolkitSelection = {
  id: string;
  projectId: string;
  userId: string;
  toolkitSlug: string;
  createdAt: string;
};

export type ToolOnboardingPayload = {
  recommendedToolkits: RecommendedToolkit[];
  onboarding: UserToolOnboarding | null;
  connections: ProviderConnection[];
};

export type ToolExecutionMode = "read" | "write" | "admin";

export type ToolRiskLevel = "low" | "medium" | "high";

export type ToolkitReadinessStatus =
  | "ready"
  | "not_selected"
  | "not_connected"
  | "missing_session"
  | "auth_in_progress"
  | "confirmation_required";

export type ToolkitReadinessItem = {
  toolkitSlug: string;
  status: ToolkitReadinessStatus;
  message: string;
};

export type ToolActionTarget = {
  kind: "connect_tools_modal";
  href: string;
};

export type ToolTaskPlanItem = {
  title: string;
  executionStrategy: "manual_setup" | "tool_execution" | "analysis_only";
  toolSummary: string | null;
  requiredToolkitSlugs: string[];
};

export type ToolPreflightToolkit = {
  slug: string;
  title: string;
  description: string | null;
  readiness: ToolkitReadinessItem;
};

export type RunToolPreflight = {
  requiredToolkitSlugs: string[];
  taskToolPlan: ToolTaskPlanItem[];
  readiness: ToolkitReadinessItem[];
  blockingToolkitSlugs: string[];
  launchState: "ready" | "blocked";
  recommendedAction: {
    label: string;
    href: string;
    target: ToolActionTarget;
  } | null;
  toolkits: ToolPreflightToolkit[];
};

export type ToolInvocationStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "confirmation_required";

export type ResolvedToolCandidate = {
  id: string;
  toolSlug: string;
  toolkitSlug: string;
  sessionId: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  executionMode: ToolExecutionMode;
  riskLevel: ToolRiskLevel;
  supportsChat: boolean;
  supportsRunTasks: boolean;
  executionGuidance: string | null;
};

export type ToolRuntimeContext = {
  userId: string;
  projectId: string | null;
  objectiveId: string | null;
  threadId: string | null;
  runId: string | null;
  allowedToolkitSlugs: string[];
  confirmedWriteActions?: boolean;
};

export type ToolRuntimeMissingPrerequisite = {
  toolkitSlug: string;
  reason:
    | "not_selected"
    | "not_connected"
    | "missing_session"
    | "auth_in_progress"
    | "confirmation_required";
  message: string;
};

export type ResolvedProjectToolRuntime = {
  selectedToolkitSlugs: string[];
  activeToolkitSlugs: string[];
  inactiveToolkitSlugs: string[];
  markdown: string;
  toolCandidates: ResolvedToolCandidate[];
  missingPrerequisites: ToolRuntimeMissingPrerequisite[];
};

export type ToolExecutionResult = {
  status: ToolInvocationStatus;
  toolSlug: string;
  toolkitSlug: string;
  message: string;
  data: Record<string, unknown> | null;
  logId: string | null;
};

export type ToolRuntimeEvent =
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
    };
