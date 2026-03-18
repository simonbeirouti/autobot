"use client";

import type { ComponentType } from "react";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
  ActivityIcon,
  BotIcon,
  ClipboardListIcon,
  PlayIcon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToolConnectionChecklist } from "@/components/tool-connection-checklist";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  dashboardQueryKeys,
  dashboardQueryTimings,
  fetchJson,
} from "@/lib/query/dashboard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { RunActionRequired, RunEvent, RunTask, WorkspacePayload } from "@/lib/runs/types";

const colorClassMap: Record<string, string> = {
  amber: "text-chart-2",
  cyan: "text-chart-3",
  emerald: "text-chart-1",
  rose: "text-destructive",
};

export async function fetchWorkspace(runId: string, signal?: AbortSignal) {
  return fetchJson<WorkspacePayload>(`/api/runs/${runId}`, {
    cache: "no-store",
    signal,
  });
}

export async function advanceWorkspace(runId: string) {
  return fetchJson<WorkspacePayload>(`/api/runs/${runId}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function resumeWorkspace(runId: string) {
  return fetchJson<WorkspacePayload>(`/api/runs/${runId}/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export function buildRunSearchHref(
  pathname: string,
  searchParams: Pick<URLSearchParams, "toString">,
  params: { runId: string; connectTools?: boolean },
) {
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.set("runId", params.runId);

  if (params.connectTools) {
    nextParams.set("connectTools", "1");
  } else {
    nextParams.delete("connectTools");
  }

  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function groupTasks(tasks: RunTask[]) {
  return {
    waiting: tasks.filter((task) => task.status === "waiting"),
    underway: tasks.filter((task) => task.status === "underway"),
    complete: tasks.filter((task) => task.status === "complete"),
  };
}

function buildFallbackActionRequired(data: WorkspacePayload): RunActionRequired | null {
  if (data.run.actionRequired) {
    return data.run.actionRequired;
  }

  const incompleteTasks = data.tasks.filter((task) => task.status !== "complete");
  const taskActionRequired = incompleteTasks.find((task) => task.actionRequired)?.actionRequired ?? null;
  if (taskActionRequired) {
    return taskActionRequired;
  }

  const setupTasks = incompleteTasks.filter(
    (task) => task.executionStrategy === "manual_setup" && task.requiredToolkitSlugs.length > 0,
  );
  if (setupTasks.length === 0) {
    return null;
  }

  const requiredToolkitSlugs = Array.from(
    new Set(setupTasks.flatMap((task) => task.requiredToolkitSlugs)),
  );

  return {
    kind: "manual_setup",
    title: "Connect tools to continue this run",
    body: "This run has prerequisite setup tasks before tool-backed work can continue.",
    reason: "tool_prerequisites_missing",
    blockingTaskTitle: null,
    requiredToolkitSlugs,
    readiness: requiredToolkitSlugs.map((toolkitSlug) => ({
      toolkitSlug,
      status: "not_connected",
      message: `${toolkitSlug} is selected for this project but not connected yet.`,
    })),
    taskToolPlan: data.toolPreflight?.taskToolPlan ?? [],
    actionLabel: "Connect tools",
    actionHref: `/dashboard/runs?runId=${data.run.id}&connectTools=1`,
    actionTarget: {
      kind: "connect_tools_modal",
      href: `/dashboard/runs?runId=${data.run.id}&connectTools=1`,
    },
    resumeLabel: "Resume run",
    canResume: false,
    autoResume: true,
    notifiedAt: null,
    emailFallbackAt: null,
    emailEscalatedAt: null,
    resolvedAt: null,
  };
}

function TaskCard({ task }: { task: RunTask }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">{task.title}</h3>
          {task.agentLabel ? <Badge variant="secondary">{task.agentLabel}</Badge> : null}
        </div>
        {task.description ? (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        ) : null}
        {task.actionRequired?.requiredToolkitSlugs.length ? (
          <div className="flex flex-wrap gap-2">
            {task.actionRequired.requiredToolkitSlugs.map((toolkitSlug) => (
              <Badge key={toolkitSlug} variant="outline">
                {toolkitSlug}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EventRow({ event }: { event: RunEvent }) {
  const colorToken = event.colorToken ?? "amber";
  return (
    <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] gap-3 px-4 py-3 text-sm items-center">
      <span className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
        {new Date(event.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
      <span
        className={cn(
          "inline-flex h-fit text-[11px] uppercase tracking-[0.18em]",
          colorClassMap[colorToken] ?? colorClassMap.amber,
        )}
      >
        {event.agentLabel ?? event.type}
      </span>
      <span className="break-words font-mono text-stone-100/50 whitespace-pre-wrap">
        {event.message}
      </span>
    </div>
  );
}

function TerminalFeed({ events }: { events: RunEvent[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="p-4">
        <Empty className="border-stone-800 text-stone-200">
          <EmptyHeader>
            <EmptyTitle className="text-stone-100">No events yet</EmptyTitle>
            <EmptyDescription className="text-stone-400">
              Agent activity will appear here as the run progresses.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" ref={containerRef}>
      <div className="divide-y divide-stone-800">
        {events.map((event) => (
          <EventRow event={event} key={event.id} />
        ))}
      </div>
    </div>
  );
}

function WorkspaceHeaderSkeleton() {
  return (
    <Card className="overflow-hidden border-none">
      <CardHeader className="-mt-2">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="w-full max-w-4xl space-y-3">
            <Skeleton className="h-10 w-3/4 xl:h-12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="min-w-0 p-0">
      <CardContent className="flex items-center gap-3 py-3">
        <Skeleton className="size-7" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-10" />
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCardSkeleton() {
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </CardContent>
    </Card>
  );
}

function BoardColumnSkeleton({
  titleWidth,
  tone,
}: {
  titleWidth: string;
  tone: "amber" | "cyan" | "emerald";
}) {
  return (
    <Card
      className={cn(
        "min-h-[280px] overflow-hidden py-0 xl:h-full xl:min-h-0",
        tone === "amber" && "border-chart-2/40",
        tone === "cyan" && "border-chart-3/40",
        tone === "emerald" && "border-chart-1/40",
      )}
    >
      <CardHeader className="border-b py-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className={cn("h-7 sm:h-8", titleWidth)} />
          <Skeleton className="h-6 w-10" />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 -mt-4 xl:min-h-0">
        <ScrollArea className="xl:h-full">
          <div className="space-y-3 p-4">
            <TaskCardSkeleton />
            <TaskCardSkeleton />
            <TaskCardSkeleton />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function TerminalFeedSkeleton() {
  return (
    <Accordion className="min-h-0" collapsible type="single">
      <AccordionItem
        className="overflow-hidden border border-stone-800 bg-stone-950 text-stone-50"
        value="terminal"
      >
        <AccordionTrigger className="w-full border-b border-stone-800 px-4 py-3 text-stone-100 hover:no-underline">
          <Skeleton className="h-4 w-24 bg-stone-800" />
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          <div className="divide-y divide-stone-800">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] gap-3 px-4 py-3"
                key={index}
              >
                <Skeleton className="h-4 w-[4.5rem] bg-stone-800" />
                <Skeleton className="h-4 w-20 bg-stone-800" />
                <Skeleton className="h-4 w-full bg-stone-800" />
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function RunWorkspaceSkeleton() {
  return (
    <section className="flex min-h-0 flex-col gap-2 p-0.5 xl:grid xl:h-full xl:grid-rows-[auto_auto_minmax(0,1fr)_auto] xl:overflow-hidden">
      <WorkspaceHeaderSkeleton />

      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:min-h-0 xl:grid-cols-3">
        <BoardColumnSkeleton titleWidth="w-24" tone="amber" />
        <BoardColumnSkeleton titleWidth="w-28" tone="cyan" />
        <BoardColumnSkeleton titleWidth="w-28" tone="emerald" />
      </div>

      <TerminalFeedSkeleton />
    </section>
  );
}

export function RunWorkspaceView({
  data,
  isResuming = false,
  onResume,
}: {
  data: WorkspacePayload;
  isResuming?: boolean;
  onResume?: (() => void) | undefined;
}) {
  const taskColumns = groupTasks(data.tasks);
  const handoffCount = data.usage.filter((item) => item.category === "agent_handoff").length;
  const toolCount = data.usage.filter((item) => item.category === "tool").length;
  const chatCount = data.usage.filter((item) => item.category === "chat").length;
  const actionRequired = buildFallbackActionRequired(data);
  const blockingToolkits = data.toolPreflight?.toolkits.filter(
    (toolkit) => toolkit.readiness.status !== "ready",
  ) ?? [];

  return (
    <section className="flex min-h-0 flex-col gap-2 p-0.5 xl:grid xl:h-full xl:grid-rows-[auto_auto_minmax(0,1fr)_auto] xl:overflow-hidden">
      <Card className="hidden overflow-hidden border-none xl:block">
        <CardHeader className="-mt-2">
          <div className="flex flex-col gap-4">
            <div className="min-w-0 space-y-3">
              <CardTitle className="w-full font-serif text-lg leading-tight">
                {data.run.objective}
              </CardTitle>
              <p className="max-w-5xl text-sm text-muted-foreground">
                {data.run.finalSummary ?? data.run.readinessSummary}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{data.run.executionMode.replace("_", " ")}</Badge>
                <Badge variant="outline">{data.run.status}</Badge>
                <Badge variant="outline">
                  Updated {formatDistanceToNowStrict(new Date(data.run.updatedAt))} ago
                </Badge>
              </div>
              {actionRequired ? (
                <div className="space-y-3 border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{actionRequired.title}</p>
                    <p className="text-muted-foreground">{actionRequired.body}</p>
                    {actionRequired.blockingTaskTitle ? (
                      <p className="text-xs text-muted-foreground">
                        Blocked task: {actionRequired.blockingTaskTitle}
                      </p>
                    ) : null}
                  </div>
                  {data.toolPreflight?.toolkits.length ? (
                    <div className="flex flex-wrap gap-2">
                      {data.toolPreflight.toolkits.map((toolkit) => (
                        <Badge
                          key={toolkit.slug}
                          variant={toolkit.readiness.status === "ready" ? "default" : "outline"}
                        >
                          {toolkit.title}: {toolkit.readiness.status.replaceAll("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {actionRequired.canResume && onResume ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onResume}
                        disabled={isResuming}
                      >
                        <PlayIcon className="size-3.5" />
                        {isResuming ? "Resuming..." : actionRequired.resumeLabel ?? "Resume"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 2xl:grid-cols-4">
        <StatCard icon={BotIcon} label="Chat turns" value={chatCount} />
        <StatCard icon={WrenchIcon} label="Tool records" value={toolCount} />
        <StatCard icon={ActivityIcon} label="Agent handoffs" value={handoffCount} />
        <StatCard icon={ClipboardListIcon} label="Tasks" value={data.tasks.length} />
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:min-h-0 lg:grid-cols-3">
          <BoardColumn
            title="Waiting"
            tasks={taskColumns.waiting}
            tone="amber"
            blockedMessage={
              actionRequired?.reason === "tool_prerequisites_missing"
                ? "This run is waiting on tool connections before work can continue."
                : null
            }
          />
          <BoardColumn title="Underway" tasks={taskColumns.underway} tone="cyan" />
          <BoardColumn title="Complete" tasks={taskColumns.complete} tone="emerald" />
      </div>

      <Accordion
        className="min-h-0"
        defaultValue={
          actionRequired?.reason === "tool_prerequisites_missing" && blockingToolkits.length > 0
            ? ["required-apps"]
            : []
        }
        type="multiple"
      >
        {actionRequired?.reason === "tool_prerequisites_missing" && blockingToolkits.length > 0 ? (
          <AccordionItem
            className="overflow-hidden border border-border bg-background"
            value="required-apps"
          >
            <AccordionTrigger className="w-full border-b px-4 py-3 hover:no-underline">
              <span className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Required Apps
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <div className="p-4">
                <ToolConnectionChecklist
                  requiredToolkitSlugs={blockingToolkits.map((toolkit) => toolkit.slug)}
                  readiness={blockingToolkits.map((toolkit) => toolkit.readiness)}
                  nextPath={`/dashboard/runs?runId=${data.run.id}`}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        ) : null}
        <AccordionItem
          className="overflow-hidden border border-stone-800 bg-stone-950 text-stone-50"
          value="terminal"
        >
          <AccordionTrigger className="w-full border-b border-stone-800 px-4 py-3 text-stone-100 hover:no-underline">
            <span className="text-sm font-medium uppercase tracking-[0.18em] text-stone-300">
              Terminal
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <div className="max-h-[420px] overflow-y-auto xl:max-h-[38vh]">
              <TerminalFeed events={data.events} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

export function RunWorkspace({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: dashboardQueryKeys.runs.workspace(runId),
    queryFn: () => fetchWorkspace(runId),
    staleTime: dashboardQueryTimings.runWorkspace.staleTime,
  });

  const advanceMutation = useMutation({
    mutationFn: () => advanceWorkspace(runId),
    onSuccess: (payload) => {
      queryClient.setQueryData(dashboardQueryKeys.runs.workspace(runId), payload);
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.notifications.all,
      });
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Unable to advance run.",
      );
    },
  });
  const resumeMutation = useMutation({
    mutationFn: () => resumeWorkspace(runId),
    onSuccess: (payload) => {
      queryClient.setQueryData(dashboardQueryKeys.runs.workspace(runId), payload);
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.notifications.all,
      });
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "Unable to resume run.",
      );
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.run.status === "completed" || data.run.status === "failed") {
      return;
    }

    if (data.run.status === "blocked" && !data.run.actionRequired?.autoResume) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (data.run.status === "blocked" && data.run.actionRequired?.autoResume) {
        if (!resumeMutation.isPending) {
          resumeMutation.mutate();
        }
        return;
      }

      if (!advanceMutation.isPending) {
        advanceMutation.mutate();
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    advanceMutation,
    data,
    data?.run.actionRequired?.autoResume,
    data?.run.status,
    data?.run.updatedAt,
    resumeMutation,
  ]);

  if (isLoading) {
    return <RunWorkspaceSkeleton />;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Unable to load run."}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <RunWorkspaceView
        data={data}
        isResuming={resumeMutation.isPending}
        onResume={() => resumeMutation.mutate()}
      />
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card className="min-w-0 p-0">
      <CardContent className="flex items-center gap-3 py-3">
        <div className="flex size-7 items-center justify-center border bg-muted">
          <Icon className="size-4" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BoardColumn({
  title,
  tasks,
  tone,
  blockedMessage,
}: {
  title: string;
  tasks: RunTask[];
  tone: "amber" | "cyan" | "emerald";
  blockedMessage?: string | null;
}) {
  return (
    <Card
      className={cn(
        "min-h-[280px] overflow-hidden py-0 lg:h-full lg:min-h-0",
        tone === "amber" && "border-chart-2/40",
        tone === "cyan" && "border-chart-3/40",
        tone === "emerald" && "border-chart-1/40",
      )}
    >
      <CardHeader className="border-b py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="font-serif text-xl leading-none sm:text-2xl">{title}</CardTitle>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 p-0 -mt-4">
        <ScrollArea className="h-full">
          <div className="space-y-3 p-4">
            {blockedMessage ? (
              <div className="border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                {blockedMessage}
              </div>
            ) : null}
            {tasks.length === 0 ? (
              <Empty className="border-border">
                <EmptyHeader>
                  <EmptyTitle>No tasks in {title.toLowerCase()}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              tasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
