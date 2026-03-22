import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tools/repository", () => ({
  fetchInternalToolDefinitionsWithFallback: vi.fn(),
  fetchProjectInternalToolEnablements: vi.fn(),
  fetchProjectToolkitSelections: vi.fn(),
  fetchProviderConnections: vi.fn(),
}));

vi.mock("@/lib/projects/repository", () => ({
  fetchProject: vi.fn(),
}));

import {
  fetchInternalToolDefinitionsWithFallback,
  fetchProjectInternalToolEnablements,
  fetchProjectToolkitSelections,
  fetchProviderConnections,
} from "@/lib/tools/repository";
import { fetchProject } from "@/lib/projects/repository";
import { resolveProjectTools } from "@/lib/tools/resolver";

const mockedFetchInternalToolDefinitionsWithFallback = vi.mocked(fetchInternalToolDefinitionsWithFallback);
const mockedFetchProjectInternalToolEnablements = vi.mocked(fetchProjectInternalToolEnablements);
const mockedFetchProjectToolkitSelections = vi.mocked(fetchProjectToolkitSelections);
const mockedFetchProviderConnections = vi.mocked(fetchProviderConnections);
const mockedFetchProject = vi.mocked(fetchProject);

describe("resolveProjectTools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFetchProject.mockResolvedValue({
      id: "project-1",
      companyKey: "company:acme.com",
    } as never);
    mockedFetchProjectToolkitSelections.mockResolvedValue([
      {
        id: "selection-1",
        projectId: "project-1",
        userId: "user-1",
        toolkitSlug: "slack",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
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
  });

  it("includes enabled internal built-ins in selected and active toolkits", async () => {
    mockedFetchInternalToolDefinitionsWithFallback.mockResolvedValue([
      {
        id: "web-search",
        slug: "web_search",
        toolkitSlug: "web_search",
        source: "internal_builtin",
        title: "Web Search",
        description: "Search the public web.",
        executionMode: "read",
        riskLevel: "low",
        executorKey: "web_search",
        inputSchema: null,
        outputSchema: null,
        tags: [],
        capabilities: [],
        approvalPolicy: "none",
        requiresConnection: false,
        enabledByDefault: true,
        metadata: {},
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
    mockedFetchProjectInternalToolEnablements.mockResolvedValue([]);

    const result = await resolveProjectTools({} as never, {
      projectId: "project-1",
      userId: "user-1",
    });

    expect(result.selectedToolkitSlugs).toEqual(["slack", "web_search"]);
    expect(result.activeToolkitSlugs).toEqual(["slack", "web_search"]);
    expect(result.inactiveToolkitSlugs).toEqual([]);
  });

  it("excludes disabled internal built-ins from selected and active toolkits", async () => {
    mockedFetchInternalToolDefinitionsWithFallback.mockResolvedValue([
      {
        id: "web-search",
        slug: "web_search",
        toolkitSlug: "web_search",
        source: "internal_builtin",
        title: "Web Search",
        description: "Search the public web.",
        executionMode: "read",
        riskLevel: "low",
        executorKey: "web_search",
        inputSchema: null,
        outputSchema: null,
        tags: [],
        capabilities: [],
        approvalPolicy: "none",
        requiresConnection: false,
        enabledByDefault: true,
        metadata: {},
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
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

    const result = await resolveProjectTools({} as never, {
      projectId: "project-1",
      userId: "user-1",
    });

    expect(result.selectedToolkitSlugs).toEqual(["slack"]);
    expect(result.activeToolkitSlugs).toEqual(["slack"]);
    expect(result.inactiveToolkitSlugs).toEqual([]);
  });

  it("includes company-scoped internal custom tools when they match the project company", async () => {
    mockedFetchInternalToolDefinitionsWithFallback.mockResolvedValue([
      {
        id: "company-tool",
        slug: "company_status_lookup",
        toolkitSlug: "company_status_lookup",
        source: "internal_custom",
        title: "Company Status Lookup",
        description: "Fetch company status.",
        executionMode: "read",
        riskLevel: "low",
        executorKey: "internal_custom_http",
        inputSchema: null,
        outputSchema: null,
        tags: [],
        capabilities: [],
        approvalPolicy: "none",
        requiresConnection: false,
        enabledByDefault: true,
        metadata: {
          companyKey: "company:acme.com",
          endpointUrl: "https://example.com/tool",
        },
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
    mockedFetchProjectInternalToolEnablements.mockResolvedValue([]);

    const result = await resolveProjectTools({} as never, {
      projectId: "project-1",
      userId: "user-1",
    });

    expect(result.selectedToolkitSlugs).toContain("company_status_lookup");
    expect(result.activeToolkitSlugs).toContain("company_status_lookup");
  });
});
