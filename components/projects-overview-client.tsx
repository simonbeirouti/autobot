"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArchiveIcon,
  ArrowRightIcon,
  FolderKanbanIcon,
  RefreshCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { useProject } from "@/components/providers/project-provider";
import {
  DashboardPageHeader,
  DashboardPageHeaderSkeleton,
} from "@/components/dashboard-page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useManageProjectsQuery,
  useUpdateProjectMutation,
} from "@/lib/query/projects";
import { DASHBOARD_HOME_ROUTE, PROJECT_ONBOARDING_ROUTE } from "@/lib/routes";
import type { Project } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type ProjectActionDialogState = {
  action: "archive" | "delete";
  project: Project;
} | null;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ProjectCardSkeleton() {
  return (
    <Card className="border border-border/70 bg-background/95 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)]">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-52" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-64" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </CardFooter>
    </Card>
  );
}

export function ProjectsOverviewSkeleton({
  showHeader = true,
}: {
  showHeader?: boolean;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col gap-4 overflow-hidden">
      <div className="relative space-y-4">
        {showHeader ? (
          <DashboardPageHeaderSkeleton showActions />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <ProjectCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  activeProjectId,
  isPending,
  onArchive,
  onDelete,
  onRestore,
  onSwitch,
  project,
}: {
  activeProjectId: string | null;
  isPending: boolean;
  onArchive: (project: Project) => void;
  onDelete: (project: Project) => void;
  onRestore: (project: Project) => void;
  onSwitch: (project: Project) => void;
  project: Project;
}) {
  const isActiveProject = activeProjectId === project.id;
  const isArchived = project.status === "archived";

  return (
    <Card
      className={cn(
        "border border-border/70 bg-background/95 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)]",
        isActiveProject && "ring-1 ring-amber-500/40",
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center border border-border/70 bg-muted/40 text-sm font-semibold">
              {project.iconKey}
            </div>
            <div className="space-y-1">
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>{project.description}</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isActiveProject ? <Badge>Current</Badge> : null}
            <Badge variant="outline">{isArchived ? "Archived" : "Available"}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="border border-dashed border-border/70 p-3">
            <div className="text-[11px] uppercase tracking-[0.18em]">Created</div>
            <div className="mt-1 text-foreground">{formatTimestamp(project.createdAt)}</div>
          </div>
          <div className="border border-dashed border-border/70 p-3">
            <div className="text-[11px] uppercase tracking-[0.18em]">
              {isArchived ? "Archived" : "Updated"}
            </div>
            <div className="mt-1 text-foreground">
              {formatTimestamp(isArchived ? project.archivedAt ?? project.updatedAt : project.updatedAt)}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {isArchived
            ? "Archived projects stay out of the switcher but keep their history."
            : "Switching keeps the workspace context pinned to this project."}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isArchived ? (
            <Button
              disabled={isPending}
              onClick={() => onRestore(project)}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCcwIcon className="size-3.5" />
              Restore
            </Button>
          ) : (
            <>
              <Button
                disabled={isPending || isActiveProject}
                onClick={() => onSwitch(project)}
                size="sm"
                type="button"
              >
                <ArrowRightIcon className="size-3.5" />
                {isActiveProject ? "Current project" : "Switch to project"}
              </Button>
              <Button
                disabled={isPending}
                onClick={() => onArchive(project)}
                size="sm"
                type="button"
                variant="outline"
              >
                <ArchiveIcon className="size-3.5" />
                Archive
              </Button>
            </>
          )}
          <Button
            disabled={isPending}
            onClick={() => onDelete(project)}
            size="sm"
            type="button"
            variant="destructive"
          >
            <Trash2Icon className="size-3.5" />
            Delete
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export function ProjectsOverviewClient() {
  const router = useRouter();
  const { activeProjectId, setActiveProjectId } = useProject();
  const { data, error, isFetching, isLoading } = useManageProjectsQuery();
  const updateProjectMutation = useUpdateProjectMutation();
  const [dialogState, setDialogState] = useState<ProjectActionDialogState>(null);

  const projects = data ?? [];
  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === "active"),
    [projects],
  );
  const archivedProjects = useMemo(
    () => projects.filter((project) => project.status === "archived"),
    [projects],
  );

  if (error && !isLoading && !isFetching && !data) {
    throw error;
  }

  if (!isLoading && !isFetching && data === undefined) {
    throw new Error("Project data is unavailable.");
  }

  function handleSwitch(project: Project) {
    setActiveProjectId(project.id);
    router.push(DASHBOARD_HOME_ROUTE);
  }

  function handleStateChange(action: "activate" | "archive" | "delete", project: Project) {
    updateProjectMutation.mutate(
      { action, projectId: project.id },
      {
        onSuccess: () => {
          const label =
            action === "archive"
              ? `${project.name} archived.`
              : action === "delete"
                ? `${project.name} removed from view.`
                : `${project.name} restored.`;
          toast.success(label);
          setDialogState(null);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Unable to update project.");
        },
      },
    );
  }

  return (
    <>
      <section className="relative flex min-h-full flex-1 flex-col gap-4 overflow-hidden">
        <div className="relative space-y-4">
          <DashboardPageHeader
            actions={
              <>
              <Button asChild type="button" variant="outline">
                <Link href={DASHBOARD_HOME_ROUTE}>Back to dashboard</Link>
              </Button>
              <Button asChild type="button">
                <Link href={PROJECT_ONBOARDING_ROUTE}>Create project</Link>
              </Button>
              </>
            }
            badge="Project switcher"
            description="Active projects stay in the switcher. Archived projects are hidden from daily navigation, and delete removes the project from view while keeping historical data intact for later review and training."
            heading="Manage available workspaces"
          />

          {isLoading ? (
            <ProjectsOverviewSkeleton showHeader={false} />
          ) : projects.length === 0 ? (
            <Empty className="min-h-72 border border-dashed border-border/70 bg-background/70">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderKanbanIcon className="size-4" />
                </EmptyMedia>
                <EmptyTitle>No projects available</EmptyTitle>
                <EmptyDescription>
                  Create a project to start building a workspace you can switch into later.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild type="button">
                  <Link href={PROJECT_ONBOARDING_ROUTE}>Create project</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              <div className="space-y-6">
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-4 pl-1">
                    <div>
                      <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Available projects
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        These are visible in the project switcher and ready to open.
                      </p>
                    </div>
                    <Badge variant="outline">{activeProjects.length}</Badge>
                  </div>
                  {activeProjects.length === 0 ? (
                    <Empty className="min-h-56 border border-dashed border-border/70 bg-background/70">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <FolderKanbanIcon className="size-4" />
                        </EmptyMedia>
                        <EmptyTitle>No switchable projects</EmptyTitle>
                        <EmptyDescription>
                          Restore an archived project or create a new one to add it back to the
                          switcher.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className="grid gap-4 m-0.5">
                      {activeProjects.map((project) => (
                        <ProjectCard
                          key={project.id}
                          activeProjectId={activeProjectId}
                          isPending={updateProjectMutation.isPending}
                          onArchive={(value) => setDialogState({ action: "archive", project: value })}
                          onDelete={(value) => setDialogState({ action: "delete", project: value })}
                          onRestore={(value) => handleStateChange("activate", value)}
                          onSwitch={handleSwitch}
                          project={project}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <section className="space-y-3">
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Archived
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hidden from the switcher, but recoverable at any time.
                  </p>
                </div>
                {archivedProjects.length === 0 ? (
                  <Empty className="min-h-56 border border-dashed border-border/70 bg-background/70">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ArchiveIcon className="size-4" />
                      </EmptyMedia>
                      <EmptyTitle>No archived projects</EmptyTitle>
                      <EmptyDescription>
                        Archive a project when you want to clear the switcher without losing the
                        record behind it.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="grid gap-4">
                    {archivedProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        activeProjectId={activeProjectId}
                        isPending={updateProjectMutation.isPending}
                        onArchive={(value) => setDialogState({ action: "archive", project: value })}
                        onDelete={(value) => setDialogState({ action: "delete", project: value })}
                        onRestore={(value) => handleStateChange("activate", value)}
                        onSwitch={handleSwitch}
                        project={project}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </section>

      <AlertDialog
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogState(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogState?.action === "archive" ? "Archive project?" : "Delete project?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogState?.action === "archive"
                ? "This hides the project from the switcher while preserving all related history for review and training."
                : "This removes the project from normal views, but keeps the historical records intact instead of cascading through the data."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateProjectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateProjectMutation.isPending || !dialogState}
              onClick={(event) => {
                event.preventDefault();
                if (!dialogState) {
                  return;
                }

                handleStateChange(dialogState.action, dialogState.project);
              }}
              variant={dialogState?.action === "delete" ? "destructive" : "default"}
            >
              {updateProjectMutation.isPending
                ? "Saving..."
                : dialogState?.action === "archive"
                  ? "Archive project"
                  : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
