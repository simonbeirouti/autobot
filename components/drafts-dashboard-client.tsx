"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useIsRestoring, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getDraftStatusLabel,
  isActiveIntakeDraft,
  sortDraftsByCreatedAt,
  truncateDraftObjective,
} from "@/lib/intake/presentation";
import {
  createOptimisticFlow,
  dashboardQueryKeys,
  dashboardQueryTimings,
  fetchJson,
  getDraftsUpdatedAt,
  upsertDraftInList,
} from "@/lib/query/dashboard";
import { useDelayedVisibility } from "@/lib/query/use-delayed-visibility";
import type { IntakeDraft, IntakeFlowResponse, IntakeQuestion } from "@/lib/intake/types";
import { cn } from "@/lib/utils";

type DraftWorkspaceMode = "questions" | "review";
type QuestionResponse = IntakeQuestion["response"];
const ERROR_VISIBILITY_DELAY_MS = 1000;

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return Date.now();
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function getActiveDrafts(drafts: IntakeDraft[]) {
  return sortDraftsByCreatedAt(drafts.filter(isActiveIntakeDraft));
}

function cloneResponse(response?: Partial<QuestionResponse>): QuestionResponse {
  return {
    selectedOptionIds: response?.selectedOptionIds ?? [],
    otherText: response?.otherText ?? "",
    text: response?.text ?? "",
  };
}

function getInitialResponse(question: IntakeQuestion): QuestionResponse {
  const hasSavedResponse =
    question.response.selectedOptionIds.length > 0 ||
    question.response.otherText.trim().length > 0 ||
    question.response.text.trim().length > 0;

  if (hasSavedResponse) {
    return cloneResponse(question.response);
  }

  return {
    selectedOptionIds: [],
    otherText: "",
    text: "",
  };
}

function normalizeAnswers(questions: IntakeQuestion[]) {
  return Object.fromEntries(questions.map((question) => [question.id, getInitialResponse(question)]));
}

function buildAnswerSummary(question: IntakeQuestion, response: QuestionResponse) {
  if (question.inputKind === "text") {
    return response.text.trim();
  }

  const selectedLabels = response.selectedOptionIds
    .filter((optionId) => optionId !== "__other__")
    .map((optionId) => question.options.find((option) => option.id === optionId)?.label ?? optionId)
    .filter((value) => value.length > 0);

  return [...selectedLabels, response.otherText.trim()].filter((value) => value.length > 0).join(", ");
}

function isQuestionAnswered(question: IntakeQuestion, response: QuestionResponse | undefined) {
  if (question.isOptional) {
    return true;
  }

  if (!response) {
    return false;
  }

  if (question.inputKind === "text") {
    return response.text.trim().length > 0;
  }

  return response.selectedOptionIds.length > 0 || response.otherText.trim().length > 0;
}

function shouldShowOtherInput(question: IntakeQuestion, response: QuestionResponse | undefined) {
  if (!question.allowOther || !response) {
    return false;
  }

  if (question.inputKind === "multi_select") {
    return response.otherText.trim().length > 0 || response.selectedOptionIds.includes("__other__");
  }

  return response.selectedOptionIds.includes("__other__");
}

function serializeResponse(response: QuestionResponse | undefined) {
  return JSON.stringify({
    selectedOptionIds: [...(response?.selectedOptionIds ?? [])].sort(),
    otherText: response?.otherText?.trim() ?? "",
    text: response?.text?.trim() ?? "",
  });
}

function haveAnswersChanged(
  baselineAnswers: Record<string, QuestionResponse>,
  answers: Record<string, QuestionResponse>,
) {
  const questionIds = new Set([...Object.keys(baselineAnswers), ...Object.keys(answers)]);

  return Array.from(questionIds).some(
    (questionId) => serializeResponse(answers[questionId]) !== serializeResponse(baselineAnswers[questionId]),
  );
}

function buildDraftHref(pathname: string, draftId: string) {
  const params = new URLSearchParams();
  params.set("draftId", draftId);
  return `${pathname}?${params.toString()}`;
}

