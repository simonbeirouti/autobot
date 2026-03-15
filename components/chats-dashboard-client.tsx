"use client";

import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock3Icon, FolderKanbanIcon, MessageSquareIcon, PlusIcon } from "lucide-react";

import { useProject } from "@/components/providers/project-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  WorkspaceSidebarPanel,
  WorkspaceSidebarSkeleton,
  WorkspaceSplitLayout,
} from "@/components/workspace-layout";
import {
  dashboardQueryKeys,
  dashboardQueryTimings,
  fetchJson,
} from "@/lib/query/dashboard";
import type {
  ProjectChatMessage,
  ProjectChatResponse,
  ProjectChatStreamEvent,
  ProjectWorkspace,
} from "@/lib/projects/types";
import { cn } from "@/lib/utils";

function buildProjectsHref(pathname: string, threadId?: string | null) {
  if (!threadId) {
    return pathname;
  }

  const params = new URLSearchParams();
  params.set("threadId", threadId);
  return `${pathname}?${params.toString()}`;
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

function createLocalChatMessage(
  partial: Pick<ProjectChatMessage, "content" | "role"> &
    Partial<Omit<ProjectChatMessage, "content" | "role">>,
): ProjectChatMessage {
  const createdAt = partial.createdAt ?? new Date().toISOString();

  return {
    id: partial.id ?? crypto.randomUUID(),
    threadId: partial.threadId ?? "pending-thread",
    projectId: partial.projectId ?? "pending-project",
    objectiveId: partial.objectiveId ?? null,
    userId: partial.userId ?? "local-user",
    role: partial.role,
    content: partial.content,
    agentId: partial.agentId ?? null,
    citedMemoryIds: partial.citedMemoryIds ?? [],
    createdAt,
  };
}

async function streamProjectChat(
  projectId: string,
  payload: {
    message: string;
    objectiveId?: string | null;
    threadId?: string | null;
  },
  onEvent: (event: ProjectChatStreamEvent) => void,
) {
  const response = await fetch(`/api/projects/${projectId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorPayload?.error ?? "Unable to send project message.");
  }

  if (!response.body) {
    throw new Error("Chat response stream is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalEvent: ProjectChatResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data: "));

      if (!dataLine) {
        continue;
      }

      const event = JSON.parse(dataLine.slice(6)) as ProjectChatStreamEvent;
      onEvent(event);

      if (event.type === "error") {
        throw new Error(event.error);
      }

      if (event.type === "final") {
        finalEvent = event;
      }
    }

    if (done) {
      break;
    }
  }

  if (!finalEvent) {
    throw new Error("Chat response stream ended before the assistant finished responding.");
  }

  return finalEvent;
}

function ChatsDashboardSkeleton() {
  return (
    <WorkspaceSplitLayout
      sidebar={<WorkspaceSidebarSkeleton titleWidth="w-0" descriptionWidth="w-0" itemCount={5} />}
      content={
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] border bg-background">
          <div className="border-b px-4 py-4">
            <Skeleton className="h-full min-h-[320px] w-full" />
          </div>
          <div className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
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
          "max-w-[85%] border px-4 py-3 text-sm",
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

export function ChatsDashboardClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { activeProject, activeProjectId, isLoading } = useProject();
  const [draftMessage, setDraftMessage] = useState("");
  const [isStartingNewThread, setIsStartingNewThread] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ProjectChatMessage[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const messageScrollerRef = useRef<HTMLDivElement | null>(null);

  const requestedThreadId = searchParams.get("threadId");
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
  const activeThread = isStartingNewThread ? null : workspace?.activeThread ?? null;
  const persistedMessages = isStartingNewThread ? [] : (workspace?.messages ?? []);
  const visibleMessages = [...persistedMessages, ...optimisticMessages];

  useEffect(() => {
    setIsStartingNewThread(false);
    setDraftMessage("");
    setOptimisticMessages([]);
    setStreamError(null);
  }, [activeProjectId]);

  useEffect(() => {
    if (requestedThreadId) {
      setIsStartingNewThread(false);
    }

    setOptimisticMessages([]);
    setStreamError(null);
  }, [requestedThreadId]);

  useEffect(() => {
    const viewport = messageScrollerRef.current?.querySelector<HTMLDivElement>(
      "[data-slot='scroll-area-viewport']",
    );
    const container = viewport ?? messageScrollerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [persistedMessages, optimisticMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({
      message,
      threadId,
      objectiveId,
    }: {
      message: string;
      threadId?: string | null;
      objectiveId?: string | null;
    }) => {
      if (!activeProjectId) {
        throw new Error("A project must be selected before sending a message.");
      }

      const createdAt = new Date().toISOString();
      const optimisticUserMessage = createLocalChatMessage({
        content: message,
        createdAt,
        objectiveId: objectiveId ?? null,
        projectId: activeProjectId,
        role: "user",
        threadId: threadId ?? "pending-thread",
      });
      const optimisticAssistantMessage = createLocalChatMessage({
        content: "",
        createdAt,
        objectiveId: objectiveId ?? null,
        projectId: activeProjectId,
        role: "assistant",
        threadId: threadId ?? "pending-thread",
      });

      setStreamError(null);
      setOptimisticMessages([optimisticUserMessage, optimisticAssistantMessage]);

      return streamProjectChat(
        activeProjectId,
        { message, objectiveId, threadId },
        (event) => {
          if (event.type === "thread") {
            setOptimisticMessages((currentMessages) =>
              currentMessages.map((currentMessage) => ({
                ...currentMessage,
                threadId: event.threadId,
              })),
            );
            return;
          }

          if (event.type === "route") {
            setOptimisticMessages((currentMessages) =>
              currentMessages.map((currentMessage) =>
                currentMessage.id === optimisticAssistantMessage.id
                  ? { ...currentMessage, agentId: event.routedAgentId }
                  : currentMessage,
              ),
            );
            return;
          }

          if (event.type === "token") {
            setOptimisticMessages((currentMessages) =>
              currentMessages.map((currentMessage) =>
                currentMessage.id === optimisticAssistantMessage.id
                  ? { ...currentMessage, content: `${currentMessage.content}${event.text}` }
                  : currentMessage,
              ),
            );
          }
        },
      );
    },
    onSuccess: async (response) => {
      if (!activeProjectId) {
        return;
      }

      setIsStartingNewThread(false);
      setOptimisticMessages([]);
      await queryClient.invalidateQueries({
        queryKey: ["project-workspace", activeProjectId],
      });
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.projects.all,
      });
      startTransition(() => {
        router.replace(buildProjectsHref(pathname, response.threadId), { scroll: false });
      });
    },
    onError: async (error) => {
      if (activeProjectId) {
        await queryClient.invalidateQueries({
          queryKey: ["project-workspace", activeProjectId],
        });
        await queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.projects.all,
        });
      }

      setOptimisticMessages([]);
      setStreamError(error instanceof Error ? error.message : "Unable to send project message.");
    },
  });

  function submitMessage() {
    const message = draftMessage.trim();
    if (!message || sendMessageMutation.isPending) {
      return;
    }

    setDraftMessage("");
    setStreamError(null);
    sendMessageMutation.mutate({
      message,
      objectiveId: isStartingNewThread ? null : activeThread?.objectiveId ?? null,
      threadId: isStartingNewThread ? null : activeThread?.id,
    });
  }

  function startNewThread() {
    setIsStartingNewThread(true);
    setDraftMessage("");
    startTransition(() => {
      router.replace(buildProjectsHref(pathname), { scroll: false });
    });
  }

  if (isLoading) {
    return <ChatsDashboardSkeleton />;
  }

  if (!activeProjectId || !activeProject) {
    return (
      <div className="flex min-h-[420px] items-center justify-center border">
        <div className="flex max-w-sm flex-col items-center gap-3 px-6 py-10 text-center">
          <FolderKanbanIcon className="size-5 text-muted-foreground" />
          <div className="text-sm font-medium">Create or select a project</div>
          <div className="text-sm text-muted-foreground">
            Projects are the containers for objectives, assets, and project-scoped chats.
          </div>
        </div>
      </div>
    );
  }

  if (projectWorkspaceQuery.isLoading || !workspace) {
    return <ChatsDashboardSkeleton />;
  }

  const threadsPanel = (
    <WorkspaceSidebarPanel
      className="min-h-[220px] max-h-[32svh] xl:max-h-none"
      headerAction={
        <Button
          className="w-full justify-start"
          onClick={startNewThread}
          type="button"
          variant="outline"
        >
          <PlusIcon className="size-4" />
          New thread
        </Button>
      }
    >
      <div className="space-y-2">
        {workspace.threads.length === 0 ? (
          <div className="px-4 py-2 text-sm text-muted-foreground">No threads yet.</div>
        ) : (
          workspace.threads.map((thread) => {
            const isActive = thread.id === activeThread?.id && !isStartingNewThread;

            return (
              <Button
                className={cn(
                  "h-auto w-full items-start justify-start border border-border p-0 text-left whitespace-normal",
                  isActive && "border-primary bg-muted",
                )}
                key={thread.id}
                onClick={() => {
                  setIsStartingNewThread(false);
                  setDraftMessage("");
                  startTransition(() => {
                    router.replace(buildProjectsHref(pathname, thread.id), { scroll: false });
                  });
                }}
                type="button"
                variant="ghost"
              >
                <div className="w-full space-y-4 p-4">
                  <div className="space-y-2">
                    <h2 className="text-sm font-medium" title={thread.title ?? "Untitled thread"}>
                      {thread.title || "Untitled thread"}
                    </h2>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3Icon className="size-3.5" />
                    <span>Updated {formatDistanceToNowStrict(new Date(thread.updatedAt))} ago</span>
                  </div>
                </div>
              </Button>
            );
          })
        )}
      </div>
    </WorkspaceSidebarPanel>
  );

  const chatContent = (
    <div className="flex h-full min-h-0 flex-col border bg-background">
      <div className="min-h-0 flex-1 border-b">
        <div className="h-full px-2 py-2" ref={messageScrollerRef}>
          <ScrollArea className="h-full pr-2">
            <div className="min-h-full">
              {visibleMessages.length > 0 ? (
                <div className="flex min-h-full flex-col justify-end py-2">
                  <div className="space-y-4">
                    {visibleMessages.map((message) => (
                      <MessageBubble
                        agentId={message.agentId}
                        content={message.content || (sendMessageMutation.isPending ? "Thinking..." : "")}
                        createdAt={message.createdAt}
                        key={message.id}
                        role={message.role}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-full min-w-full items-center justify-center px-6 py-10">
                  <div className="flex max-w-sm flex-col items-center gap-3 px-6 py-10 text-center">
                    <MessageSquareIcon className="size-5 text-muted-foreground" />
                    <div className="text-sm font-medium">No messages yet</div>
                    <div className="text-sm text-muted-foreground">
                      {isStartingNewThread
                        ? "Start a new thread for this project."
                        : "Select a thread or start a new conversation."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="shrink-0 px-2 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {streamError ? (
          <div className="mb-2 border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {streamError}
          </div>
        ) : null}
        <form
          className="flex items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitMessage();
          }}
        >
          <Textarea
            className="min-h-0 flex-1 resize-none text-sm"
            onChange={(event) => setDraftMessage(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.nativeEvent.isComposing &&
                (!event.shiftKey || event.metaKey || event.ctrlKey)
              ) {
                event.preventDefault();
                submitMessage();
              }
            }}
            placeholder={`Ask about ${activeProject.name}...`}
            rows={2}
            value={draftMessage}
          />
          <Button disabled={draftMessage.trim().length === 0 || sendMessageMutation.isPending} type="submit">
            {sendMessageMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <WorkspaceSplitLayout
      sidebar={threadsPanel}
      content={chatContent}
    />
  );
}
