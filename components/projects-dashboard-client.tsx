"use client";

import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
  BotIcon,
  FolderKanbanIcon,
  HistoryIcon,
  MessageSquareIcon,
  PackageIcon,
  PlusIcon,
  TargetIcon,
} from "lucide-react";

import { useProject } from "@/components/providers/project-provider";
import {
  WorkspaceSidebarPanel,
  WorkspaceSidebarSkeleton,
  WorkspaceSplitLayout,
} from "@/components/workspace-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  dashboardQueryKeys,
  dashboardQueryTimings,
  fetchJson,
} from "@/lib/query/dashboard";
import type {
  Objective,
  ProjectChatResponse,
  ProjectWorkspace,
} from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type TimelineItem =
  | {
      id: string;
      type: "thread";
      title: string;
      description: string;
      timestamp: string;
      objectiveId: string | null;
      isActive: boolean;
      onClick: () => void;
    }
  | {
      id: string;
      type: "memory";
      title: string;
      description: string;
      timestamp: string;
      scope: string;
      kind: string;
      objectiveId: string | null;
    };

function buildProjectsHref(
  pathname: string,
  options: { threadId?: string | null; objectiveId?: string | null },
) {
  const params = new URLSearchParams();
  if (options.threadId) {
    params.set("threadId", options.threadId);
  }
  if (options.objectiveId) {
    params.set("objectiveId", options.objectiveId);
  }

  return params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
}

async function fetchProjectWorkspace(projectId: string, threadId?: string | null) {
  const params = new URLSearchParams();
  if (threadId) {
    params.set("threadId", threadId);
  }

  return fetchJson<ProjectWorkspace>(
    `/api/projects/${projectId}${params.size > 0 ? `?${params.toString()}` : ""}`,
  );
}

function ProjectsDashboardSkeleton() {
  return (
    <WorkspaceSplitLayout
      sidebar={<WorkspaceSidebarSkeleton titleWidth="w-40" descriptionWidth="w-4/5" itemCount={4} />}
      content={
        <Card className="min-h-[420px]">
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      }
    />
  );
}

function MessageBubble({
  role,
  content,
  agentId,
  createdAt,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  agentId: string | null;
  createdAt: string;
}) {
  const isUser = role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl border px-4 py-3 text-sm shadow-sm",
          isUser
            ? "border-primary/30 bg-primary/10 text-foreground"
            : "border-border bg-card text-card-foreground",
        )}
      >
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>{isUser ? "You" : agentId ?? role}</span>
          <span>{formatDistanceToNowStrict(new Date(createdAt))} ago</span>
        </div>
        <div className="whitespace-pre-wrap leading-6">{content}</div>
      </div>
    </div>
  );
}

function getObjectiveSummary(objective: Objective) {
  return objective.description.trim() || "No summary yet. Use intake to define the outcome.";
}

