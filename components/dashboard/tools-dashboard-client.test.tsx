// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/tools",
  useRouter: () => ({
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/providers/project-provider", () => ({
  useProject: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { useProject } from "@/components/providers/project-provider";
import { ToolsDashboardClient } from "@/components/dashboard/tools-dashboard-client";

const mockedUseProject = vi.mocked(useProject);

const internalCatalogPayload = {
  generatedAt: "2025-01-01T00:00:00.000Z",
  toolCount: 2,
  tools: [
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
      inputSchema: {
        type: "object",
      },
      outputSchema: null,
      tags: ["web"],
      capabilities: ["web_search"],
      approvalPolicy: "none",
      requiresConnection: false,
      enabledByDefault: true,
      metadata: {},
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      projectEnabled: true,
    },
    {
      id: "site-crawler",
      slug: "site_crawler",
      toolkitSlug: "site_crawler",
      source: "internal_builtin",
      title: "Site Crawler",
      description: "Crawl a public site.",
      executionMode: "read",
      riskLevel: "low",
      executorKey: "site_crawler",
      inputSchema: {
        type: "object",
      },
      outputSchema: null,
      tags: ["crawler"],
      capabilities: ["site_crawl"],
      approvalPolicy: "none",
      requiresConnection: false,
      enabledByDefault: true,
      metadata: {},
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      projectEnabled: true,
    },
  ],
};

const composioCatalogPayload = {
  generatedAt: "2025-01-01T00:00:00.000Z",
  toolkitCount: 1,
  categories: [
    {
      id: "messaging",
      name: "Messaging",
      toolkitCount: 1,
    },
  ],
  toolkits: [
    {
      slug: "slack",
      name: "Slack",
      description: "Team chat",
      logoUrl: null,
      appUrl: "https://slack.com",
      toolCount: 2,
      noAuth: false,
      authSchemes: ["oauth"],
      supportsOAuth: true,
      supportsApiKey: false,
      categories: [
        {
          id: "messaging",
          name: "Messaging",
        },
      ],
      connectionStatus: "not_connected",
      connectionAuthScheme: null,
      apiKeyLastFour: null,
      apiKeyUpdatedAt: null,
    },
  ],
};

function renderClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToolsDashboardClient initialCatalog={composioCatalogPayload} />
    </QueryClientProvider>,
  );
}

function getInternalToolCard(title: string) {
  const heading = screen.getByRole("heading", { name: title });
  const card = heading.closest('[role="button"]');
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

describe("ToolsDashboardClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedUseProject.mockReturnValue({
      activeProjectDisplay: { id: "project-1", name: "Project One" },
      activeProjectId: "project-1",
      isLoading: false,
    } as never);
  });

  it("renders the tool source tabs and preserves internal search input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/tools/internal")) {
          return Promise.resolve(
            new Response(JSON.stringify(internalCatalogPayload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.includes("/api/tools")) {
          return Promise.resolve(
            new Response(JSON.stringify(composioCatalogPayload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        return Promise.reject(new Error(`Unhandled request: ${url}`));
      }),
    );

    renderClient();

    await screen.findByText("First-party internal tools");
    const internalSearch = screen.getByPlaceholderText("Search internal tools");
    fireEvent.change(internalSearch, { target: { value: "crawler" } });
    expect(screen.getByText("Site Crawler")).toBeInTheDocument();
    expect(screen.queryByText("Web Search")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Internal/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Composio/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Internal/i }));
    await screen.findByPlaceholderText("Search internal tools");
    expect((screen.getByPlaceholderText("Search internal tools") as HTMLInputElement).value).toBe(
      "crawler",
    );

    vi.unstubAllGlobals();
  });

  it("submits an internal enablement update from the detail sheet", async () => {
    let resolvePatch: (() => void) | null = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/api/tools/internal/web_search") && method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              generatedAt: "2025-01-01T00:00:00.000Z",
              tool: internalCatalogPayload.tools[0],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (url.includes("/api/tools/internal/web_search") && method === "PATCH") {
        return new Promise((resolve) => {
          resolvePatch = () =>
            resolve(
              new Response(
                JSON.stringify({
                  generatedAt: "2025-01-01T00:00:00.000Z",
                  tool: {
                    ...internalCatalogPayload.tools[0],
                    projectEnabled: false,
                  },
                }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                },
              ),
            );
        });
      }

      if (url.includes("/api/tools/internal") && method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify(internalCatalogPayload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify(composioCatalogPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    renderClient();

    await screen.findByText("Web Search");
    fireEvent.click(within(getInternalToolCard("Web Search")).getByRole("button", { name: "View" }));
    await screen.findByRole("button", { name: "Disable" });
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/tools/internal/web_search",
        expect.objectContaining({
          method: "PATCH",
        }),
      );
    });

    resolvePatch?.();

    vi.unstubAllGlobals();
  });

  it("runs an internal tool test and shows the execution output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url.includes("/api/tools/internal/web_search/invoke") && method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "succeeded",
                toolSlug: "web_search",
                toolkitSlug: "web_search",
                message: "Found 2 search results.",
                data: {
                  query: "best llm observability platforms",
                  results: [],
                },
                logId: null,
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        if (url.includes("/api/tools/internal/web_search") && method === "GET") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                generatedAt: "2025-01-01T00:00:00.000Z",
                tool: internalCatalogPayload.tools[0],
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        if (url.includes("/api/tools/internal") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify(internalCatalogPayload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.includes("/api/tools") && method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify(composioCatalogPayload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        return Promise.reject(new Error(`Unhandled request: ${method} ${url}`));
      }),
    );

    renderClient();

    await screen.findByText("Web Search");
    fireEvent.click(within(getInternalToolCard("Web Search")).getByRole("button", { name: "View" }));
    await screen.findByRole("button", { name: "Run test" });
    fireEvent.click(screen.getByRole("button", { name: "Run test" }));

    await waitFor(() => {
      const outputPanel = screen.getByText("Execution output").closest("article");
      expect(outputPanel).not.toBeNull();
      expect(
        within(outputPanel as HTMLElement).getByDisplayValue(/"message": "Found 2 search results\."/),
      ).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });
});
