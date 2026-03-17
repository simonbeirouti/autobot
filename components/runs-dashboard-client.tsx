"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useIsRestoring, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckIcon, ChevronDownIcon, Clock3Icon, FootprintsIcon, MoreHorizontalIcon, PanelLeftIcon, PlayIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  advanceWorkspace,
  fetchWorkspace,
  resumeWorkspace,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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

function isManuallyStoppedRun(run: RunListItem) {
  return run.status === "blocked" && run.actionRequired?.reason === "user_paused_run";
}

async function stopRun(runId: string) {
  return fetchJson<WorkspacePayload>(`/api/runs/${runId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "stop" }),
  });
}

async function deleteRun(runId: string) {
  return fetchJson<{ success: true; runId: string }>(`/api/runs/${runId}`, {
    method: "DELETE",
  });
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

function getRunSummary(run: Pick<RunListItem, "finalSummary" | "readinessSummary">) {
  return run.finalSummary ?? run.readinessSummary ?? null;
}

function RunSidebarItem({
  run,
  isActive,
  isStopped,
  isMenuOpen,
  isDeleteConfirming,
  isActionPending,
  onSelect,
  onMenuToggle,
  onResume,
  onStop,
  onDelete,
}: {
  run: RunListItem;
  isActive: boolean;
  isStopped: boolean;
  isMenuOpen: boolean;
  isDeleteConfirming: boolean;
  isActionPending: boolean;
  onSelect: () => void;
  onMenuToggle: (open: boolean) => void;
  onResume: () => void;
  onStop: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "border border-border",
        isActive && "border-primary bg-muted",
      )}
    >
      <div className="flex items-start gap-2 p-4">
        <button
          className="min-w-0 flex-1 space-y-4 text-left"
          onClick={onSelect}
          type="button"
        >
          <div className="space-y-2">
            <h2 className="text-sm font-medium" title={run.objective}>
              {truncateRunTitle(run.objective)}
            </h2>
          </div>
          {getRunSummary(run) ? (
            <p className="line-clamp-3 text-xs text-muted-foreground">
              {getRunSummary(run)}
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
        </button>

        <DropdownMenu
          open={isMenuOpen}
          onOpenChange={onMenuToggle}
        >
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Open actions for ${run.objective}`}
              className="shrink-0"
              size="icon"
              type="button"
              variant="outline"
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {isStopped ? (
              <>
                <DropdownMenuItem
                  disabled={isActionPending}
                  onSelect={(event) => {
                    event.preventDefault();
                    onResume();
                  }}
                >
                  <PlayIcon className="size-4" />
                  Run
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isActionPending}
                  onSelect={(event) => {
                    event.preventDefault();
                    onDelete();
                  }}
                  variant={isDeleteConfirming ? "destructive" : "default"}
                >
                  {isDeleteConfirming ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <Trash2Icon className="size-4" />
                  )}
                  {isDeleteConfirming ? "Confirm delete" : "Delete"}
                </DropdownMenuItem>
              </>
            ) : (
              <>
                {run.status !== "completed" && run.status !== "failed" ? (
                  <DropdownMenuItem
                    disabled={isActionPending}
                    onSelect={(event) => {
                      event.preventDefault();
                      onStop();
                    }}
                  >
                    <SquareIcon className="size-4" />
                    Stop
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  disabled={isActionPending}
                  onSelect={(event) => {
                    event.preventDefault();
                    onDelete();
                  }}
                  variant={isDeleteConfirming ? "destructive" : "default"}
                >
                  {isDeleteConfirming ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <Trash2Icon className="size-4" />
                  )}
                  {isDeleteConfirming ? "Confirm delete" : "Delete"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

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
  const [openMenuRunId, setOpenMenuRunId] = useState<string | null>(null);
  const [confirmDeleteRunId, setConfirmDeleteRunId] = useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

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
  const hasRunsLoadError =
    Boolean(runsQuery.error) && !runsQuery.isLoading && !runsQuery.isFetching;
  const showRunsError = useDelayedVisibility(hasRunsLoadError, ERROR_VISIBILITY_DELAY_MS);
  const selectedRunId =
    requestedRunId && runs.some((run) => run.id === requestedRunId)
      ? requestedRunId
      : initialSelectedRunId ?? runs[0]?.id ?? null;
  const deferredRunId = useDeferredValue(selectedRunId);

  useEffect(() => {
    if (!confirmDeleteRunId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setConfirmDeleteRunId((current) => (current === confirmDeleteRunId ? null : current));
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [confirmDeleteRunId]);

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
      if (workspace.run.status === "blocked" || workspace.run.actionRequired) {
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.notifications.all,
        });
      }
    },
  });
  const resumeMutation = useMutation({
    mutationFn: (runId?: string) => resumeWorkspace(runId ?? selectedRunId!),
    onSuccess: (workspace) => {
      queryClient.setQueryData(dashboardQueryKeys.runs.workspace(workspace.run.id), workspace);
      if (activeProjectId) {
        queryClient.setQueryData<RunListItem[] | undefined>(
          dashboardQueryKeys.runs.all(activeProjectId),
          (currentRuns) => mergeRunIntoList(currentRuns, workspace),
        );
      }
      if (workspace.run.status === "blocked" || workspace.run.actionRequired) {
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.notifications.all,
        });
      }
      setOpenMenuRunId(null);
      setConfirmDeleteRunId(null);
    },
  });
  const stopMutation = useMutation({
    mutationFn: (runId: string) => stopRun(runId),
    onSuccess: (workspace) => {
      queryClient.setQueryData(dashboardQueryKeys.runs.workspace(workspace.run.id), workspace);
      if (activeProjectId) {
        queryClient.setQueryData<RunListItem[] | undefined>(
          dashboardQueryKeys.runs.all(activeProjectId),
          (currentRuns) => mergeRunIntoList(currentRuns, workspace),
        );
      }
      if (workspace.run.status === "blocked" || workspace.run.actionRequired) {
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.notifications.all,
        });
      }
      setOpenMenuRunId(null);
      setConfirmDeleteRunId(null);
      toast.success("Run stopped.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to stop run.");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (runId: string) => deleteRun(runId),
    onSuccess: ({ runId }) => {
      const currentRuns =
        queryClient.getQueryData<RunListItem[]>(
          activeProjectId
            ? dashboardQueryKeys.runs.all(activeProjectId)
            : dashboardQueryKeys.runs.all("pending"),
        ) ?? [];
      const nextRuns = currentRuns.filter((run) => run.id !== runId);

      if (activeProjectId) {
        queryClient.setQueryData(dashboardQueryKeys.runs.all(activeProjectId), nextRuns);
      }
      queryClient.removeQueries({
        queryKey: dashboardQueryKeys.runs.workspace(runId),
      });
      setOpenMenuRunId(null);
      setConfirmDeleteRunId(null);

      if (selectedRunId === runId) {
        const nextRun = nextRuns[0] ?? null;
        startTransition(() => {
          if (nextRun) {
            router.replace(buildRunHref(pathname, nextRun.id), { scroll: false });
            return;
          }

          router.replace(pathname, { scroll: false });
        });
      }

      toast.success("Run deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete run.");
    },
  });

  const showWorkspaceError = useDelayedVisibility(
    Boolean(workspaceQuery.error) && !workspaceQuery.isLoading && !workspaceQuery.isFetching,
    ERROR_VISIBILITY_DELAY_MS,
  );
  const isWorkspaceTransitioning = Boolean(selectedRunId) && deferredRunId !== selectedRunId;
  const isWorkspaceLoading =
    isWorkspaceTransitioning || workspaceQuery.isLoading || (workspaceQuery.isFetching && !workspaceQuery.data);
  const selectedRun = selectedRunId
    ? runs.find((run) => run.id === selectedRunId) ?? null
    : null;
  const selectedRunSummary =
    workspaceQuery.data?.run.id === selectedRunId
      ? getRunSummary(workspaceQuery.data.run)
      : selectedRun
        ? getRunSummary(selectedRun)
        : null;

  const handleSelectRun = (runId: string) => {
    startTransition(() => {
      router.replace(buildRunHref(pathname, runId), { scroll: false });
    });
    setIsMobileDrawerOpen(false);
  };

  const handleDeleteRun = (runId: string) => {
    if (confirmDeleteRunId === runId) {
      deleteMutation.mutate(runId);
      return;
    }

    setConfirmDeleteRunId(runId);
  };

  useEffect(() => {
    if (!workspaceQuery.data || !selectedRunId) {
      return;
    }

    if (
      workspaceQuery.data.run.status === "completed" ||
      workspaceQuery.data.run.status === "failed" ||
      workspaceQuery.data.run.status === "blocked"
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
      mobileDescription={selectedRunSummary}
      mobileSelector={
        activeProject ? (
          <Drawer onOpenChange={setIsMobileDrawerOpen} open={isMobileDrawerOpen}>
            <DrawerTrigger asChild>
              <Button className="w-full justify-between" type="button" variant="outline">
                <span className="flex items-center gap-2">
                  <PanelLeftIcon className="size-4" />
                  {selectedRun ? "Browse runs" : "Select a run"}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {runs.length}
                  <ChevronDownIcon className="size-4" />
                </span>
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="text-left">
                <DrawerTitle>Execution history</DrawerTitle>
                <DrawerDescription>
                  Recent and in-flight runs stay cached locally so this workspace reopens quickly.
                </DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-4">
                <div className="space-y-2">
                  {runs.map((run) => {
                    const isStopped = isManuallyStoppedRun(run);
                    const isActionPending =
                      resumeMutation.isPending || stopMutation.isPending || deleteMutation.isPending;

                    return (
                      <RunSidebarItem
                        isActionPending={isActionPending}
                        isActive={run.id === selectedRunId}
                        isDeleteConfirming={confirmDeleteRunId === run.id}
                        isMenuOpen={openMenuRunId === run.id}
                        isStopped={isStopped}
                        key={run.id}
                        onDelete={() => handleDeleteRun(run.id)}
                        onMenuToggle={(open) => {
                          setOpenMenuRunId(open ? run.id : null);
                          if (!open) {
                            setConfirmDeleteRunId(null);
                          }
                        }}
                        onResume={() => resumeMutation.mutate(run.id)}
                        onSelect={() => handleSelectRun(run.id)}
                        onStop={() => stopMutation.mutate(run.id)}
                        run={run}
                      />
                    );
                  })}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        ) : null
      }
      mobileTitle={selectedRun?.objective ?? null}
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
              const isStopped = isManuallyStoppedRun(run);
              const isActionPending =
                resumeMutation.isPending || stopMutation.isPending || deleteMutation.isPending;

              return (
                <RunSidebarItem
                  isActionPending={isActionPending}
                  isActive={run.id === selectedRunId}
                  isDeleteConfirming={confirmDeleteRunId === run.id}
                  isMenuOpen={openMenuRunId === run.id}
                  isStopped={isStopped}
                  key={run.id}
                  onDelete={() => handleDeleteRun(run.id)}
                  onMenuToggle={(open) => {
                    setOpenMenuRunId(open ? run.id : null);
                    if (!open) {
                      setConfirmDeleteRunId(null);
                    }
                  }}
                  onResume={() => resumeMutation.mutate(run.id)}
                  onSelect={() => handleSelectRun(run.id)}
                  onStop={() => stopMutation.mutate(run.id)}
                  run={run}
                />
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
        ) : isWorkspaceLoading || (workspaceQuery.error && !showWorkspaceError) ? (
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
              <RunWorkspaceView
                data={workspaceQuery.data}
                isResuming={resumeMutation.isPending}
                onResume={() => resumeMutation.mutate(selectedRunId ?? undefined)}
              />
        )
      }
    />
  );
}