export function ProjectsDashboardClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { activeProject, activeProjectId, isLoading } = useProject();
  const [draftMessage, setDraftMessage] = useState("");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [isStartingNewThread, setIsStartingNewThread] = useState(false);
  const messageScrollerRef = useRef<HTMLDivElement | null>(null);

  const requestedThreadId = searchParams.get("threadId");
  const requestedObjectiveId = searchParams.get("objectiveId");
  const deferredProjectId = useDeferredValue(activeProjectId);

  const projectWorkspaceQuery = useQuery({
    queryKey: deferredProjectId
      ? dashboardQueryKeys.projects.workspace(deferredProjectId, requestedThreadId)
      : dashboardQueryKeys.projects.workspace("pending"),
    queryFn: () => fetchProjectWorkspace(deferredProjectId!, requestedThreadId),
    enabled: Boolean(deferredProjectId),
    staleTime: dashboardQueryTimings.projectWorkspace.staleTime,
  });

  const workspace = projectWorkspaceQuery.data;
  const visibleMessages = isStartingNewThread ? [] : (workspace?.messages ?? []);
  const activeThread = isStartingNewThread ? null : workspace?.activeThread ?? null;

  useEffect(() => {
    setIsStartingNewThread(false);
    setSelectedObjectiveId(null);
    setDraftMessage("");
  }, [activeProjectId]);

  useEffect(() => {
    if (requestedThreadId) {
      setIsStartingNewThread(false);
    }
  }, [requestedThreadId]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    if (requestedObjectiveId) {
      setSelectedObjectiveId(requestedObjectiveId);
      return;
    }

    if (activeThread?.objectiveId !== undefined) {
      setSelectedObjectiveId(activeThread.objectiveId);
      return;
    }

    setSelectedObjectiveId((current) =>
      current && workspace.objectives.some((objective) => objective.id === current)
        ? current
        : null,
    );
  }, [activeThread?.objectiveId, requestedObjectiveId, workspace]);

  useEffect(() => {
    const container = messageScrollerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [isStartingNewThread, workspace?.messages]);

  const selectedObjective =
    workspace?.objectives.find((objective) => objective.id === selectedObjectiveId) ?? null;

  const timelineItems: TimelineItem[] = workspace
    ? [
        ...workspace.threads.map<TimelineItem>((thread) => ({
          id: thread.id,
          type: "thread",
          title: thread.title || "Untitled thread",
          description: thread.objectiveId
            ? workspace.objectives.find((objective) => objective.id === thread.objectiveId)?.title ??
              "Objective thread"
            : "Project-wide chat",
          timestamp: thread.updatedAt,
          objectiveId: thread.objectiveId,
          isActive: thread.id === activeThread?.id && !isStartingNewThread,
          onClick: () => {
            setIsStartingNewThread(false);
            setSelectedObjectiveId(thread.objectiveId);
            startTransition(() => {
              router.replace(
                buildProjectsHref(pathname, {
                  threadId: thread.id,
                  objectiveId: thread.objectiveId,
                }),
                { scroll: false },
              );
            });
          },
        })),
        ...workspace.recentMemories.map<TimelineItem>((memory) => ({
          id: memory.id,
          type: "memory",
          title: memory.summary,
          description: memory.content,
          timestamp: memory.updatedAt,
          scope: memory.scope,
          kind: memory.kind,
          objectiveId: memory.objectiveId,
        })),
      ].toSorted(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      )
    : [];

  const sendMessageMutation = useMutation({
    mutationFn: async ({
      message,
      objectiveId,
      threadId,
    }: {
      message: string;
      objectiveId?: string | null;
      threadId?: string | null;
    }) =>
      fetchJson<ProjectChatResponse>(`/api/projects/${activeProjectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, objectiveId, threadId }),
      }),
    onSuccess: async (response, variables) => {
      if (!activeProjectId) {
        return;
      }

      setDraftMessage("");
      setIsStartingNewThread(false);
      await queryClient.invalidateQueries({
        queryKey: ["project-workspace", activeProjectId],
      });
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.projects.all,
      });
      startTransition(() => {
        router.replace(
          buildProjectsHref(pathname, {
            threadId: response.threadId,
            objectiveId: variables.objectiveId ?? null,
          }),
          { scroll: false },
        );
      });
    },
  });

  if (isLoading) {
    return <ProjectsDashboardSkeleton />;
  }

  if (!activeProjectId || !activeProject) {
    return (
      <Card className="min-h-[420px]">
        <CardContent className="flex h-full items-center justify-center">
          <Empty className="border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderKanbanIcon />
              </EmptyMedia>
              <EmptyTitle>Create or select a project</EmptyTitle>
              <EmptyDescription>
                Projects are the containers for objectives, assets, and project-scoped chats.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  if (projectWorkspaceQuery.isLoading || !workspace) {
    return <ProjectsDashboardSkeleton />;
  }

  return (
    <WorkspaceSplitLayout
      sidebar={
        <WorkspaceSidebarPanel
          title={activeProject.name}
          description="Projects contain objectives, assets, and chats. Create new objectives from the dashboard intake."
          headerAction={
            <Button
              onClick={() => router.push("/dashboard")}
              size="sm"
              type="button"
              variant="outline"
            >
              <PlusIcon className="mr-2 size-4" />
              New objective
            </Button>
          }
        >
          <div className="space-y-4 py-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                  {activeProject.iconKey}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{activeProject.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Updated {formatDistanceToNowStrict(new Date(activeProject.updatedAt))} ago
                  </div>
                </div>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{activeProject.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary">{workspace.objectives.length} objectives</Badge>
                <Badge variant="secondary">{workspace.assets.length} assets</Badge>
                <Badge variant="secondary">{workspace.threads.length} threads</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <TargetIcon className="size-3.5" />
                Objectives
              </div>

              <button
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition hover:border-primary/40 hover:bg-accent/30",
                  selectedObjectiveId === null && isStartingNewThread && "border-primary/50 bg-primary/5",
                )}
                onClick={() => {
                  setSelectedObjectiveId(null);
                  setIsStartingNewThread(true);
                  startTransition(() => {
                    router.replace(buildProjectsHref(pathname, {}), { scroll: false });
                  });
                }}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Project-wide chat</div>
                  <Badge variant="outline">
                    {workspace.threads.filter((thread) => thread.objectiveId === null).length} threads
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Ask about the whole project without tying the thread to a single objective.
                </div>
              </button>

              {workspace.objectives.length === 0 ? (
                <Empty className="border-border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <TargetIcon />
                    </EmptyMedia>
                    <EmptyTitle>No objectives yet</EmptyTitle>
                    <EmptyDescription>
                      Create the first objective for {activeProject.name} from the dashboard intake.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                workspace.objectives.map((objective) => {
                  const isSelected =
                    selectedObjectiveId === objective.id &&
                    (isStartingNewThread || activeThread?.objectiveId === objective.id);

                  return (
                    <button
                      className={cn(
                        "w-full rounded-xl border p-4 text-left transition hover:border-primary/40 hover:bg-accent/30",
                        isSelected && "border-primary/50 bg-primary/5",
                      )}
                      key={objective.id}
                      onClick={() => {
                        setSelectedObjectiveId(objective.id);
                        setIsStartingNewThread(true);
                        startTransition(() => {
                          router.replace(
                            buildProjectsHref(pathname, { objectiveId: objective.id }),
                            { scroll: false },
                          );
                        });
                      }}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{objective.title}</div>
                          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {getObjectiveSummary(objective)}
                          </div>
                        </div>
                        <Badge variant={objective.status === "active" ? "default" : "secondary"}>
                          {objective.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <MessageSquareIcon className="size-3.5" />
                        <span>
                          {
                            workspace.threads.filter((thread) => thread.objectiveId === objective.id)
                              .length
                          }{" "}
                          threads
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </WorkspaceSidebarPanel>
      }
      content={
        <div className="grid h-full gap-2 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <CardTitle className="text-2xl">{activeProject.name}</CardTitle>
                  <CardDescription className="max-w-3xl text-sm leading-6">
                    {activeProject.description}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    <BotIcon className="mr-1 size-3.5" />
                    LangGraph project memory
                  </Badge>
                  <Badge variant="outline">
                    {workspace.objectives.length} objectives
                  </Badge>
                  <Badge variant="outline">
                    {workspace.threads.length} {workspace.threads.length === 1 ? "thread" : "threads"}
                  </Badge>
                  <Badge variant="outline">
                    {workspace.recentMemories.length} memories
                  </Badge>
                  <Badge variant="outline">
                    {workspace.assets.length} assets
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedObjective ? selectedObjective.title : "General project context"}
                </CardTitle>
                <CardDescription className="text-sm leading-6">
                  {selectedObjective
                    ? getObjectiveSummary(selectedObjective)
                    : "Use a general project thread for cross-objective planning, risks, decisions, and coordination."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setIsStartingNewThread(true);
                      startTransition(() => {
                        router.replace(
                          buildProjectsHref(pathname, { objectiveId: selectedObjectiveId }),
                          { scroll: false },
                        );
                      });
                    }}
                    size="sm"
                    type="button"
                  >
                    <PlusIcon className="mr-2 size-4" />
                    New {selectedObjective ? "objective" : "project"} thread
                  </Button>
                  {!isStartingNewThread && activeThread ? (
                    <Badge variant="secondary">
                      Continuing thread from{" "}
                      {formatDistanceToNowStrict(new Date(activeThread.updatedAt))} ago
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Next message starts a fresh thread</Badge>
                  )}
                </div>

                {workspace.assets.length > 0 ? (
                  <div className="rounded-xl border bg-muted/15 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      <PackageIcon className="size-3.5" />
                      Linked assets
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {workspace.assets.slice(0, 6).map((asset) => (
                        <Badge key={asset.id} variant="outline">
                          {asset.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <HistoryIcon className="size-3.5" />
                  Project context
                </div>
                <CardDescription>
                  Threads and durable memory stay inside {activeProject.name}. Most recent items appear first.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {timelineItems.length === 0 ? (
                  <Empty className="border-border">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HistoryIcon />
                      </EmptyMedia>
                      <EmptyTitle>No context yet</EmptyTitle>
                      <EmptyDescription>
                        Start the first project or objective thread to populate short-term and long-term context.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex gap-3 pb-1">
                      {timelineItems.map((item) =>
                        item.type === "thread" ? (
                          <button
                            className={cn(
                              "w-[260px] shrink-0 rounded-xl border p-4 text-left transition hover:border-primary/40 hover:bg-accent/30",
                              item.isActive && "border-primary/50 bg-primary/5 shadow-sm",
                            )}
                            key={`thread-${item.id}`}
                            onClick={item.onClick}
                            type="button"
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <Badge variant={item.isActive ? "default" : "secondary"}>
                                thread
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNowStrict(new Date(item.timestamp))} ago
                              </span>
                            </div>
                            <div className="line-clamp-2 text-sm font-medium">{item.title}</div>
                            <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                              {item.description}
                            </div>
                          </button>
                        ) : (
                          <div
                            className="w-[280px] shrink-0 rounded-xl border bg-muted/20 p-4"
                            key={`memory-${item.id}`}
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{item.scope}</Badge>
                                <Badge variant="outline">{item.kind}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNowStrict(new Date(item.timestamp))} ago
                              </span>
                            </div>
                            <div className="line-clamp-2 text-sm font-medium">{item.title}</div>
                            <div className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                              {item.description}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="min-h-[420px] overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedObjective ? `${selectedObjective.title} chat` : "Project chat"}
              </CardTitle>
              <CardDescription>
                Questions are routed by the orchestrator to the right specialist agent, but only within the active project context.
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="grid h-full gap-6 pt-6 xl:grid-rows-[minmax(0,1fr)_auto]">
              <div className="min-h-0 rounded-xl border bg-muted/10">
                <div className="h-full min-h-[260px] px-4 py-4">
                  <ScrollArea className="h-full pr-2">
                    <div className="space-y-4" ref={messageScrollerRef}>
                      {visibleMessages.length > 0 ? (
                        visibleMessages.map((message) => (
                          <MessageBubble
                            agentId={message.agentId}
                            content={message.content}
                            createdAt={message.createdAt}
                            key={message.id}
                            role={message.role}
                          />
                        ))
                      ) : (
                        <div className="flex h-full min-h-[220px] items-center justify-center">
                          <Empty className="border-border">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <MessageSquareIcon />
                              </EmptyMedia>
                              <EmptyTitle>No messages yet</EmptyTitle>
                              <EmptyDescription>
                                {isStartingNewThread
                                  ? `Start a new ${selectedObjective ? "objective" : "project"} thread.`
                                  : "Select a thread or start a new conversation to build project context."}
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <div className="space-y-3">
                <Textarea
                  className="min-h-36"
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder={
                    selectedObjective
                      ? `Ask about ${selectedObjective.title}...`
                      : `Ask about ${activeProject.name}...`
                  }
                  value={draftMessage}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Short-term memory stays inside the active thread. Durable project facts can be promoted into long-term memory after each exchange.
                  </div>
                  <Button
                    disabled={draftMessage.trim().length === 0 || sendMessageMutation.isPending}
                    onClick={() => {
                      if (!draftMessage.trim()) {
                        return;
                      }

                      sendMessageMutation.mutate({
                        message: draftMessage,
                        objectiveId: isStartingNewThread
                          ? selectedObjectiveId
                          : activeThread?.objectiveId ?? selectedObjectiveId,
                        threadId: isStartingNewThread ? null : activeThread?.id,
                      });
                    }}
                    type="button"
                  >
                    {sendMessageMutation.isPending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    />
  );
}