async function fetchDrafts() {
  return fetchJson<IntakeDraft[]>("/api/intake/drafts");
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
  answers: Record<string, QuestionResponse>;
  generatedAnswers: Record<string, QuestionResponse>;
  activeQuestionId: string | null;
  mode: DraftWorkspaceMode;
  reviewMarkdown: string;
  isEditingReview: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  isExecuting: boolean;
  error: string | null;
  onAnswerChange: (questionId: string, response: QuestionResponse) => void;
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
    isQuestionAnswered(question, answers[question.id]),
  ).length;
  const areAllQuestionsComplete = activeQuestions.every(
    (question) => isQuestionAnswered(question, answers[question.id]),
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
                  "Answer the next decisions so AutoBot can generate the draft plan."}
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
                  : `AutoBot still needs ${Math.max(activeQuestions.length - answeredQuestionCount, 0)} more ${Math.max(activeQuestions.length - answeredQuestionCount, 0) === 1 ? "decision" : "decisions"} to assemble the draft plan.`}
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
            <CardContent className="min-h-0 flex-1 overflow-hidden pb-0">
              <div className="h-full overflow-y-auto pb-5">
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
                      {question.inputKind === "text" ? (
                        <Textarea
                          className="min-h-32"
                          onChange={(event) =>
                            onAnswerChange(question.id, {
                              ...cloneResponse(answers[question.id]),
                              text: event.target.value,
                            })
                          }
                          onFocus={() => onQuestionFocus(question.id)}
                          placeholder={question.otherPlaceholder || "Add the context the agent needs..."}
                          value={answers[question.id]?.text ?? ""}
                        />
                      ) : question.inputKind === "single_select" ? (
                        <RadioGroup
                          onValueChange={(value) => {
                            onQuestionFocus(question.id);
                            onAnswerChange(question.id, {
                              ...cloneResponse(answers[question.id]),
                              selectedOptionIds: [value],
                              otherText: value === "__other__" ? answers[question.id]?.otherText ?? "" : "",
                            });
                          }}
                          value={answers[question.id]?.selectedOptionIds[0] ?? ""}
                        >
                          {question.options.map((option) => (
                            <label
                              className={cn(
                                "flex cursor-pointer items-start gap-3 border p-3 transition-colors",
                                answers[question.id]?.selectedOptionIds[0] === option.id && "border-primary bg-muted/60",
                              )}
                              key={option.id}
                            >
                              <RadioGroupItem value={option.id} />
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{option.label}</span>
                                  {option.isRecommended ? <Badge variant="secondary">Suggested</Badge> : null}
                                </div>
                                {option.description ? (
                                  <p className="text-xs text-muted-foreground">{option.description}</p>
                                ) : null}
                              </div>
                            </label>
                          ))}
                          {question.allowOther ? (
                            <label
                              className={cn(
                                "flex cursor-pointer items-start gap-3 border p-3 transition-colors",
                                answers[question.id]?.selectedOptionIds[0] === "__other__" && "border-primary bg-muted/60",
                              )}
                            >
                              <RadioGroupItem value="__other__" />
                              <div className="space-y-1">
                                <span className="text-sm font-medium">{question.otherLabel}</span>
                                <p className="text-xs text-muted-foreground">
                                  Provide a custom answer that is not listed.
                                </p>
                              </div>
                            </label>
                          ) : null}
                        </RadioGroup>
                      ) : (
                        <div className="space-y-2">
                          {question.options.map((option) => {
                            const isChecked = answers[question.id]?.selectedOptionIds.includes(option.id) ?? false;
                            return (
                              <label
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 border p-3 transition-colors",
                                  isChecked && "border-primary bg-muted/60",
                                )}
                                key={option.id}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    onQuestionFocus(question.id);
                                    const current = new Set(answers[question.id]?.selectedOptionIds ?? []);
                                    if (checked) {
                                      current.add(option.id);
                                    } else {
                                      current.delete(option.id);
                                    }
                                    onAnswerChange(question.id, {
                                      ...cloneResponse(answers[question.id]),
                                      selectedOptionIds: Array.from(current),
                                    });
                                  }}
                                />
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{option.label}</span>
                                    {option.isRecommended ? <Badge variant="secondary">Suggested</Badge> : null}
                                  </div>
                                  {option.description ? (
                                    <p className="text-xs text-muted-foreground">{option.description}</p>
                                  ) : null}
                                </div>
                              </label>
                            );
                          })}
                          {question.allowOther ? (
                            <label
                              className={cn(
                                "flex cursor-pointer items-start gap-3 border p-3 transition-colors",
                                shouldShowOtherInput(question, answers[question.id]) && "border-primary bg-muted/60",
                              )}
                            >
                              <Checkbox
                                checked={shouldShowOtherInput(question, answers[question.id])}
                                onCheckedChange={(checked) => {
                                  onQuestionFocus(question.id);
                                  const current = new Set(answers[question.id]?.selectedOptionIds ?? []);
                                  if (checked) {
                                    current.add("__other__");
                                  } else {
                                    current.delete("__other__");
                                  }
                                  onAnswerChange(question.id, {
                                    ...cloneResponse(answers[question.id]),
                                    selectedOptionIds: Array.from(current),
                                    otherText: checked ? answers[question.id]?.otherText ?? "" : "",
                                  });
                                }}
                              />
                              <div className="space-y-1">
                                <span className="text-sm font-medium">{question.otherLabel}</span>
                                <p className="text-xs text-muted-foreground">
                                  Add a custom answer alongside the selected options.
                                </p>
                              </div>
                            </label>
                          ) : null}
                        </div>
                      )}
                      {question.allowOther && shouldShowOtherInput(question, answers[question.id]) ? (
                        <Input
                          onChange={(event) =>
                            onAnswerChange(question.id, {
                              ...cloneResponse(answers[question.id]),
                              otherText: event.target.value,
                            })
                          }
                          onFocus={() => onQuestionFocus(question.id)}
                          placeholder={question.otherPlaceholder}
                          value={answers[question.id]?.otherText ?? ""}
                        />
                      ) : null}
                      {buildAnswerSummary(question, answers[question.id] ?? cloneResponse()).trim().length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Current answer: {buildAnswerSummary(question, answers[question.id] ?? cloneResponse())}
                        </p>
                      ) : null}
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
              </div>
            </CardContent>
            <CardFooter className="min-h-16 shrink-0 justify-end gap-3 border-t">
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
  initialDrafts?: IntakeDraft[];
  initialFlow?: IntakeFlowResponse | null;
  initialSelectedDraftId?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();
  const requestedDraftId = searchParams.get("draftId");

  const [answers, setAnswers] = useState<Record<string, QuestionResponse>>({});
  const [generatedAnswers, setGeneratedAnswers] = useState<Record<string, QuestionResponse>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [reviewMarkdown, setReviewMarkdown] = useState("");
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DraftWorkspaceMode>("questions");
  const previousDraftIdRef = useRef<string | null>(null);

  const draftsQuery = useQuery({
    queryKey: dashboardQueryKeys.drafts.all,
    queryFn: fetchDrafts,
    ...(initialDrafts
      ? {
          initialData: initialDrafts,
          initialDataUpdatedAt: getDraftsUpdatedAt(initialDrafts),
        }
      : {}),
    staleTime: dashboardQueryTimings.drafts.staleTime,
  });

  const drafts = getActiveDrafts(draftsQuery.data ?? []);
  const showDraftsError = useDelayedVisibility(
    Boolean(draftsQuery.error),
    ERROR_VISIBILITY_DELAY_MS,
  );
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
    queryKey: deferredDraftId
      ? dashboardQueryKeys.drafts.flow(deferredDraftId)
      : dashboardQueryKeys.drafts.flow("pending"),
    queryFn: () => fetchDraftFlow(deferredDraftId!),
    enabled: Boolean(deferredDraftId),
    initialData:
      initialFlow && initialFlow.draft.id === deferredDraftId ? initialFlow : undefined,
    initialDataUpdatedAt:
      initialFlow && initialFlow.draft.id === deferredDraftId
        ? getTimestamp(initialFlow.draft.updatedAt)
        : undefined,
    staleTime: dashboardQueryTimings.draftFlow.staleTime,
  });
  const showFlowError = useDelayedVisibility(Boolean(flowQuery.error), ERROR_VISIBILITY_DELAY_MS);

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
    queryClient.setQueryData(dashboardQueryKeys.drafts.flow(flow.draft.id), flow);
    queryClient.setQueryData<IntakeDraft[] | undefined>(
      dashboardQueryKeys.drafts.all,
      (currentDrafts) => upsertDraftInList(currentDrafts, flow.draft),
    );
  }

  const submitClarificationAnswers = useMutation({
    mutationFn: async (flow: IntakeFlowResponse) =>
      fetchJson<IntakeFlowResponse>("/api/intake/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: flow.draft.id,
          currentStep,
          answers: flow.questions.map((question) => ({
            questionId: question.id,
            response: answers[question.id] ?? cloneResponse(question.response),
          })),
        }),
      }),
    onMutate: async (flow) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: dashboardQueryKeys.drafts.flow(flow.draft.id) });

      const previousFlow = queryClient.getQueryData<IntakeFlowResponse>(
        dashboardQueryKeys.drafts.flow(flow.draft.id),
      );

      syncFlow(
        createOptimisticFlow(flow, {
          currentStep,
          questions: flow.questions.map((question) => ({
            ...question,
            response: answers[question.id] ?? cloneResponse(question.response),
          })),
        }),
      );

      return { previousFlow };
    },
    onSuccess: (flow) => {
      syncFlow(flow);
      setGeneratedAnswers(normalizeAnswers(flow.questions));
      setMode(flow.draft.status === "review_ready" ? "review" : "questions");
    },
    onError: (submissionError, flow, context) => {
      if (context?.previousFlow) {
        syncFlow(context.previousFlow);
      }

      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to continue clarification.",
      );
    },
  });

  const saveReviewDraft = useMutation({
    mutationFn: async (flow: IntakeFlowResponse) =>
      fetchJson<IntakeFlowResponse>(`/api/intake/drafts/${flow.draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftMarkdown: reviewMarkdown,
          currentStep,
        }),
      }),
    onMutate: async (flow) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: dashboardQueryKeys.drafts.flow(flow.draft.id) });

      const previousFlow = queryClient.getQueryData<IntakeFlowResponse>(
        dashboardQueryKeys.drafts.flow(flow.draft.id),
      );

      syncFlow(
        createOptimisticFlow(flow, {
          currentStep,
          draftMarkdown: reviewMarkdown,
        }),
      );

      return { previousFlow };
    },
    onSuccess: (flow) => {
      syncFlow(flow);
      setIsEditingReview(false);
    },
    onError: (saveError, flow, context) => {
      if (context?.previousFlow) {
        syncFlow(context.previousFlow);
      }

      setError(saveError instanceof Error ? saveError.message : "Unable to save draft.");
    },
  });

  const startExecution = useMutation({
    mutationFn: async (flow: IntakeFlowResponse) =>
      fetchJson<{ runId: string }>(`/api/intake/drafts/${flow.draft.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    onMutate: async (flow) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: dashboardQueryKeys.drafts.flow(flow.draft.id) });

      const previousFlow = queryClient.getQueryData<IntakeFlowResponse>(
        dashboardQueryKeys.drafts.flow(flow.draft.id),
      );

      syncFlow({
        ...flow,
        draft: {
          ...flow.draft,
          status: "executing",
          updatedAt: new Date().toISOString(),
        },
      });

      return { previousFlow };
    },
    onSuccess: async (payload, flow) => {
      queryClient.setQueryData<IntakeDraft[] | undefined>(
        dashboardQueryKeys.drafts.all,
        (currentDrafts) => currentDrafts?.filter((draft) => draft.id !== flow.draft.id),
      );
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.runs.all });
      startTransition(() => {
        router.push(`/dashboard/runs?runId=${payload.runId}`);
      });
    },
    onError: (executeError, flow, context) => {
      if (context?.previousFlow) {
        syncFlow(context.previousFlow);
      }

      setError(
        executeError instanceof Error ? executeError.message : "Unable to start execution.",
      );
    },
  });

  return (
    <WorkspaceSplitLayout
      sidebar={
        <WorkspaceSidebarPanel
          description="Open an in-progress draft to continue clarification, review the plan, or launch execution."
          title="Drafts"
        >
          {showDraftsError ? (
            <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {draftsQuery.error instanceof Error
                ? draftsQuery.error.message
                : "Unable to load drafts."}
            </div>
          ) : null}

          {!isRestoring && !draftsQuery.isLoading && !showDraftsError && drafts.length === 0 ? (
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
        !selectedDraftId && (isRestoring || draftsQuery.isLoading) ? (
          <DraftWorkspaceSkeleton />
        ) : !selectedDraftId ? (
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
        ) : flowQuery.isLoading || (flowQuery.error && !showFlowError) ? (
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
            isExecuting={startExecution.isPending}
            isSaving={saveReviewDraft.isPending}
            isSubmitting={submitClarificationAnswers.isPending}
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
              if (flowQuery.data) {
                submitClarificationAnswers.mutate(flowQuery.data);
              }
            }}
            onReviewMarkdownChange={setReviewMarkdown}
            onSaveDraft={() => {
              if (flowQuery.data) {
                saveReviewDraft.mutate(flowQuery.data);
              }
            }}
            onStartExecution={() => {
              if (flowQuery.data) {
                startExecution.mutate(flowQuery.data);
              }
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
