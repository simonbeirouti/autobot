import type { SupabaseClient } from "@supabase/supabase-js";

import {
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
  const [toolkitSelections, providerConnections] = await Promise.all([
    fetchProjectToolkitSelections(supabase, {
      projectId: params.projectId,
      userId: params.userId,
    }),
    fetchProviderConnections(supabase, { userId: params.userId }),
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

  const markdown = [
    "Project tool context:",
    selectedToolkitSlugs.length > 0
      ? `Selected toolkits: ${selectedToolkitSlugs.join(", ")}`
      : "Selected toolkits: none",
    activeToolkitSlugs.length > 0
      ? `Connected and ready: ${activeToolkitSlugs.join(", ")}`
      : "Connected and ready: none",
    inactiveToolkitSlugs.length > 0
      ? `Selected but not connected: ${inactiveToolkitSlugs.join(", ")}`
      : "Selected but not connected: none",
    "Only suggest using tools that are listed as connected and ready.",
  ].join("\n");

  return {
    selectedToolkitSlugs,
    activeToolkitSlugs,
    inactiveToolkitSlugs,
    markdown,
  };
}
