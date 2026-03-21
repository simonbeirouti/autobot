import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/tools/repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tools/repository")>(
    "@/lib/tools/repository",
  );

  return {
    ...actual,
    fetchInternalToolDefinitionsWithFallback: vi.fn(),
    fetchInternalToolDefinitionBySlug: vi.fn(),
    fetchProjectInternalToolEnablements: vi.fn(),
    upsertInternalToolDefinition: vi.fn(),
    upsertProjectInternalToolEnablement: vi.fn(),
  };
});

vi.mock("@/lib/tools/runtime", () => ({
  executeResolvedTool: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/projects/repository", () => ({
  fetchObjective: vi.fn(),
  fetchProject: vi.fn(),
}));

import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  fetchInternalToolDefinitionBySlug,
  fetchInternalToolDefinitionsWithFallback,
  fetchProjectInternalToolEnablements,
  upsertInternalToolDefinition,
  upsertProjectInternalToolEnablement,
} from "@/lib/tools/repository";
import { executeResolvedTool } from "@/lib/tools/runtime";
import { fetchObjective, fetchProject } from "@/lib/projects/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET as getInternalCatalog } from "@/app/api/tools/internal/route";
import {
  GET as getInternalTool,
  PATCH as patchInternalTool,
} from "@/app/api/tools/internal/[toolSlug]/route";
import { POST as invokeInternalTool } from "@/app/api/tools/internal/[toolSlug]/invoke/route";
import {
  GET as getManageInternalTools,
  POST as postManageInternalTools,
} from "@/app/api/tools/internal/manage/route";

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedCreateClient = vi.mocked(createClient);
const mockedFetchInternalToolDefinitionBySlug = vi.mocked(fetchInternalToolDefinitionBySlug);
const mockedFetchInternalToolDefinitionsWithFallback = vi.mocked(fetchInternalToolDefinitionsWithFallback);
const mockedFetchProjectInternalToolEnablements = vi.mocked(fetchProjectInternalToolEnablements);
const mockedUpsertInternalToolDefinition = vi.mocked(upsertInternalToolDefinition);
const mockedUpsertProjectInternalToolEnablement = vi.mocked(upsertProjectInternalToolEnablement);
const mockedExecuteResolvedTool = vi.mocked(executeResolvedTool);
const mockedFetchObjective = vi.mocked(fetchObjective);
const mockedFetchProject = vi.mocked(fetchProject);
const mockedCreateAdminClient = vi.mocked(createAdminClient);

