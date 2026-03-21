import type {
  InternalToolExecutorConfig,
  InternalToolDefinition,
  InternalToolCatalogRecord,
  InternalToolHttpConfig,
  InternalToolScope,
  ResolvedToolCandidate,
  ToolApprovalPolicy,
  ToolExecutionMode,
  ToolRiskLevel,
} from "@/lib/tools/types";

type InternalToolSeed = {
  slug: string;
  toolkitSlug: string;
  source: "internal_builtin" | "internal_custom";
  title: string;
  description: string;
  executionMode: ToolExecutionMode;
  riskLevel: ToolRiskLevel;
  executorKey: string;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  tags: string[];
  capabilities: string[];
  approvalPolicy: ToolApprovalPolicy;
  requiresConnection: boolean;
  enabledByDefault: boolean;
  metadata?: Record<string, unknown>;
};

const builtinSeeds: InternalToolSeed[] = [
  {
    slug: "page_extractor",
    toolkitSlug: "page_extractor",
    source: "internal_builtin",
    title: "Page Extractor",
    description: "Fetch a public web page and extract normalized content, headings, metadata, and links.",
    executionMode: "read",
    riskLevel: "low",
    executorKey: "page_extractor",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The page URL to fetch and extract." },
        extractionMode: { type: "string", enum: ["standard", "metadata_only"] },
      },
      required: ["url"],
    },
    outputSchema: null,
    tags: ["web", "extract", "seo", "content"],
    capabilities: ["page_fetch", "page_extract", "content_analysis"],
    approvalPolicy: "none",
    requiresConnection: false,
    enabledByDefault: true,
  },
  {
    slug: "web_search",
    toolkitSlug: "web_search",
    source: "internal_builtin",
    title: "Web Search",
    description: "Search the public web through AutoBot's configured search provider.",
    executionMode: "read",
    riskLevel: "low",
    executorKey: "web_search",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        domainFilters: { type: "array", items: { type: "string" } },
        resultLimit: { type: "number" },
      },
      required: ["query"],
    },
    outputSchema: null,
    tags: ["web", "search", "research"],
    capabilities: ["web_search", "serp_research"],
    approvalPolicy: "none",
    requiresConnection: false,
    enabledByDefault: true,
    metadata: {
      envKeys: ["WEB_SEARCH_PROVIDER", "TAVILY_API_KEY"],
    },
  },
  {
    slug: "artifact_store",
    toolkitSlug: "artifact_store",
    source: "internal_builtin",
    title: "Artifact Store",
    description: "Persist project-scoped artifacts and summaries for later reuse.",
    executionMode: "write",
    riskLevel: "medium",
    executorKey: "artifact_store",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string" },
        assetType: { type: "string" },
        content: { type: "string" },
        metadata: { type: "object" },
        writeMemorySummary: { type: "boolean" },
        summary: { type: "string" },
      },
      required: ["label", "assetType", "content"],
    },
    outputSchema: null,
    tags: ["artifact", "storage", "report"],
    capabilities: ["artifact_write", "report_persistence"],
    approvalPolicy: "confirm_writes",
    requiresConnection: false,
    enabledByDefault: true,
  },
  {
    slug: "site_crawler",
    toolkitSlug: "site_crawler",
    source: "internal_builtin",
    title: "Site Crawler",
    description: "Crawl a public site within scope and summarize discovered pages and metadata.",
    executionMode: "read",
    riskLevel: "low",
    executorKey: "site_crawler",
    inputSchema: {
      type: "object",
      properties: {
        rootUrl: { type: "string" },
        pageLimit: { type: "number" },
        depthLimit: { type: "number" },
        stayWithinPath: { type: "boolean" },
      },
      required: ["rootUrl"],
    },
    outputSchema: null,
    tags: ["crawl", "web", "seo", "site"],
    capabilities: ["site_crawl", "content_inventory"],
    approvalPolicy: "none",
    requiresConnection: false,
    enabledByDefault: true,
  },
  {
    slug: "document_search",
    toolkitSlug: "document_search",
    source: "internal_builtin",
    title: "Document Search",
    description: "Search project assets and stored memory using keyword-first retrieval.",
    executionMode: "read",
    riskLevel: "low",
    executorKey: "document_search",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        resultLimit: { type: "number" },
        includeMemory: { type: "boolean" },
      },
      required: ["query"],
    },
    outputSchema: null,
    tags: ["docs", "search", "assets", "knowledge"],
    capabilities: ["document_search", "knowledge_retrieval"],
    approvalPolicy: "none",
    requiresConnection: false,
    enabledByDefault: true,
  },
];

