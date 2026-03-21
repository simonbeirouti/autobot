import { describe, expect, it } from "vitest";

import { buildToolPreflightFromReadiness } from "@/lib/tools/preflight";

describe("buildToolPreflightFromReadiness", () => {
  it("does not recommend connecting tools for internal-only readiness gaps", () => {
    const preflight = buildToolPreflightFromReadiness({
      tasks: [
        {
          title: "Research the website",
          toolRequirement: "required",
          executionStrategy: "tool_execution",
          toolSummary: "Use the internal site crawler.",
          requiredToolkitSlugs: ["site_crawler"],
          optionalToolkitSlugs: [],
        },
      ],
      readiness: [
        {
          toolkitSlug: "site_crawler",
          status: "not_connected",
          message: "site_crawler is not connected yet.",
        },
      ],
      nextPath: "/dashboard/projects/project-1",
      internalDefinitions: [
        {
          toolkitSlug: "site_crawler",
          title: "Site Crawler",
          description: "Crawl a public site.",
        },
      ],
    });

    expect(preflight.launchState).toBe("ready");
    expect(preflight.blockingToolkitSlugs).toEqual([]);
    expect(preflight.recommendedAction).toBeNull();
  });

  it("does not block launch for optional toolkit suggestions", () => {
    const preflight = buildToolPreflightFromReadiness({
      tasks: [
        {
          title: "Draft a competitor comparison",
          toolRequirement: "optional",
          executionStrategy: "tool_execution",
          toolSummary: "Use web_search if available, but continue without it if needed.",
          requiredToolkitSlugs: [],
          optionalToolkitSlugs: ["web_search"],
        },
      ],
      readiness: [
        {
          toolkitSlug: "web_search",
          status: "not_connected",
          message: "web_search is not connected yet.",
        },
      ],
      nextPath: "/dashboard/projects/project-1",
      internalDefinitions: [
        {
          toolkitSlug: "web_search",
          title: "Web Search",
          description: "Search the public web.",
        },
      ],
    });

    expect(preflight.requiredToolkitSlugs).toEqual([]);
    expect(preflight.launchState).toBe("ready");
    expect(preflight.blockingToolkitSlugs).toEqual([]);
  });
});
