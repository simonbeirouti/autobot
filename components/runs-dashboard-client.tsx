"use client";

import { startTransition, useDeferredValue, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useIsRestoring, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock3Icon, FootprintsIcon } from "lucide-react";

import {
  advanceWorkspace,
  fetchWorkspace,
  RunWorkspaceSkeleton,
  RunWorkspaceView,
} from "@/components/run-workspace";
import { useProject } from "@/components/providers/project-provider";
import {
  WorkspaceSidebarPanel,
  WorkspaceSidebarSkeleton,
  WorkspaceSplitLayout,
} from "@/components/workspace-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  dashboardQueryKeys,
  dashboardQueryTimings,
  fetchJson,
  getRunsUpdatedAt,
  mergeRunIntoList,
} from "@/lib/query/dashboard";
import { useDelayedVisibility } from "@/lib/query/use-delayed-visibility";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { RunListItem, WorkspacePayload } from "@/lib/runs/types";

const RUN_TITLE_MAX_LENGTH = 30;
const ERROR_VISIBILITY_DELAY_MS = 1000;

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return Date.now();
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

async function fetchRuns(projectId: string) {
  return fetchJson<RunListItem[]>(`/api/runs?projectId=${projectId}`);
}

function truncateRunTitle(objective: string) {
  if (objective.length <= RUN_TITLE_MAX_LENGTH) {
    return objective;
  }

  return `${objective.slice(0, RUN_TITLE_MAX_LENGTH - 3).trimEnd()}...`;
}

function buildRunHref(pathname: string, runId: string) {
  const params = new URLSearchParams();
  params.set("runId", runId);
  return `${pathname}?${params.toString()}`;
}

function RunsDashboardSkeleton() {
  return (
    <WorkspaceSplitLayout
      sidebar={
        <WorkspaceSidebarSkeleton
          descriptionWidth="w-4/5"
          itemCount={3}
          titleWidth="w-40"
        />
      }
      content={<RunWorkspaceSkeleton />}
    />
  );
}

export { RunsDashboardSkeleton };

