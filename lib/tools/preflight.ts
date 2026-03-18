import type { SupabaseClient } from "@supabase/supabase-js";

import { RECOMMENDED_TOOLKITS } from "@/lib/tools/config";
import { getComposioToolCatalog } from "@/lib/tools/catalog";
import { fetchProviderConnections } from "@/lib/tools/repository";
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

type ToolPlanningTask = {
  title: string;
  description?: string | null;
  executionStrategy: "manual_setup" | "tool_execution" | "analysis_only";
  toolSummary: string | null;
  requiredToolkitSlugs: string[];
};

function normalizeToolkitSlug(value: string) {
  return value.trim().toLowerCase();
}

function buildTaskToolPlan(tasks: ToolPlanningTask[]) {
  return tasks
    .filter(
      (task) =>
        task.requiredToolkitSlugs.length > 0 ||
        task.executionStrategy !== "analysis_only" ||
        Boolean(task.toolSummary),
    )
    .map<ToolTaskPlanItem>((task) => ({
      title: task.title,
      executionStrategy: task.executionStrategy,
      toolSummary: task.toolSummary,
      requiredToolkitSlugs: task.requiredToolkitSlugs,
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
}): RunToolPreflight {
  const taskToolPlan = buildTaskToolPlan(params.tasks);
  const requiredToolkitSlugs = Array.from(
    new Set(
      taskToolPlan.flatMap((task) => task.requiredToolkitSlugs.map(normalizeToolkitSlug)),
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
  const blockingToolkitSlugs = resolvedReadiness
    .filter((item) => item.status !== "ready")
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

      return {
        slug: item.toolkitSlug,
        title: toolkit?.title ?? item.toolkitSlug,
        description: toolkit?.description ?? null,
        readiness: item,
      };
    }),
  };
}

export async function buildProjectToolPreflight(
  supabase: SupabaseClient,
  params: {
    userId: string;
    projectId: string;
    objective: string;
    tasks: ToolPlanningTask[];
    nextPath: string;
  },
): Promise<RunToolPreflight> {
  const [providerConnections, projectTools] = await Promise.all([
    fetchProviderConnections(supabase, {
      userId: params.userId,
    }),
    resolveProjectTools(supabase, {
      projectId: params.projectId,
      userId: params.userId,
    }),
  ]);
  const catalog = await getComposioToolCatalog(providerConnections).catch(() => null);
  const toolkitCatalog = (catalog?.toolkits ?? []).map((toolkit) => ({
    slug: toolkit.slug,
    name: toolkit.name,
    description: toolkit.description,
  }));
  const discoveredTasks = await Promise.all(
    params.tasks.map(async (task) => {
      if (task.requiredToolkitSlugs.length > 0) {
        return task;
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
        requiresTools: false,
        toolkitSlugs: [] as string[],
        rationale: "",
      }));

      return {
        ...task,
        requiredToolkitSlugs: discovery.requiresTools ? discovery.toolkitSlugs : [],
        executionStrategy:
          discovery.requiresTools && discovery.toolkitSlugs.length > 0
            ? ("tool_execution" as const)
            : task.executionStrategy,
        toolSummary:
          discovery.requiresTools && discovery.toolkitSlugs.length > 0
            ? discovery.rationale || task.toolSummary
            : task.toolSummary,
      };
    }),
  );
  const requiredToolkitSlugs = Array.from(
    new Set(
      discoveredTasks.flatMap((task) => task.requiredToolkitSlugs.map(normalizeToolkitSlug)),
    ),
  );
  const readiness = resolveToolkitReadiness({
    selectedToolkitSlugs: requiredToolkitSlugs,
    providerConnections,
  });

  return buildToolPreflightFromReadiness({
    tasks: discoveredTasks,
    readiness,
    nextPath: params.nextPath,
  });
}
