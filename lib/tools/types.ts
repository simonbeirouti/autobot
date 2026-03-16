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
