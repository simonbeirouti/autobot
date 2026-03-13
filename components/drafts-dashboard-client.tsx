"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Clock3Icon, FileTextIcon } from "lucide-react";

import { MarkdownPreview } from "@/components/markdown-preview";
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getDraftStatusLabel,
  isActiveIntakeDraft,
  sortDraftsByCreatedAt,
  truncateDraftObjective,
} from "@/lib/intake/presentation";
import type { IntakeDraft, IntakeFlowResponse, IntakeQuestion } from "@/lib/intake/types";
import { cn } from "@/lib/utils";

type DraftWorkspaceMode = "questions" | "review";

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return Date.now();
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function getDraftsUpdatedAt(drafts: IntakeDraft[]) {
  if (drafts.length === 0) {
    return Date.now();
  }

  return Math.max(...drafts.map((draft) => getTimestamp(draft.updatedAt)));
}

function getActiveDrafts(drafts: IntakeDraft[]) {
  return sortDraftsByCreatedAt(drafts.filter(isActiveIntakeDraft));
}

function normalizeAnswers(questions: IntakeQuestion[]) {
  return Object.fromEntries(questions.map((question) => [question.id, question.answer]));
}

function haveAnswersChanged(
  baselineAnswers: Record<string, string>,
  answers: Record<string, string>,
) {
  const questionIds = new Set([...Object.keys(baselineAnswers), ...Object.keys(answers)]);

  return Array.from(questionIds).some(
    (questionId) => (answers[questionId] ?? "").trim() !== (baselineAnswers[questionId] ?? "").trim(),
  );
}