const definition = {
  id: "web-search",
  slug: "web_search",
  toolkitSlug: "web_search",
  source: "internal_builtin" as const,
  title: "Web Search",
  description: "Search the web.",
  executionMode: "read" as const,
  riskLevel: "low" as const,
  executorKey: "web_search",
  inputSchema: null,
  outputSchema: null,
  tags: ["web"],
  capabilities: ["web_search"],
  approvalPolicy: "none" as const,
  requiresConnection: false,
  enabledByDefault: true,
  metadata: {},
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const projectId = "11111111-1111-4111-8111-111111111111";
const objectiveId = "22222222-2222-4222-8222-222222222222";

describe("internal tool routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetCurrentUser.mockResolvedValue({ sub: "user-1", email: "dev@acme.com" } as never);
    mockedCreateClient.mockResolvedValue({} as never);
    mockedCreateAdminClient.mockReturnValue({} as never);
  });

  it("returns the internal catalog from fallback-backed definitions", async () => {
    mockedFetchInternalToolDefinitionsWithFallback.mockResolvedValue([definition]);
    mockedFetchProjectInternalToolEnablements.mockResolvedValue([]);
    mockedFetchProject.mockResolvedValue({ id: projectId, companyKey: "company:acme.com" } as never);

    const response = await getInternalCatalog(
      new Request(`http://localhost/api/tools/internal?projectId=${projectId}`),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.toolCount).toBe(1);
    expect(payload.tools[0]).toEqual(expect.objectContaining({ slug: "web_search", projectEnabled: true }));
  });

  it("returns 404 for an unknown internal tool slug", async () => {
    mockedFetchInternalToolDefinitionBySlug.mockResolvedValue(null);

    const response = await getInternalTool(new Request("http://localhost/api/tools/internal/nope"), {
      params: Promise.resolve({ toolSlug: "nope" }),
    });

    expect(response.status).toBe(404);
  });

  it("persists project enablement changes and returns the updated tool", async () => {
    mockedFetchProject.mockResolvedValue({ id: projectId, companyKey: "company:acme.com" } as never);
    mockedFetchInternalToolDefinitionBySlug.mockResolvedValue(definition);
    mockedUpsertProjectInternalToolEnablement.mockResolvedValue({
      id: "enablement-1",
      projectId,
      userId: "user-1",
      toolSlug: "web_search",
      isEnabled: false,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    const response = await patchInternalTool(
      new Request("http://localhost/api/tools/internal/web_search", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          isEnabled: false,
        }),
      }),
      {
        params: Promise.resolve({ toolSlug: "web_search" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedUpsertProjectInternalToolEnablement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        projectId,
        userId: "user-1",
        toolSlug: "web_search",
        isEnabled: false,
      }),
    );
    expect(payload.tool.projectEnabled).toBe(false);
  });

  it("invokes the internal tool only after access checks and preserves confirmation behavior", async () => {
    mockedFetchInternalToolDefinitionBySlug.mockResolvedValue({
      ...definition,
      slug: "artifact_store",
      toolkitSlug: "artifact_store",
      title: "Artifact Store",
      executionMode: "write",
      riskLevel: "medium",
      executorKey: "artifact_store",
      approvalPolicy: "confirm_writes",
    });
    mockedFetchProject.mockResolvedValue({ id: projectId, companyKey: "company:acme.com" } as never);
    mockedFetchObjective.mockResolvedValue({ id: objectiveId } as never);
    mockedExecuteResolvedTool.mockResolvedValue({
      status: "confirmation_required",
      toolSlug: "artifact_store",
      toolkitSlug: "artifact_store",
      message: "Confirmation is required before write actions can run.",
      data: null,
      logId: null,
    });

    const response = await invokeInternalTool(
      new Request("http://localhost/api/tools/internal/artifact_store/invoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          objectiveId,
          input: {
            label: "Test",
            assetType: "note",
            content: "hello",
          },
          confirmedWriteActions: false,
        }),
      }),
      {
        params: Promise.resolve({ toolSlug: "artifact_store" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedFetchProject).toHaveBeenCalled();
    expect(mockedFetchObjective).toHaveBeenCalled();
    expect(mockedExecuteResolvedTool).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          confirmedWriteActions: false,
          projectId,
          objectiveId,
        }),
      }),
    );
    expect(payload.status).toBe("confirmation_required");
  });

  it("rejects admin management requests without the admin key", async () => {
    process.env.AUTOBOT_INTERNAL_ADMIN_KEY = "test-admin-key";

    const response = await getManageInternalTools(
      new Request("http://localhost/api/tools/internal/manage"),
    );

    expect(response.status).toBe(403);
  });

  it("creates a company-scoped internal custom tool via the admin route", async () => {
    process.env.AUTOBOT_INTERNAL_ADMIN_KEY = "test-admin-key";
    mockedUpsertInternalToolDefinition.mockResolvedValue({
      ...definition,
      slug: "company_status_lookup",
      toolkitSlug: "company_status_lookup",
      source: "internal_custom",
      title: "Company Status Lookup",
      executorKey: "internal_custom_http",
      metadata: {
        companyKey: "company:acme.com",
        endpointUrl: "https://example.com/tool",
      },
    });

    const response = await postManageInternalTools(
      new Request("http://localhost/api/tools/internal/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-autobot-admin-key": "test-admin-key",
        },
        body: JSON.stringify({
          slug: "company_status_lookup",
          title: "Company Status Lookup",
          description: "Fetch company status.",
          companyKey: "company:acme.com",
          endpointUrl: "https://example.com/tool",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedUpsertInternalToolDefinition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        slug: "company_status_lookup",
        source: "internal_custom",
        executorKey: "internal_custom_http",
      }),
    );
    expect(payload.tool.slug).toBe("company_status_lookup");
  });
});
