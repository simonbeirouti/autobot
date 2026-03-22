import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedToolCandidate } from "@/lib/tools/types";

vi.mock("@/lib/tools/resolver", () => ({
  resolveProjectTools: vi.fn(),
}));

vi.mock("@/lib/tools/repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tools/repository")>(
    "@/lib/tools/repository",
  );

  return {
    ...actual,
    fetchProviderConnections: vi.fn(),
    fetchInternalToolDefinitionsWithFallback: vi.fn(),
    fetchProjectInternalToolEnablements: vi.fn(),
    insertToolInvocation: vi.fn(),
  };
});

vi.mock("@/lib/tools/composio", () => ({
  getComposioSession: vi.fn(),
}));

vi.mock("@/lib/projects/repository", () => ({
  createProjectAsset: vi.fn(),
  fetchProjectAssets: vi.fn(),
  fetchObjective: vi.fn(),
  fetchProject: vi.fn(),
}));

vi.mock("@/lib/memory/repository", () => ({
  fetchLongTermMemoryByProject: vi.fn(),
  writeLongTermMemory: vi.fn(),
}));

vi.mock("@/lib/projects/context", () => ({
  resolveCompanyKey: vi.fn(() => "company-1"),
}));

import { getComposioSession } from "@/lib/tools/composio";
import {
  fetchInternalToolDefinitionsWithFallback,
  fetchProjectInternalToolEnablements,
  fetchProviderConnections,
  insertToolInvocation,
} from "@/lib/tools/repository";
import { resolveProjectTools } from "@/lib/tools/resolver";
import { createProjectAsset, fetchProject, fetchProjectAssets } from "@/lib/projects/repository";
import { fetchLongTermMemoryByProject } from "@/lib/memory/repository";
import { executeResolvedTool, resolveProjectToolRuntime } from "@/lib/tools/runtime";

const mockedGetComposioSession = vi.mocked(getComposioSession);
const mockedFetchInternalToolDefinitionsWithFallback = vi.mocked(fetchInternalToolDefinitionsWithFallback);
const mockedFetchProjectInternalToolEnablements = vi.mocked(fetchProjectInternalToolEnablements);
const mockedFetchProviderConnections = vi.mocked(fetchProviderConnections);
const mockedInsertToolInvocation = vi.mocked(insertToolInvocation);
const mockedResolveProjectTools = vi.mocked(resolveProjectTools);
const mockedCreateProjectAsset = vi.mocked(createProjectAsset);
const mockedFetchProject = vi.mocked(fetchProject);
const mockedFetchProjectAssets = vi.mocked(fetchProjectAssets);
const mockedFetchLongTermMemoryByProject = vi.mocked(fetchLongTermMemoryByProject);

const baseInternalDefinition = {
  id: "web-search",
  slug: "web_search",
  toolkitSlug: "web_search",
  source: "internal_builtin" as const,
  title: "Web Search",
  description: "Search the public web.",
  executionMode: "read" as const,
  riskLevel: "low" as const,
  executorKey: "web_search",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
    },
  },
  outputSchema: null,
  tags: ["web", "search"],
  capabilities: ["web_search"],
  approvalPolicy: "none" as const,
  requiresConnection: false,
  enabledByDefault: true,
  metadata: {},
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function makeCandidate(overrides: Partial<ResolvedToolCandidate> = {}): ResolvedToolCandidate {
  return {
    id: "tool:web_search",
    toolSlug: "web_search",
    toolkitSlug: "web_search",
    source: "internal_builtin",
    executorKey: "web_search",
    config: {},
    sessionId: null,
    requiresConnection: false,
    title: "Web Search",
    description: "Search the public web.",
    inputSchema: baseInternalDefinition.inputSchema,
    outputSchema: null,
    executionMode: "read",
    riskLevel: "low",
    supportsChat: true,
    supportsRunTasks: true,
    executionGuidance: null,
    capabilities: ["web_search"],
    tags: ["web", "search"],
    approvalPolicy: "none",
    ...overrides,
  };
}