function buildDraftHref(pathname: string, draftId: string) {
  const params = new URLSearchParams();
  params.set("draftId", draftId);
  return `${pathname}?${params.toString()}`;
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

async function fetchDrafts() {
  return fetchJson<IntakeDraft[]>("/api/intake/drafts", { cache: "no-store" });
}

async function fetchDraftFlow(draftId: string) {
  return fetchJson<IntakeFlowResponse>(`/api/intake/drafts/${draftId}`);
}

function DraftWorkspaceSkeleton() {
  return (
    <section className="flex min-h-0 flex-col gap-2 p-0.5 xl:grid xl:h-full xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
      <Card className="overflow-hidden border-none">
        <CardHeader className="-mt-2 space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-2 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <Card className="min-h-[320px]">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        <Card className="min-h-[320px]">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function DraftWorkspaceView({
  flow,
  answers,
  generatedAnswers,
  activeQuestionId,
  mode,
  reviewMarkdown,
  isEditingReview,
  isSaving,
  isSubmitting,
  isExecuting,
  error,
  onAnswerChange,
  onQuestionFocus,
  onGenerate,
  onToggleMode,
  onReviewMarkdownChange,
  onToggleReviewEditing,
  onSaveDraft,
  onStartExecution,
}: {
  flow: IntakeFlowResponse;
  answers: Record<string, string>;
  generatedAnswers: Record<string, string>;
  activeQuestionId: string | null;
  mode: DraftWorkspaceMode;
  reviewMarkdown: string;
  isEditingReview: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  isExecuting: boolean;
  error: string | null;
  onAnswerChange: (questionId: string, value: string) => void;
  onQuestionFocus: (questionId: string) => void;
  onGenerate: () => void;
  onToggleMode: (mode: DraftWorkspaceMode) => void;
  onReviewMarkdownChange: (value: string) => void;
  onToggleReviewEditing: () => void;
  onSaveDraft: () => void;
  onStartExecution: () => void;
}) {
  const activeQuestions = flow.questions;
  const answeredQuestionCount = activeQuestions.filter((question) =>
    (answers[question.id] ?? "").trim().length > 0,
  ).length;
  const areAllQuestionsComplete = activeQuestions.every(
    (question) => (answers[question.id] ?? "").trim().length > 0,
  );
  const canReviewDraft =
    flow.draft.status === "review_ready" ||
    Boolean(flow.draft.generatedMarkdown ?? flow.draft.draftMarkdown);
  const canStartExecution = flow.draft.status === "review_ready" || Boolean(flow.draft.runId);
  const questionAnswersChanged = haveAnswersChanged(generatedAnswers, answers);

  return (
    <section className="flex min-h-0 flex-col gap-2 p-0.5 xl:grid xl:h-full xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
      <Card className="overflow-hidden border-none">
        <CardHeader className="-mt-2">
          <div className="flex flex-col gap-4">
            <div className="min-w-0 space-y-3">
              <CardTitle className="w-full font-serif text-lg leading-tight">
                {flow.draft.objective}
              </CardTitle>
              <p className="max-w-5xl text-sm text-muted-foreground">
                {flow.draft.clarificationSummary ??
                  "Answer the remaining questions to generate a draft plan."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant={flow.draft.status === "review_ready" ? "default" : "outline"}>
                  {getDraftStatusLabel(flow.draft)}
                </Badge>
                {flow.draft.executionMode ? (
                  <Badge variant="secondary">
                    {flow.draft.executionMode.replace("_", " ")}
                  </Badge>
                ) : null}
                <Badge variant="outline">
                  Created {formatDistanceToNowStrict(new Date(flow.draft.createdAt))} ago
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-2 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <Card className="min-h-[320px]">
          <CardHeader>
            <CardTitle className="text-base">Draft controls</CardTitle>
            <CardDescription>
              Move between clarification and draft review without leaving the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              className={cn(
                "w-full space-y-3 border p-4 text-left text-sm transition-colors",
                mode === "questions" ? "border-primary bg-muted" : "hover:bg-muted/50",
              )}
              onClick={() => onToggleMode("questions")}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">Questions</span>
                <Badge variant="outline">
                  {answeredQuestionCount}/{flow.questions.length}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {flow.draft.status === "review_ready"
                  ? "Update answers and regenerate the draft if you need to change direction."
                  : "Answer each clarification prompt so AutoBot can assemble the draft plan."}
              </p>
            </button>

            {canReviewDraft ? (
              <button
                className={cn(
                  "w-full space-y-3 border p-4 text-left text-sm transition-colors",
                  mode === "review" ? "border-primary bg-muted" : "hover:bg-muted/50",
                )}
                onClick={() => onToggleMode("review")}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Draft markdown</span>
                  <Badge variant="outline">Ready</Badge>
                </div>
                <p className="text-muted-foreground">
                  Review the generated draft, edit the markdown directly, then start execution when ready.
                </p>
              </button>
            ) : null}

            {canStartExecution
              ? flow.draft.runId ? (
                  <Button asChild className="w-full" variant="outline">
                    <Link href={`/dashboard/runs?runId=${flow.draft.runId}`}>Open linked run</Link>
                  </Button>
                ) : (
                  <Button className="w-full" disabled={isExecuting} onClick={onStartExecution}>
                    {isExecuting ? "Starting..." : "Start execution"}
                  </Button>
                )
              : null}
          </CardContent>
        </Card>

        {mode === "questions" ? (
          <Card className="flex min-h-[320px] flex-col xl:h-full xl:min-h-0">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Clarification</CardTitle>
                {activeQuestions.length > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {answeredQuestionCount} of {activeQuestions.length} answered
                  </span>
                ) : null}
              </div>
              <CardDescription>
                Capture the context the agent needs before generating or regenerating the draft.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              {activeQuestions.length > 0 ? (
                <div className="space-y-5">
                  {activeQuestions.map((question, index) => (
                    <div className="space-y-3 border p-4" key={question.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base font-medium">{question.question}</p>
                        <Badge variant={question.id === activeQuestionId ? "default" : "outline"}>
                          {index + 1}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{question.description}</p>
                      <Textarea
                        className="min-h-32"
                        onChange={(event) => onAnswerChange(question.id, event.target.value)}
                        onFocus={() => onQuestionFocus(question.id)}
                        placeholder="Add the context the agent needs..."
                        value={answers[question.id] ?? ""}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  No active clarification questions for this draft.
                </div>
              )}

              {error ? (
                <div className="mt-5 border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="justify-end gap-3 border-t">
              {areAllQuestionsComplete && (!canReviewDraft || questionAnswersChanged) ? (
                <Button disabled={isSubmitting || isSaving} onClick={onGenerate}>
                  {isSubmitting
                    ? "Generating..."
                    : canReviewDraft
                      ? "Regenerate draft"
                      : "Generate draft"}
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        ) : (
          <Card className="flex min-h-[320px] flex-col xl:h-full xl:min-h-0">
            <CardHeader>
              <CardTitle className="text-base">Review draft</CardTitle>
              <CardDescription>
                Edit the markdown directly or return to clarification to regenerate the draft.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={onToggleReviewEditing} variant="outline">
                  {isEditingReview ? "Preview markdown" : "Edit markdown"}
                </Button>
                {questionAnswersChanged && areAllQuestionsComplete ? (
                  <Button disabled={isSubmitting} onClick={onGenerate} variant="outline">
                    {isSubmitting ? "Regenerating..." : "Regenerate draft"}
                  </Button>
                ) : null}
              </div>

              {isEditingReview ? (
                <Textarea
                  className="min-h-0 flex-1 font-mono text-sm"
                  onChange={(event) => onReviewMarkdownChange(event.target.value)}
                  value={reviewMarkdown}
                />
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto border p-4">
                  <MarkdownPreview className="space-y-1" content={reviewMarkdown} />
                </div>
              )}

              {error ? (
                <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="justify-between gap-3">
              {isEditingReview ? (
                <Button disabled={isSaving} onClick={onSaveDraft} variant="outline">
                  {isSaving ? "Saving..." : "Save draft"}
                </Button>
              ) : (
                <div />
              )}
              {canStartExecution ? (
                <Button
                  disabled={flow.draft.status !== "review_ready" || isExecuting}
                  onClick={onStartExecution}
                >
                  {isExecuting ? "Starting..." : "Start execution"}
                </Button>
              ) : (
                <div />
              )}
            </CardFooter>
          </Card>
        )}
      </div>
    </section>
  );
}

export function DraftsDashboardSkeleton() {
  return (
    <WorkspaceSplitLayout
      sidebar={
        <WorkspaceSidebarSkeleton
          descriptionWidth="w-4/5"
          itemCount={3}
          titleWidth="w-32"
        />
      }
      content={<DraftWorkspaceSkeleton />}
    />
  );
}

export function DraftsDashboardClient({
  initialDrafts,
  initialFlow,
  initialSelectedDraftId,
}: {
  initialDrafts: IntakeDraft[];
  initialFlow: IntakeFlowResponse | null;
  initialSelectedDraftId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const requestedDraftId = searchParams.get("draftId");

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generatedAnswers, setGeneratedAnswers] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [reviewMarkdown, setReviewMarkdown] = useState("");
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DraftWorkspaceMode>("questions");
  const previousDraftIdRef = useRef<string | null>(null);

  const draftsQuery = useQuery({
    queryKey: ["drafts"],
    queryFn: fetchDrafts,
    initialData: initialDrafts,
    initialDataUpdatedAt: getDraftsUpdatedAt(initialDrafts),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const drafts = getActiveDrafts(draftsQuery.data ?? []);
  const selectedDraftId =
    requestedDraftId && drafts.some((draft) => draft.id === requestedDraftId)
      ? requestedDraftId
      : initialSelectedDraftId ?? drafts[0]?.id ?? null;
  const deferredDraftId = useDeferredValue(selectedDraftId);

  useEffect(() => {
    if (!drafts.length || requestedDraftId === selectedDraftId || !selectedDraftId) {
      return;
    }

    startTransition(() => {
      router.replace(buildDraftHref(pathname, selectedDraftId), { scroll: false });
    });
  }, [drafts.length, pathname, requestedDraftId, router, selectedDraftId]);

  const flowQuery = useQuery({
    queryKey: ["draft-flow", deferredDraftId],
    queryFn: () => fetchDraftFlow(deferredDraftId!),
    enabled: Boolean(deferredDraftId),
    initialData:
      initialFlow && initialFlow.draft.id === deferredDraftId ? initialFlow : undefined,
    initialDataUpdatedAt:
      initialFlow && initialFlow.draft.id === deferredDraftId
        ? getTimestamp(initialFlow.draft.updatedAt)
        : undefined,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!flowQuery.data) {
      return;
    }

    const nextFlow = flowQuery.data;
    const isDraftSelectionChange = previousDraftIdRef.current !== nextFlow.draft.id;
    setAnswers(normalizeAnswers(nextFlow.questions));
    if (isDraftSelectionChange) {
      setGeneratedAnswers(normalizeAnswers(nextFlow.questions));
    }
    const nextStep = Math.min(nextFlow.draft.currentStep, Math.max(nextFlow.questions.length - 1, 0));
    setCurrentStep(nextStep);
    setActiveQuestionId(nextFlow.questions[nextStep]?.id ?? nextFlow.questions[0]?.id ?? null);
    setReviewMarkdown(nextFlow.draft.draftMarkdown ?? nextFlow.draft.generatedMarkdown ?? "");
    setIsEditingReview(false);
    if (isDraftSelectionChange) {
      setMode(nextFlow.draft.status === "review_ready" ? "review" : "questions");
    }
    previousDraftIdRef.current = nextFlow.draft.id;
    setError(null);
  }, [flowQuery.data]);

  useEffect(() => {
    if (!flowQuery.data?.draft.runId || flowQuery.data.draft.status !== "executing") {
      return;
    }

    startTransition(() => {
      router.replace(`/dashboard/runs?runId=${flowQuery.data?.draft.runId}`, { scroll: false });
    });
  }, [flowQuery.data?.draft.runId, flowQuery.data?.draft.status, router]);

  function syncFlow(flow: IntakeFlowResponse) {
    queryClient.setQueryData(["draft-flow", flow.draft.id], flow);
    queryClient.setQueryData<IntakeDraft[] | undefined>(["drafts"], (currentDrafts) => {
      if (!currentDrafts) {
        return [flow.draft];
      }

      const hasDraft = currentDrafts.some((draft) => draft.id === flow.draft.id);
      const nextDrafts = hasDraft
        ? currentDrafts.map((draft) => (draft.id === flow.draft.id ? flow.draft : draft))
        : [flow.draft, ...currentDrafts];

      return nextDrafts;
    });
  }

  async function submitClarificationAnswers() {
    if (!flowQuery.data) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const flow = await fetchJson<IntakeFlowResponse>("/api/intake/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: flowQuery.data.draft.id,
          currentStep,
          answers: flowQuery.data.questions.map((question) => ({
            questionId: question.id,
            answer: answers[question.id] ?? "",
          })),
        }),
      });

      syncFlow(flow);
      setGeneratedAnswers(normalizeAnswers(flow.questions));
      setMode(flow.draft.status === "review_ready" ? "review" : "questions");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to continue clarification.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveReviewDraft() {
    if (!flowQuery.data) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const flow = await fetchJson<IntakeFlowResponse>(`/api/intake/drafts/${flowQuery.data.draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftMarkdown: reviewMarkdown,
          currentStep,
        }),
      });

      syncFlow(flow);
      setIsEditingReview(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft.");
    } finally {
      setIsSaving(false);
    }
  }

  async function startExecution() {
    if (!flowQuery.data) {
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const payload = await fetchJson<{ runId: string }>(
        `/api/intake/drafts/${flowQuery.data.draft.id}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      await queryClient.invalidateQueries({ queryKey: ["drafts"] });
      startTransition(() => {
        router.push(`/dashboard/runs?runId=${payload.runId}`);
      });
    } catch (executeError) {
      setError(
        executeError instanceof Error ? executeError.message : "Unable to start execution.",
      );
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <WorkspaceSplitLayout
      sidebar={
        <WorkspaceSidebarPanel
          description="Open an in-progress draft to continue clarification, review the plan, or launch execution."
          title="Drafts"
        >
          {draftsQuery.error ? (
            <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {draftsQuery.error instanceof Error
                ? draftsQuery.error.message
                : "Unable to load drafts."}
            </div>
          ) : null}

          {!draftsQuery.isLoading && !draftsQuery.error && drafts.length === 0 ? (
            <Empty className="border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>No drafts yet</EmptyTitle>
                <EmptyDescription>
                  Start a dashboard intake to create the first draft.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          <div className="space-y-2">
            {drafts.map((draft) => {
              const isActive = draft.id === selectedDraftId;

              return (
                <Button
                  className={cn(
                    "h-auto w-full items-start justify-start border border-border p-0 text-left whitespace-normal",
                    isActive && "border-primary bg-muted",
                  )}
                  key={draft.id}
                  onClick={() => {
                    startTransition(() => {
                      router.replace(buildDraftHref(pathname, draft.id), { scroll: false });
                    });
                  }}
                  variant="ghost"
                >
                  <div className="w-full space-y-4 p-4">
                    <div className="space-y-2">
                      <h2 className="text-sm font-medium" title={draft.objective}>
                        {truncateDraftObjective(draft.objective)}
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={isActive ? "default" : "secondary"}>
                        {getDraftStatusLabel(draft)}
                      </Badge>
                      {draft.executionMode ? (
                        <Badge variant="outline">{draft.executionMode.replace("_", " ")}</Badge>
                      ) : null}
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3Icon className="size-3.5" />
                      <span>
                        Created {formatDistanceToNowStrict(new Date(draft.createdAt))} ago
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
        !selectedDraftId ? (
          <Card className="min-h-[320px] justify-center overflow-hidden xl:h-full xl:min-h-0">
            <CardContent className="flex h-full items-center justify-center py-0">
              <Empty className="max-w-md border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileTextIcon />
                  </EmptyMedia>
                  <EmptyTitle>Select a draft</EmptyTitle>
                  <EmptyDescription>
                    Choose a draft from the list to continue clarification or review the plan.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : flowQuery.isLoading ? (
          <DraftWorkspaceSkeleton />
        ) : flowQuery.error || !flowQuery.data ? (
          <Card className="min-h-[320px] overflow-hidden xl:h-full xl:min-h-0">
            <CardContent className="py-6">
              <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {flowQuery.error instanceof Error
                  ? flowQuery.error.message
                  : "Unable to load draft."}
              </div>
            </CardContent>
          </Card>
        ) : (
          <DraftWorkspaceView
            activeQuestionId={activeQuestionId}
            answers={answers}
            error={error}
            flow={flowQuery.data}
            generatedAnswers={generatedAnswers}
            isEditingReview={isEditingReview}
            isExecuting={isExecuting}
            isSaving={isSaving}
            isSubmitting={isSubmitting}
            mode={mode}
            onAnswerChange={(questionId, value) => {
              setAnswers((currentAnswers) => ({
                ...currentAnswers,
                [questionId]: value,
              }));
            }}
            onQuestionFocus={(questionId) => {
              setActiveQuestionId(questionId);
              const nextStep = flowQuery.data.questions.findIndex((question) => question.id === questionId);
              if (nextStep >= 0) {
                setCurrentStep(nextStep);
              }
            }}
            onGenerate={() => {
              void submitClarificationAnswers();
            }}
            onReviewMarkdownChange={setReviewMarkdown}
            onSaveDraft={() => {
              void saveReviewDraft();
            }}
            onStartExecution={() => {
              void startExecution();
            }}
            onToggleMode={setMode}
            onToggleReviewEditing={() => setIsEditingReview((current) => !current)}
            reviewMarkdown={reviewMarkdown}
          />
        )
      }
    />
  );
}