function toInternalToolDefinition(seed: InternalToolSeed): InternalToolDefinition {
  const now = new Date(0).toISOString();
  return {
    id: seed.slug,
    slug: seed.slug,
    toolkitSlug: seed.toolkitSlug,
    source: seed.source,
    title: seed.title,
    description: seed.description,
    executionMode: seed.executionMode,
    riskLevel: seed.riskLevel,
    executorKey: seed.executorKey,
    inputSchema: seed.inputSchema,
    outputSchema: seed.outputSchema,
    tags: seed.tags,
    capabilities: seed.capabilities,
    approvalPolicy: seed.approvalPolicy,
    requiresConnection: seed.requiresConnection,
    enabledByDefault: seed.enabledByDefault,
    metadata: seed.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

export const INTERNAL_TOOL_DEFINITION_SEEDS = builtinSeeds;

export const INTERNAL_BUILTIN_DEFINITIONS = builtinSeeds.map(toInternalToolDefinition);

export function getFallbackInternalToolDefinitions() {
  return INTERNAL_BUILTIN_DEFINITIONS;
}

export function getInternalDefinitionBySlug(slug: string) {
  return INTERNAL_BUILTIN_DEFINITIONS.find((definition) => definition.slug === slug) ?? null;
}

export function isInternalToolkitSlug(toolkitSlug: string) {
  return INTERNAL_BUILTIN_DEFINITIONS.some((definition) => definition.toolkitSlug === toolkitSlug);
}

export function isInternalDefinitionEnabled(params: {
  definition: InternalToolDefinition;
  enablement?: boolean | undefined;
}) {
  return params.enablement ?? params.definition.enabledByDefault;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      )
    : {};
}

export function getInternalToolScope(definition: InternalToolDefinition): InternalToolScope {
  return {
    companyKey: readString(definition.metadata.companyKey),
    projectIds: readStringArray(definition.metadata.projectIds),
  };
}

export function isInternalDefinitionVisible(params: {
  definition: InternalToolDefinition;
  companyKey?: string | null;
  projectId?: string | null;
}) {
  if (params.definition.source === "internal_builtin") {
    return true;
  }

  const scope = getInternalToolScope(params.definition);
  if (scope.companyKey && scope.companyKey !== (params.companyKey ?? null)) {
    return false;
  }

  if (scope.projectIds.length > 0) {
    if (!params.projectId) {
      return false;
    }

    return scope.projectIds.includes(params.projectId);
  }

  return true;
}

export function getInternalExecutorConfig(
  definition: InternalToolDefinition,
): InternalToolExecutorConfig {
  if (definition.source === "internal_builtin") {
    return {
      handlerType: "builtin",
    };
  }

  const endpointUrl = readString(definition.metadata.endpointUrl);
  if (!endpointUrl) {
    return {
      handlerType: "builtin",
    };
  }

  const method = readString(definition.metadata.method)?.toUpperCase();
  const config: InternalToolHttpConfig = {
    handlerType: "http_request",
    endpointUrl,
    method: method === "GET" ? "GET" : "POST",
    headers: readRecord(definition.metadata.headers),
    includeContext: definition.metadata.includeContext !== false,
    timeoutMs:
      typeof definition.metadata.timeoutMs === "number" &&
      Number.isFinite(definition.metadata.timeoutMs) &&
      definition.metadata.timeoutMs > 0
        ? Math.min(Math.round(definition.metadata.timeoutMs), 30_000)
        : 10_000,
  };

  return config;
}

export function toInternalCatalogRecord(params: {
  definition: InternalToolDefinition;
  projectEnabled?: boolean | undefined;
}): InternalToolCatalogRecord {
  return {
    ...params.definition,
    projectEnabled: params.projectEnabled ?? params.definition.enabledByDefault,
  };
}

export function toResolvedInternalToolCandidate(
  definition: InternalToolDefinition,
): ResolvedToolCandidate {
  return {
    id: `${definition.toolkitSlug}:${definition.slug}`,
    toolSlug: definition.slug,
    toolkitSlug: definition.toolkitSlug,
    source: definition.source,
    executorKey: definition.executorKey,
    config: definition.metadata,
    sessionId: null,
    requiresConnection: definition.requiresConnection,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    executionMode: definition.executionMode,
    riskLevel: definition.riskLevel,
    supportsChat: definition.slug !== "artifact_store",
    supportsRunTasks: true,
    executionGuidance: null,
    capabilities: definition.capabilities,
    tags: definition.tags,
    approvalPolicy: definition.approvalPolicy,
  };
}
