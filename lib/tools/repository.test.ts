import { describe, expect, it } from "vitest";

import { getInternalDefinitionBySlug } from "@/lib/tools/internal-registry";
import { fetchInternalToolDefinitionsWithFallback } from "@/lib/tools/repository";

describe("fetchInternalToolDefinitionsWithFallback", () => {
  it("merges database definitions with builtin fallback definitions by slug", async () => {
    const dbOnlyDefinition = {
      id: "db-web-search",
      slug: "web_search",
      toolkit_slug: "web_search",
      source: "internal_builtin",
      title: "Web Search Override",
      description: "Database-backed override.",
      execution_mode: "read",
      risk_level: "low",
      executor_key: "web_search",
      input_schema: null,
      output_schema: null,
      tags: ["web"],
      capabilities: ["web_search"],
      approval_policy: "none",
      requires_connection: false,
      enabled_by_default: true,
      metadata: {},
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    };

    const supabase = {
      from: () => ({
        select: () => ({
          order: async () => ({
            data: [dbOnlyDefinition],
            error: null,
          }),
        }),
      }),
    } as never;

    const definitions = await fetchInternalToolDefinitionsWithFallback(supabase);

    expect(definitions.find((definition) => definition.slug === "web_search")?.title).toBe(
      "Web Search Override",
    );
    expect(definitions.some((definition) => definition.slug === "sitemap_robots_audit")).toBe(
      true,
    );
    expect(definitions).toHaveLength(
      new Set(
        definitions.map((definition) => definition.slug),
      ).size,
    );
    expect(getInternalDefinitionBySlug("sitemap_robots_audit")).not.toBeNull();
  });
});
