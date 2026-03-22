import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchProject } from "@/lib/projects/repository";
import { isInternalDefinitionEnabled, isInternalDefinitionVisible } from "@/lib/tools/internal-registry";
import {
  fetchInternalToolDefinitionsWithFallback,
  fetchProjectInternalToolEnablements,
  fetchProjectToolkitSelections,
  fetchProviderConnections,
} from "@/lib/tools/repository";

export type ResolvedProjectTools = {
  selectedToolkitSlugs: string[];
  activeToolkitSlugs: string[];
  inactiveToolkitSlugs: string[];
  markdown: string;
};

export async function resolveProjectTools(
  supabase: SupabaseClient,
  params: { projectId: string; userId: string },
): Promise<ResolvedProjectTools> {
  const [project, toolkitSelections, providerConnections, internalDefinitions, internalEnablements] =
    await Promise.all([
    fetchProject(supabase, {
      projectId: params.projectId,
      userId: params.userId,
    }),
    fetchProjectToolkitSelections(supabase, {
      projectId: params.projectId,
      userId: params.userId,
    }),
    fetchProviderConnections(supabase, { userId: params.userId }),
    fetchInternalToolDefinitionsWithFallback(supabase),
    fetchProjectInternalToolEnablements(supabase, {
      projectId: params.projectId,
      userId: params.userId,
    }).catch(() => []),
  ]);

  const selectedToolkitSlugs = toolkitSelections.map((selection) => selection.toolkitSlug);
  const activeToolkitSlugs = selectedToolkitSlugs.filter((toolkitSlug) =>
    providerConnections.some(
      (connection) => connection.toolkitSlug === toolkitSlug && connection.status === "active",
    ),
  );
  const inactiveToolkitSlugs = selectedToolkitSlugs.filter(
    (toolkitSlug) => !activeToolkitSlugs.includes(toolkitSlug),
  );

  const internalEnablementBySlug = new Map(
    internalEnablements.map((enablement) => [enablement.toolSlug, enablement.isEnabled]),
  );
  const visibleInternalToolkitSlugs = internalDefinitions
    .filter((definition) =>
      isInternalDefinitionVisible({
        definition,
        companyKey: project.companyKey,
        projectId: params.projectId,
      }),
    )
    .filter((definition) =>
      isInternalDefinitionEnabled({
        definition,
        enablement: internalEnablementBySlug.get(definition.slug),
      }),
    )
    .map((definition) => definition.toolkitSlug);
  const mergedSelectedToolkitSlugs = Array.from(
    new Set([...selectedToolkitSlugs, ...visibleInternalToolkitSlugs]),
  );
  const mergedActiveToolkitSlugs = Array.from(
    new Set([...activeToolkitSlugs, ...visibleInternalToolkitSlugs]),
  );
  const mergedInactiveToolkitSlugs = inactiveToolkitSlugs.filter(
    (toolkitSlug) => !visibleInternalToolkitSlugs.includes(toolkitSlug),
  );

  const markdown = [
    "Project tool context:",
    mergedSelectedToolkitSlugs.length > 0
      ? `Selected toolkits: ${mergedSelectedToolkitSlugs.join(", ")}`
      : "Selected toolkits: none",
    mergedActiveToolkitSlugs.length > 0
      ? `Connected and ready: ${mergedActiveToolkitSlugs.join(", ")}`
      : "Connected and ready: none",
    mergedInactiveToolkitSlugs.length > 0
      ? `Selected but not connected: ${mergedInactiveToolkitSlugs.join(", ")}`
      : "Selected but not connected: none",
    "Only suggest using tools that are listed as connected and ready.",
  ].join("\n");

  return {
    selectedToolkitSlugs: mergedSelectedToolkitSlugs,
    activeToolkitSlugs: mergedActiveToolkitSlugs,
    inactiveToolkitSlugs: mergedInactiveToolkitSlugs,
    markdown,
  };
}
