import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchProject } from "@/lib/projects/repository";
import { RECOMMENDED_TOOLKITS } from "@/lib/tools/config";
import { isInternalDefinitionVisible } from "@/lib/tools/internal-registry";
import { getComposioToolCatalog } from "@/lib/tools/catalog";
import {
  fetchInternalToolDefinitionsWithFallback,
  fetchProjectInternalToolEnablements,
  fetchProviderConnections,
} from "@/lib/tools/repository";
import { resolveProjectTools } from "@/lib/tools/resolver";
import {
  discoverRelevantToolkitCandidates,
  discoverTaskToolkitNeeds,
  resolveToolkitReadiness,
} from "@/lib/tools/runtime";
import type {
  RunToolPreflight,
  ToolTaskPlanItem,
  ToolkitReadinessItem,
} from "@/lib/tools/types";

export type ToolPlanningTask = {
  title: string;
  description?: string | null;
  toolRequirement: "none" | "optional" | "required";
  executionStrategy: "manual_setup" | "tool_execution" | "analysis_only";
  toolSummary: string | null;
  requiredToolkitSlugs: string[];
  optionalToolkitSlugs: string[];
};

function normalizeToolkitSlug(value: string) {
  return value.trim().toLowerCase();
}

function buildTaskToolPlan(tasks: ToolPlanningTask[]) {
  return tasks
    .filter(
      (task) =>
        task.requiredToolkitSlugs.length > 0 ||
        task.optionalToolkitSlugs.length > 0 ||
        task.executionStrategy !== "analysis_only" ||
        Boolean(task.toolSummary),
    )
    .map<ToolTaskPlanItem>((task) => ({
      title: task.title,
      toolRequirement: task.toolRequirement,
      executionStrategy: task.executionStrategy,
      toolSummary: task.toolSummary,
      requiredToolkitSlugs: task.requiredToolkitSlugs,
      optionalToolkitSlugs: task.optionalToolkitSlugs,
    }));
}

