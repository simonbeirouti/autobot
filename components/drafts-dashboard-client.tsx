"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useIsRestoring, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckIcon, ChevronDownIcon, Clock3Icon, FileTextIcon, PanelLeftIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { MarkdownPreview } from "@/components/markdown-preview";
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
const OBJECTIVE_START_SUCCESS_STORAGE_KEY = "autobot-objective-intake-started";
const DRAFT_SUMMARY_FALLBACK =
  "Answer the next decisions so AutoBot can generate the draft plan.";

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

async function fetchDrafts(projectId: string) {
  return fetchJson<IntakeDraft[]>(`/api/intake/drafts?projectId=${projectId}`);
}

async function fetchDraftFlow(draftId: string) {
  return fetchJson<IntakeFlowResponse>(`/api/intake/drafts/${draftId}`);
}

async function deleteDraft(draftId: string) {
  return fetchJson<{ success: true; draftId: string }>(`/api/intake/drafts/${draftId}`, {
    method: "DELETE",
  });
}

function DraftWorkspaceSkeleton() {
  return (
    <section className="flex min-h-0 flex-col gap-2 p-0.5 xl:grid xl:h-full xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
      <Card className="hidden overflow-hidden border-none xl:block">
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

function getDraftWorkspaceSummary(draft: Pick<IntakeDraft, "clarificationSummary">) {
  return draft.clarificationSummary ?? DRAFT_SUMMARY_FALLBACK;
}

function DraftListItem({
  draft,
  isActive,
  isConfirmingDelete,
  isDeletePending,
  onSelect,
  onDelete,
}: {
  draft: IntakeDraft;
  isActive: boolean;
  isConfirmingDelete: boolean;
  isDeletePending: boolean;
  onSelect: () => void;
  onDelete: (event: MouseEvent<HTMLButtonElement>) => void;
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
        </button>

        <Button
          aria-label={
            isConfirmingDelete
              ? `Confirm delete ${draft.objective}`
              : `Delete ${draft.objective}`
          }
          className={cn(
            "shrink-0",
            isConfirmingDelete &&
              "border-destructive bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
          )}
          disabled={isDeletePending}
          onClick={onDelete}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isConfirmingDelete ? (
            <CheckIcon className="size-4" />
          ) : (
            <Trash2Icon className="size-4" />
          )}
        </Button>
      </div>
    </div>
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
      <Card className="hidden overflow-hidden border-none xl:block">
        <CardHeader className="-mt-2">
          <div className="flex flex-col gap-4">
            <div className="min-w-0 space-y-3">
              <CardTitle className="w-full font-serif text-lg leading-tight">
                {flow.draft.objective}
              </CardTitle>
              <p className="max-w-5xl text-sm text-muted-foreground">
                {getDraftWorkspaceSummary(flow.draft)}
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
            <CardContent className="flex-1 pb-0 xl:min-h-0 xl:overflow-hidden">
              <div className="pb-5 xl:h-full xl:overflow-y-auto">
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
            <CardContent className="flex flex-1 flex-col space-y-4 xl:min-h-0">
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
                  className="min-h-[320px] font-mono text-sm xl:min-h-0 xl:flex-1"
                  onChange={(event) => onReviewMarkdownChange(event.target.value)}
                  value={reviewMarkdown}
                />
              ) : (
                <div className="border p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
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
  const { activeProject, activeProjectId, setActiveProjectId } = useProject();
  const requestedDraftId = searchParams.get("draftId");
  const [confirmDeleteDraftId, setConfirmDeleteDraftId] = useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

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
    queryKey: activeProjectId
      ? dashboardQueryKeys.drafts.all(activeProjectId)
      : dashboardQueryKeys.drafts.all("pending"),
    queryFn: () => fetchDrafts(activeProjectId!),
    ...(initialDrafts && activeProjectId
      ? {
          initialData: initialDrafts,
          initialDataUpdatedAt: getDraftsUpdatedAt(initialDrafts),
        }
      : {}),
    enabled: Boolean(activeProjectId),
    staleTime: dashboardQueryTimings.drafts.staleTime,
  });

  const drafts = getActiveDrafts(draftsQuery.data ?? []);
  const hasDraftsLoadError =
    Boolean(draftsQuery.error) && !draftsQuery.isLoading && !draftsQuery.isFetching;
  const showDraftsError = useDelayedVisibility(
    hasDraftsLoadError,
    ERROR_VISIBILITY_DELAY_MS,
  );
  const selectedDraftId =
    requestedDraftId && drafts.some((draft) => draft.id === requestedDraftId)
      ? requestedDraftId
      : initialSelectedDraftId ?? drafts[0]?.id ?? null;
  const deferredDraftId = useDeferredValue(selectedDraftId);

  useEffect(() => {
    if (!confirmDeleteDraftId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setConfirmDeleteDraftId((current) => (current === confirmDeleteDraftId ? null : current));
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [confirmDeleteDraftId]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }

    if (!drafts.length || requestedDraftId === selectedDraftId || !selectedDraftId) {
      return;
    }

    startTransition(() => {
      router.replace(buildDraftHref(pathname, selectedDraftId), { scroll: false });
    });
  }, [activeProjectId, drafts.length, pathname, requestedDraftId, router, selectedDraftId]);

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
  const showFlowError = useDelayedVisibility(
    Boolean(flowQuery.error) && !flowQuery.isLoading && !flowQuery.isFetching,
    ERROR_VISIBILITY_DELAY_MS,
  );
  const isFlowTransitioning = Boolean(selectedDraftId) && deferredDraftId !== selectedDraftId;
  const isFlowLoading =
    isFlowTransitioning || flowQuery.isLoading || (flowQuery.isFetching && !flowQuery.data);
  const selectedDraft = selectedDraftId
    ? drafts.find((draft) => draft.id === selectedDraftId) ?? null
    : null;
  const selectedDraftSummary =
    flowQuery.data?.draft.id === selectedDraftId
      ? getDraftWorkspaceSummary(flowQuery.data.draft)
      : selectedDraft
        ? getDraftWorkspaceSummary(selectedDraft)
        : null;

  const handleSelectDraft = (draftId: string) => {
    startTransition(() => {
      router.replace(buildDraftHref(pathname, draftId), { scroll: false });
    });
    setIsMobileDrawerOpen(false);
  };

  const handleDeleteDraft = (draftId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (confirmDeleteDraftId === draftId) {
      deleteDraftMutation.mutate(draftId);
      return;
    }

    setConfirmDeleteDraftId(draftId);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const pendingToast = window.sessionStorage.getItem(OBJECTIVE_START_SUCCESS_STORAGE_KEY);
    if (!pendingToast) {
      return;
    }

    try {
      const parsed = JSON.parse(pendingToast) as {
        draftId?: string;
        toastId?: string;
      };

      if (!parsed.draftId || parsed.draftId !== selectedDraftId) {
        return;
      }

      toast.success("Objective intake started.", {
        id: parsed.toastId ?? undefined,
      });
      window.sessionStorage.removeItem(OBJECTIVE_START_SUCCESS_STORAGE_KEY);
    } catch {
      window.sessionStorage.removeItem(OBJECTIVE_START_SUCCESS_STORAGE_KEY);
    }
  }, [selectedDraftId]);

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
    if (!activeProjectId) {
      return;
    }
    queryClient.setQueryData<IntakeDraft[] | undefined>(
      dashboardQueryKeys.drafts.all(activeProjectId),
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
      toast.success(
        flow.draft.status === "review_ready"
          ? "Clarification complete. Review draft ready."
          : "Clarification answers saved.",
      );
    },
    onError: (submissionError, flow, context) => {
      if (context?.previousFlow) {
        syncFlow(context.previousFlow);
      }

      toast.error(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to continue clarification.",
      );
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
      toast.success("Draft saved.");
    },
    onError: (saveError, flow, context) => {
      if (context?.previousFlow) {
        syncFlow(context.previousFlow);
      }

      toast.error(saveError instanceof Error ? saveError.message : "Unable to save draft.");
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft.");
    },
  });

  const startExecution = useMutation({
    mutationFn: async (flow: IntakeFlowResponse) =>
      fetchJson<{
        runId: string;
        runStatus?: "ready" | "blocked" | "running" | "completed" | "failed" | "clarifying";
        actionRequired?: unknown;
      }>(`/api/intake/drafts/${flow.draft.id}/execute`, {
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
      if (flow.draft.projectId) {
        setActiveProjectId(flow.draft.projectId);
      }
      queryClient.setQueryData<IntakeDraft[] | undefined>(
        dashboardQueryKeys.drafts.all(flow.draft.projectId ?? activeProjectId ?? "pending"),
        (currentDrafts) => currentDrafts?.filter((draft) => draft.id !== flow.draft.id),
      );
      if (payload.runStatus === "blocked" || payload.actionRequired) {
        await queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.notifications.all,
        });
      }
      if (activeProjectId) {
        await queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.runs.all(activeProjectId),
        });
      }
      toast.success("Execution started.");
      startTransition(() => {
        router.push(`/dashboard/runs?runId=${payload.runId}`);
      });
    },
    onError: (executeError, flow, context) => {
      if (context?.previousFlow) {
        syncFlow(context.previousFlow);
      }

      toast.error(
        executeError instanceof Error ? executeError.message : "Unable to start execution.",
      );
      setError(
        executeError instanceof Error ? executeError.message : "Unable to start execution.",
      );
    },
  });
  const deleteDraftMutation = useMutation({
    mutationFn: (draftId: string) => deleteDraft(draftId),
    onSuccess: ({ draftId }) => {
      const currentDrafts =
        queryClient.getQueryData<IntakeDraft[]>(
          activeProjectId
            ? dashboardQueryKeys.drafts.all(activeProjectId)
            : dashboardQueryKeys.drafts.all("pending"),
        ) ?? [];
      const nextDrafts = currentDrafts.filter((draft) => draft.id !== draftId);

      if (activeProjectId) {
        queryClient.setQueryData(dashboardQueryKeys.drafts.all(activeProjectId), nextDrafts);
      }
      queryClient.removeQueries({
        queryKey: dashboardQueryKeys.drafts.flow(draftId),
      });
      setConfirmDeleteDraftId(null);

      if (selectedDraftId === draftId) {
        const nextDraft = nextDrafts[0] ?? null;
        startTransition(() => {
          if (nextDraft) {
            router.replace(buildDraftHref(pathname, nextDraft.id), { scroll: false });
            return;
          }

          router.replace(pathname, { scroll: false });
        });
      }

      toast.success("Draft deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete draft.");
    },
  });

  return (
    <WorkspaceSplitLayout
      mobileDescription={selectedDraftSummary}
      mobileSelector={
        activeProject ? (
          <Drawer onOpenChange={setIsMobileDrawerOpen} open={isMobileDrawerOpen}>
            <DrawerTrigger asChild>
              <Button className="w-full justify-between" type="button" variant="outline">
                <span className="flex items-center gap-2">
                  <PanelLeftIcon className="size-4" />
                  {selectedDraft ? "Browse drafts" : "Select a draft"}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {drafts.length}
                  <ChevronDownIcon className="size-4" />
                </span>
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="text-left">
                <DrawerTitle>Drafts</DrawerTitle>
                <DrawerDescription>
                  Open an in-progress draft to continue clarification, review the plan, or launch execution.
                </DrawerDescription>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-4">
                <div className="space-y-2">
                  {drafts.map((draft) => (
                    <DraftListItem
                      draft={draft}
                      isActive={draft.id === selectedDraftId}
                      isConfirmingDelete={confirmDeleteDraftId === draft.id}
                      isDeletePending={deleteDraftMutation.isPending}
                      key={draft.id}
                      onDelete={(event) => handleDeleteDraft(draft.id, event)}
                      onSelect={() => handleSelectDraft(draft.id)}
                    />
                  ))}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        ) : null
      }
      mobileTitle={selectedDraft?.objective ?? null}
      sidebar={
        <WorkspaceSidebarPanel
          description="Open an in-progress draft to continue clarification, review the plan, or launch execution."
          title="Drafts"
        >
          {!activeProject ? (
            <Empty className="border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>Select a project</EmptyTitle>
                <EmptyDescription>
                  Choose a project from the switcher before opening project-scoped drafts.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {showDraftsError ? (
            <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {draftsQuery.error instanceof Error
                ? draftsQuery.error.message
                : "Unable to load drafts."}
            </div>
          ) : null}

          {activeProject && !isRestoring && !draftsQuery.isLoading && !showDraftsError && drafts.length === 0 ? (
            <Empty className="border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>No drafts yet</EmptyTitle>
                <EmptyDescription>
                  Start a project objective intake to create the first draft for {activeProject.name}.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          <div className="space-y-2">
            {drafts.map((draft) => {
              return (
                <DraftListItem
                  draft={draft}
                  isActive={draft.id === selectedDraftId}
                  isConfirmingDelete={confirmDeleteDraftId === draft.id}
                  isDeletePending={deleteDraftMutation.isPending}
                  key={draft.id}
                  onDelete={(event) => handleDeleteDraft(draft.id, event)}
                  onSelect={() => handleSelectDraft(draft.id)}
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
                    <FileTextIcon />
                  </EmptyMedia>
                  <EmptyTitle>Select a project</EmptyTitle>
                  <EmptyDescription>
                    Choose a project from the switcher to open only that project&apos;s objective drafts.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : !selectedDraftId && (isRestoring || draftsQuery.isLoading) ? (
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
        ) : isFlowLoading || (flowQuery.error && !showFlowError) ? (
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