describe("resolveProjectToolRuntime", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.TAVILY_API_KEY = "test-key";
    mockedResolveProjectTools.mockResolvedValue({
      selectedToolkitSlugs: ["slack", "web_search"],
      activeToolkitSlugs: ["slack", "web_search"],
      inactiveToolkitSlugs: [],
      markdown: "Project tool context",
    });
    mockedFetchProject.mockResolvedValue({
      id: "project-1",
      companyKey: "company:acme.com",
    } as never);
    mockedFetchProviderConnections.mockResolvedValue([
      {
        id: "connection-1",
        userId: "user-1",
        toolkitSlug: "slack",
        composioSessionId: "session-1",
        connectedAccountId: "acct-1",
        authScheme: "oauth",
        apiKeyLastFour: null,
        apiKeyUpdatedAt: null,
        status: "active",
        redirectUrl: null,
        callbackUrl: null,
        lastSyncedAt: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
    mockedFetchProjectInternalToolEnablements.mockResolvedValue([]);
    mockedGetComposioSession.mockResolvedValue({
      search: vi.fn().mockResolvedValue({
        results: [
          {
            primaryToolSlugs: ["send_message"],
            relatedToolSlugs: [],
            executionGuidance: "Use when you need Slack output.",
          },
        ],
        toolSchemas: {
          send_message: {
            description: "Send a Slack message.",
            inputSchema: null,
            outputSchema: null,
          },
        },
      }),
      execute: vi.fn(),
    } as never);
  });

  it("returns internal candidates when enabled and ranks them before Composio matches", async () => {
    mockedFetchInternalToolDefinitionsWithFallback.mockResolvedValue([baseInternalDefinition]);

    const runtime = await resolveProjectToolRuntime({} as never, {
      projectId: "project-1",
      userId: "user-1",
      query: "search the web and send the result",
    });

    expect(runtime.toolCandidates.map((candidate) => candidate.toolSlug)).toEqual([
      "web_search",
      "send_message",
    ]);
    expect(runtime.missingPrerequisites).toEqual([]);
  });

  it("omits disabled internal candidates for the project", async () => {
    mockedFetchInternalToolDefinitionsWithFallback.mockResolvedValue([baseInternalDefinition]);
    mockedFetchProjectInternalToolEnablements.mockResolvedValue([
      {
        id: "enablement-1",
        projectId: "project-1",
        userId: "user-1",
        toolSlug: "web_search",
        isEnabled: false,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ]);

    const runtime = await resolveProjectToolRuntime({} as never, {
      projectId: "project-1",
      userId: "user-1",
      query: "search the web and send the result",
    });

    expect(runtime.toolCandidates.map((candidate) => candidate.toolSlug)).toEqual(["send_message"]);
  });

  it("includes visible internal custom candidates for the project company", async () => {
    mockedFetchInternalToolDefinitionsWithFallback.mockResolvedValue([
      baseInternalDefinition,
      {
        ...baseInternalDefinition,
        id: "company-status",
        slug: "company_status_lookup",
        toolkitSlug: "company_status_lookup",
        source: "internal_custom",
        title: "Company Status Lookup",
        description: "Fetch company status.",
        executorKey: "internal_custom_http",
        metadata: {
          companyKey: "company:acme.com",
          endpointUrl: "https://example.com/tool",
        },
      },
    ]);

    const runtime = await resolveProjectToolRuntime({} as never, {
      projectId: "project-1",
      userId: "user-1",
      query: "company status lookup",
    });

    expect(runtime.toolCandidates.map((candidate) => candidate.toolSlug)).toContain(
      "company_status_lookup",
    );
  });

  it("returns no candidates for an empty query while preserving readiness context", async () => {
    mockedFetchInternalToolDefinitionsWithFallback.mockResolvedValue([baseInternalDefinition]);

    const runtime = await resolveProjectToolRuntime({} as never, {
      projectId: "project-1",
      userId: "user-1",
      query: "   ",
    });

    expect(runtime.toolCandidates).toEqual([]);
    expect(runtime.activeToolkitSlugs).toEqual(["slack", "web_search"]);
    expect(runtime.missingPrerequisites).toEqual([]);
  });
});

describe("executeResolvedTool", () => {
  const originalApiKey = process.env.TAVILY_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.TAVILY_API_KEY;
    mockedFetchProjectAssets.mockResolvedValue([]);
    mockedFetchLongTermMemoryByProject.mockResolvedValue([]);
  });

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.TAVILY_API_KEY;
      return;
    }

    process.env.TAVILY_API_KEY = originalApiKey;
  });

  it("logs a succeeded read-only internal tool invocation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: "https://example.com",
        headers: {
          get: vi.fn().mockReturnValue("text/html"),
        },
        text: vi.fn().mockResolvedValue(
          "<html><head><title>Example</title></head><body><h1>Hello</h1><p>World</p></body></html>",
        ),
      }),
    );

    const result = await executeResolvedTool({
      supabase: {} as never,
      context: {
        userId: "user-1",
        projectId: "project-1",
        objectiveId: null,
        threadId: "thread-1",
        runId: "run-1",
        allowedToolkitSlugs: ["page_extractor"],
        confirmedWriteActions: false,
      },
      candidate: makeCandidate({
        id: "tool:page_extractor",
        toolSlug: "page_extractor",
        toolkitSlug: "page_extractor",
        title: "Page Extractor",
        description: "Fetch a page.",
        executorKey: "page_extractor",
        tags: ["web"],
        capabilities: ["page_extract"],
      }),
      input: {
        url: "https://example.com",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(mockedInsertToolInvocation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: "succeeded",
        toolkitSlug: "page_extractor",
        toolSlug: "page_extractor",
        metadata: expect.objectContaining({
          source: "internal_builtin",
          executorKey: "page_extractor",
          executionMode: "read",
          riskLevel: "low",
        }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("returns confirmation_required for artifact_store without write confirmation", async () => {
    const result = await executeResolvedTool({
      supabase: {} as never,
      context: {
        userId: "user-1",
        projectId: "project-1",
        objectiveId: null,
        threadId: "thread-1",
        runId: "run-1",
        allowedToolkitSlugs: ["artifact_store"],
        confirmedWriteActions: false,
      },
      candidate: makeCandidate({
        id: "tool:artifact_store",
        toolSlug: "artifact_store",
        toolkitSlug: "artifact_store",
        title: "Artifact Store",
        description: "Persist a project artifact.",
        executorKey: "artifact_store",
        executionMode: "write",
        riskLevel: "medium",
        approvalPolicy: "confirm_writes",
      }),
      input: {
        label: "Test",
        assetType: "note",
        content: "Hello world",
      },
    });

    expect(result.status).toBe("confirmation_required");
    expect(mockedInsertToolInvocation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: "confirmation_required",
        toolSlug: "artifact_store",
      }),
    );
  });

  it("stores an artifact successfully after write confirmation", async () => {
    mockedCreateProjectAsset.mockResolvedValue({
      id: "asset-1",
      projectId: "project-1",
      userId: "user-1",
      label: "Test",
      assetType: "note",
      storagePath: null,
      metadata: {
        content: "Hello world",
        source: "internal_builtin",
        toolSlug: "artifact_store",
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    const result = await executeResolvedTool({
      supabase: {} as never,
      context: {
        userId: "user-1",
        projectId: "project-1",
        objectiveId: null,
        threadId: "thread-1",
        runId: "run-1",
        allowedToolkitSlugs: ["artifact_store"],
        confirmedWriteActions: true,
      },
      candidate: makeCandidate({
        id: "tool:artifact_store",
        toolSlug: "artifact_store",
        toolkitSlug: "artifact_store",
        title: "Artifact Store",
        description: "Persist a project artifact.",
        executorKey: "artifact_store",
        executionMode: "write",
        riskLevel: "medium",
        approvalPolicy: "confirm_writes",
      }),
      input: {
        label: "Test",
        assetType: "note",
        content: "Hello world",
        metadata: {},
        writeMemorySummary: false,
        summary: "",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(mockedCreateProjectAsset).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        projectId: "project-1",
        userId: "user-1",
        label: "Test",
      }),
    );
  });

  it("fails clearly when document_search or site_crawler are missing a project context", async () => {
    const [documentSearchResult, siteCrawlerResult] = await Promise.all([
      executeResolvedTool({
        supabase: {} as never,
        context: {
          userId: "user-1",
          projectId: null,
          objectiveId: null,
          threadId: null,
          runId: null,
          allowedToolkitSlugs: ["document_search"],
          confirmedWriteActions: false,
        },
        candidate: makeCandidate({
          id: "tool:document_search",
          toolSlug: "document_search",
          toolkitSlug: "document_search",
          title: "Document Search",
          description: "Search project documents.",
          executorKey: "document_search",
        }),
        input: {
          query: "brief",
        },
      }),
      executeResolvedTool({
        supabase: {} as never,
        context: {
          userId: "user-1",
          projectId: null,
          objectiveId: null,
          threadId: null,
          runId: null,
          allowedToolkitSlugs: ["site_crawler"],
          confirmedWriteActions: false,
        },
        candidate: makeCandidate({
          id: "tool:site_crawler",
          toolSlug: "site_crawler",
          toolkitSlug: "site_crawler",
          title: "Site Crawler",
          description: "Crawl a site.",
          executorKey: "site_crawler",
        }),
        input: {
          rootUrl: "https://example.com",
        },
      }),
    ]);

    expect(documentSearchResult.status).toBe("failed");
    expect(documentSearchResult.message).toContain("document_search requires a project context");
    expect(siteCrawlerResult.status).toBe("failed");
    expect(siteCrawlerResult.message).toContain("site_crawler requires a project context");
  });

  it("fails clearly when web_search has no configured provider", async () => {
    const result = await executeResolvedTool({
      supabase: {} as never,
      context: {
        userId: "user-1",
        projectId: "project-1",
        objectiveId: null,
        threadId: null,
        runId: null,
        allowedToolkitSlugs: ["web_search"],
        confirmedWriteActions: false,
      },
      candidate: makeCandidate(),
      input: {
        query: "market research",
      },
    });

    expect(result.status).toBe("failed");
    expect(result.message).toContain("No internal web search provider is configured");
  });

  it("audits robots.txt and sitemaps successfully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith("/robots.txt")) {
          return {
            ok: true,
            status: 200,
            url,
            headers: { get: vi.fn().mockReturnValue("text/plain") },
            text: vi
              .fn()
              .mockResolvedValue("User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml"),
          };
        }

        return {
          ok: true,
          status: 200,
          url,
          headers: { get: vi.fn().mockReturnValue("application/xml") },
          text: vi
            .fn()
            .mockResolvedValue(
              "<?xml version=\"1.0\"?><urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/pricing</loc></url></urlset>",
            ),
        };
      }),
    );

    const result = await executeResolvedTool({
      supabase: {} as never,
      context: {
        userId: "user-1",
        projectId: null,
        objectiveId: null,
        threadId: null,
        runId: null,
        allowedToolkitSlugs: ["sitemap_robots_audit"],
        confirmedWriteActions: false,
      },
      candidate: makeCandidate({
        id: "tool:sitemap_robots_audit",
        toolSlug: "sitemap_robots_audit",
        toolkitSlug: "sitemap_robots_audit",
        title: "Sitemap And Robots Audit",
        description: "Audit robots and sitemaps.",
        executorKey: "sitemap_robots_audit",
      }),
      input: {
        siteUrl: "https://example.com",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.data?.coverageSummary).toEqual(
      expect.objectContaining({
        uniquePageUrlCount: 2,
        blockedPathCount: 1,
      }),
    );
    vi.unstubAllGlobals();
  });

  it("supports inline table queries without project assets", async () => {
    const result = await executeResolvedTool({
      supabase: {} as never,
      context: {
        userId: "user-1",
        projectId: null,
        objectiveId: null,
        threadId: null,
        runId: null,
        allowedToolkitSlugs: ["table_query"],
        confirmedWriteActions: false,
      },
      candidate: makeCandidate({
        id: "tool:table_query",
        toolSlug: "table_query",
        toolkitSlug: "table_query",
        title: "Table Query",
        description: "Analyze structured data.",
        executorKey: "table_query",
      }),
      input: {
        csvContent: "company,visits\nAcme,5\nBeta,2\nAcme,7",
        operation: "group_count",
        groupBy: "company",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.data?.result).toEqual(
      expect.objectContaining({
        groupBy: "company",
        groups: expect.arrayContaining([
          expect.objectContaining({ group: "Acme", count: 2 }),
          expect.objectContaining({ group: "Beta", count: 1 }),
        ]),
      }),
    );
  });

  it("writes a report artifact successfully after confirmation", async () => {
    mockedCreateProjectAsset.mockResolvedValue({
      id: "asset-report-1",
      projectId: "project-1",
      userId: "user-1",
      label: "Q1 Competitor Report",
      assetType: "analysis_report",
      storagePath: null,
      metadata: {},
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    const result = await executeResolvedTool({
      supabase: {} as never,
      context: {
        userId: "user-1",
        projectId: "project-1",
        objectiveId: null,
        threadId: null,
        runId: null,
        allowedToolkitSlugs: ["report_writer"],
        confirmedWriteActions: true,
      },
      candidate: makeCandidate({
        id: "tool:report_writer",
        toolSlug: "report_writer",
        toolkitSlug: "report_writer",
        title: "Report Writer",
        description: "Persist a report artifact.",
        executorKey: "report_writer",
        executionMode: "write",
        riskLevel: "medium",
        approvalPolicy: "confirm_writes",
      }),
      input: {
        title: "Q1 Competitor Report",
        reportType: "analysis_report",
        summary: "A concise summary.",
        findings: [{ title: "Pricing emphasis", detail: "Competitors foreground pricing clarity." }],
        sections: [{ heading: "Recommendation", body: "Tighten our own packaging language." }],
        writeMemorySummary: false,
      },
    });

    expect(result.status).toBe("succeeded");
    expect(mockedCreateProjectAsset).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        projectId: "project-1",
        label: "Q1 Competitor Report",
        assetType: "analysis_report",
      }),
    );
  });

  it("executes an internal custom HTTP tool and logs custom metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue("application/json"),
        },
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: "company status is green",
        }),
      }),
    );

    const result = await executeResolvedTool({
      supabase: {} as never,
      context: {
        userId: "user-1",
        projectId: "project-1",
        objectiveId: null,
        threadId: null,
        runId: null,
        allowedToolkitSlugs: ["company_status_lookup"],
        confirmedWriteActions: false,
      },
      candidate: makeCandidate({
        id: "tool:company_status_lookup",
        toolSlug: "company_status_lookup",
        toolkitSlug: "company_status_lookup",
        source: "internal_custom",
        title: "Company Status Lookup",
        description: "Fetch company status.",
        executorKey: "internal_custom_http",
        config: {
          companyKey: "company:acme.com",
          endpointUrl: "https://example.com/tool",
          method: "POST",
          headers: {
            Authorization: "Bearer test",
          },
          includeContext: true,
          timeoutMs: 5000,
        },
      }),
      input: {
        accountId: "acct_123",
      },
    });

    expect(result.status).toBe("succeeded");
    expect(mockedInsertToolInvocation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toolSlug: "company_status_lookup",
        metadata: expect.objectContaining({
          source: "internal_custom",
          approvalState: "not_required",
        }),
      }),
    );
    vi.unstubAllGlobals();
  });
});