function withConnectToolsParam(nextPath: string) {
  const [pathname, query = ""] = nextPath.split("?");
  const params = new URLSearchParams(query);
  params.set("connectTools", "1");
  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function buildToolPreflightFromReadiness(params: {
  tasks: ToolPlanningTask[];
  readiness: ToolkitReadinessItem[];
  nextPath: string;
  internalDefinitions?: Array<{
    toolkitSlug: string;
    title: string;
    description: string;
  }>;
}): RunToolPreflight {
  const taskToolPlan = buildTaskToolPlan(params.tasks);
  const requiredToolkitSlugs = Array.from(
    new Set(
      taskToolPlan
        .filter((task) => task.toolRequirement === "required")
        .flatMap((task) => task.requiredToolkitSlugs.map(normalizeToolkitSlug)),
    ),
  );
  const readinessByToolkit = new Map(
    params.readiness.map((item) => [normalizeToolkitSlug(item.toolkitSlug), item]),
  );
  const resolvedReadiness = requiredToolkitSlugs.map(
    (toolkitSlug) =>
      readinessByToolkit.get(toolkitSlug) ?? {
        toolkitSlug,
        status: "not_connected" as const,
        message: `${toolkitSlug} is not connected yet.`,
      },
  );
  const internalToolkitSlugs = new Set(
    (params.internalDefinitions ?? []).map((definition) => normalizeToolkitSlug(definition.toolkitSlug)),
  );
  const blockingToolkitSlugs = resolvedReadiness
    .filter((item) => item.status !== "ready")
    .filter((item) => !internalToolkitSlugs.has(normalizeToolkitSlug(item.toolkitSlug)))
    .map((item) => item.toolkitSlug);
  const modalHref = withConnectToolsParam(params.nextPath);

  return {
    requiredToolkitSlugs,
    taskToolPlan,
    readiness: resolvedReadiness,
    blockingToolkitSlugs,
    launchState: blockingToolkitSlugs.length > 0 ? "blocked" : "ready",
    recommendedAction:
      blockingToolkitSlugs.length > 0
        ? {
            label: "Connect tools",
            href: modalHref,
            target: {
              kind: "connect_tools_modal",
              href: modalHref,
            },
          }
        : null,
    toolkits: resolvedReadiness.map((item) => {
      const toolkit = RECOMMENDED_TOOLKITS.find(
        (candidate) => normalizeToolkitSlug(candidate.slug) === normalizeToolkitSlug(item.toolkitSlug),
      );
      const internalDefinition = params.internalDefinitions?.find(
        (candidate) =>
          normalizeToolkitSlug(candidate.toolkitSlug) === normalizeToolkitSlug(item.toolkitSlug),
      );

      return {
        slug: item.toolkitSlug,
        title: toolkit?.title ?? internalDefinition?.title ?? item.toolkitSlug,
        description: toolkit?.description ?? internalDefinition?.description ?? null,
        readiness: item,
      };
    }),
  };
}

async function resolveProjectToolPlanningContext(
  supabase: SupabaseClient,
  params: {
    userId: string;
    projectId: string;
    objective: string;
    tasks: ToolPlanningTask[];
    discoverMissingToolkitRequirements?: boolean;
  },
) {
  const [project, providerConnections, projectTools, internalDefinitions, internalEnablements] = await Promise.all([
    fetchProject(supabase, {
      projectId: params.projectId,
      userId: params.userId,
    }),
    fetchProviderConnections(supabase, {
      userId: params.userId,
    }),
    resolveProjectTools(supabase, {
      projectId: params.projectId,
      userId: params.userId,
    }),
    fetchInternalToolDefinitionsWithFallback(supabase),
    fetchProjectInternalToolEnablements(supabase, {
      projectId: params.projectId,
      userId: params.userId,
    }).catch(() => []),
  ]);
  const visibleInternalDefinitions = internalDefinitions.filter((definition) =>
    isInternalDefinitionVisible({
      definition,
      companyKey: project.companyKey,
      projectId: params.projectId,
    }),
  );
  const catalog = await getComposioToolCatalog(providerConnections).catch(() => null);
  const toolkitCatalog = [
    ...(catalog?.toolkits ?? []).map((toolkit) => ({
      slug: toolkit.slug,
      name: toolkit.name,
      description: toolkit.description,
    })),
    ...visibleInternalDefinitions.map((tool) => ({
      slug: tool.toolkitSlug,
      name: tool.title,
      description: tool.description,
    })),
  ];
  const shouldDiscoverMissingToolkitRequirements =
    params.discoverMissingToolkitRequirements ?? false;
  const discoveredTasks = shouldDiscoverMissingToolkitRequirements
    ? await Promise.all(
        params.tasks.map(async (task) => {
          const normalizedTask = {
            ...task,
            toolRequirement:
              task.toolRequirement !== "none"
                ? task.toolRequirement
                : task.requiredToolkitSlugs.length > 0
                  ? ("required" as const)
                  : task.optionalToolkitSlugs.length > 0
                    ? ("optional" as const)
                    : ("none" as const),
            optionalToolkitSlugs: task.optionalToolkitSlugs ?? [],
          };

          if (
            normalizedTask.requiredToolkitSlugs.length > 0 ||
            normalizedTask.optionalToolkitSlugs.length > 0
          ) {
            return normalizedTask;
          }

          const candidateToolkitSlugs = Array.from(
            new Set([
              ...projectTools.selectedToolkitSlugs,
              ...(
                await discoverRelevantToolkitCandidates({
                  objective: params.objective,
                  taskTitle: task.title,
                  taskDescription: task.description ?? task.toolSummary ?? null,
                  toolkitCatalog,
                }).then((result) => result.toolkitSlugs)
              ),
            ]),
          );

          const discovery = await discoverTaskToolkitNeeds({
            objective: params.objective,
            taskTitle: task.title,
            taskDescription: task.description ?? task.toolSummary ?? null,
            candidateToolkitSlugs,
          }).catch(() => ({
            toolRequirement: "none" as const,
            toolkitSlugs: [] as string[],
            rationale: "",
          }));

          return {
            ...normalizedTask,
            toolRequirement: discovery.toolRequirement,
            requiredToolkitSlugs:
              discovery.toolRequirement === "required" ? discovery.toolkitSlugs : [],
            optionalToolkitSlugs:
              discovery.toolRequirement === "optional" ? discovery.toolkitSlugs : [],
            executionStrategy:
              discovery.toolRequirement !== "none" && discovery.toolkitSlugs.length > 0
                ? ("tool_execution" as const)
                : task.executionStrategy,
            toolSummary:
              discovery.toolRequirement !== "none" && discovery.toolkitSlugs.length > 0
                ? discovery.rationale || task.toolSummary
                : task.toolSummary,
          };
        }),
      )
    : params.tasks;
  return {
    discoveredTasks,
    providerConnections,
    internalDefinitions: visibleInternalDefinitions,
    internalEnablements,
  };
}

export async function resolveProjectToolPlanningTasks(
  supabase: SupabaseClient,
  params: {
    userId: string;
    projectId: string;
    objective: string;
    tasks: ToolPlanningTask[];
    discoverMissingToolkitRequirements?: boolean;
  },
) {
  const { discoveredTasks } = await resolveProjectToolPlanningContext(supabase, params);
  return discoveredTasks;
}

export async function buildProjectToolPreflight(
  supabase: SupabaseClient,
  params: {
    userId: string;
    projectId: string;
    objective: string;
    tasks: ToolPlanningTask[];
    nextPath: string;
    discoverMissingToolkitRequirements?: boolean;
  },
): Promise<RunToolPreflight> {
  const { discoveredTasks, providerConnections, internalDefinitions, internalEnablements } = await resolveProjectToolPlanningContext(
    supabase,
    params,
  );
  const requiredToolkitSlugs = Array.from(
    new Set(
      discoveredTasks.flatMap((task) => task.requiredToolkitSlugs.map(normalizeToolkitSlug)),
    ),
  );
  const readiness = resolveToolkitReadiness({
    selectedToolkitSlugs: requiredToolkitSlugs,
    providerConnections,
    internalToolkitSlugs: internalDefinitions
      .filter((definition) => {
        const enablement = internalEnablements.find((item) => item.toolSlug === definition.slug);
        return enablement?.isEnabled ?? definition.enabledByDefault;
      })
      .map((definition) => definition.toolkitSlug),
  });

  return buildToolPreflightFromReadiness({
    tasks: discoveredTasks,
    readiness,
    nextPath: params.nextPath,
    internalDefinitions: internalDefinitions.map((tool) => ({
      toolkitSlug: tool.toolkitSlug,
      title: tool.title,
      description: tool.description,
    })),
  });
}