export function RunsDashboardClient({
  initialRuns,
  initialWorkspace,
  initialSelectedRunId,
}: {
  initialRuns?: RunListItem[];
  initialWorkspace?: WorkspacePayload | null;
  initialSelectedRunId?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();
  const { activeProject, activeProjectId } = useProject();
  const requestedRunId = searchParams.get("runId");

  const runsQuery = useQuery({
    queryKey: activeProjectId
      ? dashboardQueryKeys.runs.all(activeProjectId)
      : dashboardQueryKeys.runs.all("pending"),
    queryFn: () => fetchRuns(activeProjectId!),
    ...(initialRuns && activeProjectId
      ? {
          initialData: initialRuns,
          initialDataUpdatedAt: getRunsUpdatedAt(initialRuns),
        }
      : {}),
    enabled: Boolean(activeProjectId),
    staleTime: dashboardQueryTimings.runs.staleTime,
  });

  const runs = runsQuery.data ?? [];
  const showRunsError = useDelayedVisibility(Boolean(runsQuery.error), ERROR_VISIBILITY_DELAY_MS);
  const selectedRunId =
    requestedRunId && runs.some((run) => run.id === requestedRunId)
      ? requestedRunId
      : initialSelectedRunId ?? runs[0]?.id ?? null;
  const deferredRunId = useDeferredValue(selectedRunId);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    if (!runs.length || requestedRunId === selectedRunId || !selectedRunId) {
      return;
    }

    startTransition(() => {
      router.replace(buildRunHref(pathname, selectedRunId), { scroll: false });
    });
  }, [activeProjectId, pathname, requestedRunId, router, runs.length, selectedRunId]);

  const workspaceQuery = useQuery({
    queryKey: deferredRunId
      ? dashboardQueryKeys.runs.workspace(deferredRunId)
      : dashboardQueryKeys.runs.workspace("pending"),
    queryFn: () => fetchWorkspace(deferredRunId!),
    enabled: Boolean(deferredRunId),
    initialData:
      initialWorkspace && initialWorkspace.run.id === deferredRunId ? initialWorkspace : undefined,
    initialDataUpdatedAt:
      initialWorkspace && initialWorkspace.run.id === deferredRunId
        ? getTimestamp(initialWorkspace.run.updatedAt)
        : undefined,
    staleTime: dashboardQueryTimings.runWorkspace.staleTime,
  });

  const advanceMutation = useMutation({
    mutationFn: () => advanceWorkspace(selectedRunId!),
    onSuccess: (workspace) => {
      queryClient.setQueryData(dashboardQueryKeys.runs.workspace(workspace.run.id), workspace);
      if (activeProjectId) {
        queryClient.setQueryData<RunListItem[] | undefined>(
          dashboardQueryKeys.runs.all(activeProjectId),
          (currentRuns) => mergeRunIntoList(currentRuns, workspace),
        );
      }
    },
  });

  const showWorkspaceError = useDelayedVisibility(
    Boolean(workspaceQuery.error),
    ERROR_VISIBILITY_DELAY_MS,
  );

  useEffect(() => {
    if (!workspaceQuery.data || !selectedRunId) {
      return;
    }

    if (
      workspaceQuery.data.run.status === "completed" ||
      workspaceQuery.data.run.status === "failed"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      if (!advanceMutation.isPending) {
        advanceMutation.mutate();
      }
    }, 3_200);

    return () => window.clearInterval(interval);
  }, [advanceMutation, selectedRunId, workspaceQuery.data]);

  return (
    <WorkspaceSplitLayout
      sidebar={
        <WorkspaceSidebarPanel
          description="Recent and in-flight runs stay cached locally so this workspace reopens quickly."
          title="Execution history"
        >
          {!activeProject ? (
            <Empty className="border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FootprintsIcon />
                </EmptyMedia>
                <EmptyTitle>Select a project</EmptyTitle>
                <EmptyDescription>
                  Choose a project from the switcher before opening project-scoped runs.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {showRunsError ? (
            <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {runsQuery.error instanceof Error ? runsQuery.error.message : "Unable to load runs."}
            </div>
          ) : null}

          {activeProject && !isRestoring && !runsQuery.isLoading && !showRunsError && runs.length === 0 ? (
            <Empty className="border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FootprintsIcon />
                </EmptyMedia>
                <EmptyTitle>No runs yet</EmptyTitle>
                <EmptyDescription>
                  Start an objective for {activeProject.name} to create the first run.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          <div className="space-y-2">
            {runs.map((run) => {
              const isActive = run.id === selectedRunId;

              return (
                <Button
                  className={cn(
                    "h-auto w-full items-start justify-start border border-border p-0 text-left whitespace-normal",
                    isActive && "border-primary bg-muted",
                  )}
                  key={run.id}
                  onClick={() => {
                    startTransition(() => {
                      router.replace(buildRunHref(pathname, run.id), { scroll: false });
                    });
                  }}
                  variant="ghost"
                >
                  <div className="w-full space-y-4 p-4">
                    <div className="space-y-2">
                      <h2 className="text-sm font-medium" title={run.objective}>
                        {truncateRunTitle(run.objective)}
                      </h2>
                    </div>
                    {(run.finalSummary ?? run.readinessSummary) ? (
                      <p className="line-clamp-3 text-xs text-muted-foreground">
                        {run.finalSummary ?? run.readinessSummary}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={isActive ? "default" : "secondary"}>{run.status}</Badge>
                      <Badge variant="outline">
                        {run.executionMode.replace("_", " ")}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3Icon className="size-3.5" />
                      <span>
                        Updated {formatDistanceToNowStrict(new Date(run.updatedAt))} ago
                      </span>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </WorkspaceSidebarPanel>
      }
      content={
        !activeProject ? (
          <Card className="min-h-[320px] justify-center overflow-hidden xl:h-full xl:min-h-0">
            <CardContent className="flex h-full items-center justify-center py-0">
              <Empty className="max-w-md border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FootprintsIcon />
                  </EmptyMedia>
                  <EmptyTitle>Select a project</EmptyTitle>
                  <EmptyDescription>
                    Choose a project from the switcher to inspect only that project&apos;s runs.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : !selectedRunId && (isRestoring || runsQuery.isLoading) ? (
          <RunWorkspaceSkeleton />
        ) : !selectedRunId ? (
          <Card className="min-h-[320px] justify-center overflow-hidden xl:h-full xl:min-h-0">
            <CardContent className="flex h-full items-center justify-center py-0">
              <Empty className="max-w-md border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FootprintsIcon />
                  </EmptyMedia>
                  <EmptyTitle>Select a run</EmptyTitle>
                  <EmptyDescription>
                    Choose a run from the list to inspect its tasks, events, and usage details.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : workspaceQuery.isLoading || (workspaceQuery.error && !showWorkspaceError) ? (
          <RunWorkspaceSkeleton />
        ) : workspaceQuery.error || !workspaceQuery.data ? (
          <Card className="min-h-[320px] overflow-hidden xl:h-full xl:min-h-0">
            <CardContent className="py-6">
              <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {workspaceQuery.error instanceof Error
                  ? workspaceQuery.error.message
                  : "Unable to load run."}
              </div>
            </CardContent>
          </Card>
        ) : (
          <RunWorkspaceView data={workspaceQuery.data} />
        )
      }
    />
  );
}
