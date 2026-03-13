"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getDraftStatusLabel,
  isActiveIntakeDraft,
  sortDraftsByCreatedAt,
} from "@/lib/intake/presentation";
import {
  dashboardQueryKeys,
  dashboardQueryTimings,
  fetchJson,
  upsertDraftInList,
} from "@/lib/query/dashboard";
import { useDelayedVisibility } from "@/lib/query/use-delayed-visibility";
import type { IntakeDraft, IntakeFlowResponse } from "@/lib/intake/types";
import { cn } from "@/lib/utils";

const starterPrompts = [
  "Launch an AI assistant for our SDR team that can qualify inbound leads.",
  "Reduce support backlog by automating ticket triage and handoff.",
  "Design a workflow to research competitors and summarize weekly changes.",
];

const draftVisibilityClasses = [
  "opacity-100",
  "opacity-80",
  "opacity-60",
  "opacity-40",
  "opacity-20",
] as const;
const ERROR_VISIBILITY_DELAY_MS = 500;

export function ObjectiveIntake() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [objective, setObjective] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const draftsQuery = useQuery({
    queryKey: dashboardQueryKeys.drafts.all,
    queryFn: () => fetchJson<IntakeDraft[]>("/api/intake/drafts"),
    staleTime: dashboardQueryTimings.drafts.staleTime,
    select: (drafts) => sortDraftsByCreatedAt(drafts.filter(isActiveIntakeDraft)),
  });
  const showDraftsError = useDelayedVisibility(
    Boolean(draftsQuery.error) && hasHydrated,
    ERROR_VISIBILITY_DELAY_MS,
  );

  const startDraftMutation = useMutation({
    mutationFn: async (nextObjective: string) =>
      fetchJson<IntakeFlowResponse>("/api/intake/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: nextObjective }),
      }),
    onMutate: () => {
      setError(null);
    },
    onSuccess: (flow) => {
      queryClient.setQueryData<IntakeDraft[] | undefined>(
        dashboardQueryKeys.drafts.all,
        (currentDrafts) => upsertDraftInList(currentDrafts, flow.draft),
      );
      queryClient.setQueryData(dashboardQueryKeys.drafts.flow(flow.draft.id), flow);
      startTransition(() => {
        router.push(`/dashboard/drafts?draftId=${flow.draft.id}`);
      });
    },
    onError: (submissionError) => {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to start intake.",
      );
    },
  });

  const drafts = draftsQuery.data ?? [];
  const showDrafts = hasHydrated && drafts.length > 0;
  const isSubmitting = startDraftMutation.isPending;
  const canStart = objective.trim().length >= 8 && !isSubmitting;

  function submitObjective() {
    startDraftMutation.mutate(objective);
  }

  return (
    <section className="flex min-h-full flex-col justify-center py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center">
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Describe the objective you want AutoBot to own
            </h1>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              Start with the business outcome. AutoBot will ask follow-up questions,
              assemble a draft plan, and wait for your review before execution begins.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                className="h-12 text-sm sm:text-base"
                onChange={(event) => setObjective(event.target.value)}
                placeholder="Describe the business objective you want the agent system to own..."
                value={objective}
              />
              <Button className="h-12 px-6" disabled={!canStart} onClick={submitObjective}>
                {isSubmitting ? "Starting..." : "Start intake"}
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {starterPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  onClick={() => setObjective(prompt)}
                  type="button"
                  variant="outline"
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {showDrafts ? (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
            {drafts.slice(0, 5).map((draft, index) => (
              <Link
                className={cn(
                  "group grid gap-4 rounded-none border bg-card p-4 text-card-foreground transition hover:opacity-100 hover:shadow-sm focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 md:grid-cols-[max-content_minmax(0,1fr)] md:items-start md:gap-8",
                  draftVisibilityClasses[index] ?? draftVisibilityClasses.at(-1),
                )}
                href={`/dashboard/drafts?draftId=${draft.id}`}
                key={draft.id}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:hidden">
                    Status
                  </span>
                  <Badge
                    className="w-fit"
                    variant={draft.status === "review_ready" ? "default" : "outline"}
                  >
                    {getDraftStatusLabel(draft)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(draft.createdAt))} ago
                  </span>
                </div>

                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:hidden">
                    Description
                  </span>
                  <span className="line-clamp-1 text-sm font-medium md:text-base" title={draft.objective}>
                    {draft.objective}
                  </span>
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {draft.clarificationSummary ??
                      "Draft created. Continue clarification to generate the plan."}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mx-auto w-full max-w-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
            {error.toLowerCase().includes("authentication") ? (
              <>
                {" "}
                <Link className="underline underline-offset-4" href="/auth/login">
                  Sign in
                </Link>
                {" "}to continue.
              </>
            ) : null}
          </div>
        ) : null}

        {showDraftsError && !error ? (
          <div className="mx-auto w-full max-w-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {draftsQuery.error instanceof Error
              ? draftsQuery.error.message
              : "Unable to load drafts."}
          </div>
        ) : null}
      </div>
    </section>
  );
}
