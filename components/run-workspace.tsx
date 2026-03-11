"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspacePayload, RunTask, RunEvent } from "@/lib/runs/types";

const colorClassMap: Record<string, string> = {
  amber: "text-amber-300 border-amber-300/30 bg-amber-300/10",
  cyan: "text-cyan-300 border-cyan-300/30 bg-cyan-300/10",
  emerald: "text-emerald-300 border-emerald-300/30 bg-emerald-300/10",
  rose: "text-rose-300 border-rose-300/30 bg-rose-300/10",
};

async function fetchWorkspace(runId: string) {
  const response = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
  const payload = (await response.json()) as WorkspacePayload & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load run.");
  }
  return payload;
}

async function advanceWorkspace(runId: string) {
  const response = await fetch(`/api/runs/${runId}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const payload = (await response.json()) as WorkspacePayload & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to advance run.");
  }
  return payload;
}

function groupTasks(tasks: RunTask[]) {
  return {
    waiting: tasks.filter((task) => task.status === "waiting"),
    underway: tasks.filter((task) => task.status === "underway"),
    complete: tasks.filter((task) => task.status === "complete"),
  };
}

function TaskCard({ task }: { task: RunTask }) {
  return (
    <article className="rounded-3xl border border-black/10 bg-white/85 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{task.title}</h3>
        {task.agentLabel ? (
          <Badge variant="secondary">{task.agentLabel}</Badge>
        ) : null}
      </div>
      {task.description ? (
        <p className="mt-3 text-sm text-foreground/65">{task.description}</p>
      ) : null}
    </article>
  );
}

function EventRow({ event }: { event: RunEvent }) {
  const colorToken = event.colorToken ?? "amber";
  return (
    <div className="grid grid-cols-[auto_auto_1fr] gap-3 border-b border-white/8 px-4 py-3 text-sm last:border-b-0">
      <span className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
        {new Date(event.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.18em]",
          colorClassMap[colorToken] ?? colorClassMap.amber,
        )}
      >
        {event.agentLabel ?? event.type}
      </span>
      <span className="font-mono text-stone-200">{event.message}</span>
    </div>
  );
}

export function RunWorkspace({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["run-workspace", runId],
    queryFn: () => fetchWorkspace(runId),
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const advanceMutation = useMutation({
    mutationFn: () => advanceWorkspace(runId),
    onSuccess: (payload) => {
      queryClient.setQueryData(["run-workspace", runId], payload);
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.run.status === "completed" || data.run.status === "failed") {
      return;
    }

    const interval = window.setInterval(() => {
      if (!advanceMutation.isPending) {
        advanceMutation.mutate();
      }
    }, 3_200);

    return () => window.clearInterval(interval);
  }, [advanceMutation, data]);

  if (isLoading) {
    return <div className="py-10 text-sm text-foreground/60">Loading run workspace...</div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-6 text-sm text-rose-900">
        {error instanceof Error ? error.message : "Unable to load run."}
      </div>
    );
  }

  const taskColumns = groupTasks(data.tasks);
  const handoffCount = data.usage.filter((item) => item.category === "agent_handoff").length;
  const toolCount = data.usage.filter((item) => item.category === "tool").length;
  const chatCount = data.usage.filter((item) => item.category === "chat").length;

  return (
    <section className="grid h-full min-h-0 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="flex min-h-0 flex-col gap-6">
        <div className="rounded-[2rem] border border-black/10 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(240,244,236,0.95))] p-6 shadow-[0_24px_50px_rgba(59,45,21,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-foreground/45">
                Live Run
              </p>
              <h1 className="font-serif text-4xl leading-tight">{data.run.objective}</h1>
              <p className="max-w-3xl text-sm text-foreground/70">
                {data.run.finalSummary ?? data.run.readinessSummary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{data.run.executionMode.replace("_", " ")}</Badge>
              <Badge variant="outline">{data.run.status}</Badge>
              <Badge variant="outline">
                Updated {formatDistanceToNowStrict(new Date(data.run.updatedAt))} ago
              </Badge>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <StatCard label="Chat turns" value={chatCount} />
            <StatCard label="Tool records" value={toolCount} />
            <StatCard label="Agent handoffs" value={handoffCount} />
            <StatCard label="Tasks" value={data.tasks.length} />
          </div>
        </div>

        <div className="grid min-h-0 gap-4 md:grid-cols-3">
          <BoardColumn title="Waiting" tasks={taskColumns.waiting} tone="amber" />
          <BoardColumn title="Underway" tasks={taskColumns.underway} tone="cyan" />
          <BoardColumn title="Complete" tasks={taskColumns.complete} tone="emerald" />
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-stone-800 bg-stone-950 shadow-[0_24px_60px_rgba(18,16,12,0.45)]">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Terminal Feed</p>
            <p className="mt-1 text-sm text-stone-300">
              Every agent event, task move, and handoff is persisted here.
            </p>
          </div>
          <Button
            disabled={advanceMutation.isPending}
            onClick={() => advanceMutation.mutate()}
            size="sm"
            variant="secondary"
          >
            {advanceMutation.isPending ? "Advancing..." : "Advance now"}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {data.events.length === 0 ? (
            <div className="px-5 py-6 text-sm text-stone-500">No events yet.</div>
          ) : (
            data.events.map((event) => <EventRow event={event} key={event.id} />)
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/45">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function BoardColumn({
  title,
  tasks,
  tone,
}: {
  title: string;
  tasks: RunTask[];
  tone: "amber" | "cyan" | "emerald";
}) {
  return (
    <div
      className={cn(
        "flex min-h-[420px] flex-col rounded-[1.75rem] border p-4 shadow-[0_16px_40px_rgba(59,45,21,0.08)]",
        tone === "amber" && "border-amber-300/45 bg-amber-50/80",
        tone === "cyan" && "border-cyan-300/45 bg-cyan-50/70",
        tone === "emerald" && "border-emerald-300/45 bg-emerald-50/80",
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-2xl">{title}</h2>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/12 px-4 py-6 text-sm text-foreground/45">
            No tasks in {title.toLowerCase()}.
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}
