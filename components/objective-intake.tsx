"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";

import { MarkdownPreview } from "@/components/markdown-preview";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { IntakeDraft, IntakeFlowResponse, IntakeQuestion } from "@/lib/intake/types";

const starterPrompts = [
  "Launch an AI assistant for our SDR team that can qualify inbound leads.",
  "Reduce support backlog by automating ticket triage and handoff.",
  "Design a workflow to research competitors and summarize weekly changes.",
];

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

function getDraftStatusLabel(draft: IntakeDraft) {
  if (draft.status === "review_ready") {
    return "Review ready";
  }

  if (draft.status === "executing") {
    return "Executing";
  }

  if (draft.status === "archived") {
    return "Archived";
  }

  return "Collecting input";
}

function getDraftActionLabel(draft: IntakeDraft) {
  if (draft.status === "review_ready") {
    return "Review draft";
  }

  if (draft.status === "executing") {
    return "Open run";
  }

  return "Resume questions";
}

function normalizeAnswers(questions: IntakeQuestion[]) {
  return Object.fromEntries(questions.map((question) => [question.id, question.answer]));
}

export function ObjectiveIntake() {
  const router = useRouter();
  const [objective, setObjective] = useState("");
  const [drafts, setDrafts] = useState<IntakeDraft[]>([]);
  const [activeFlow, setActiveFlow] = useState<IntakeFlowResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [reviewMarkdown, setReviewMarkdown] = useState("");
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [didAutoloadDraft, setDidAutoloadDraft] = useState(false);

  const canStart = objective.trim().length >= 8 && !isSubmitting;
  const activeQuestions = activeFlow?.questions ?? [];
  const activeQuestion = activeQuestions[currentStep] ?? null;
  const currentAnswer = activeQuestion ? answers[activeQuestion.id] ?? "" : "";

  const reviewHasQuestionEdits = activeQuestions.length > 0;

  async function refreshDrafts() {
    const nextDrafts = await fetchJson<IntakeDraft[]>("/api/intake/drafts");
    setDrafts(
      nextDrafts.filter((draft) => draft.status !== "archived" && draft.runId === null),
    );
    return nextDrafts;
  }

  useEffect(() => {
    void (async () => {
      try {
        const loadedDrafts = await refreshDrafts();
        if (didAutoloadDraft) {
          return;
        }

        const candidate = loadedDrafts.find(
          (draft) =>
            draft.runId === null &&
            (draft.status === "collecting_input" || draft.status === "review_ready"),
        );

        if (!candidate) {
          setDidAutoloadDraft(true);
          return;
        }

        setDidAutoloadDraft(true);
        const flow = await fetchJson<IntakeFlowResponse>(`/api/intake/drafts/${candidate.id}`);

        if (flow.draft.status === "executing" && flow.draft.runId) {
          startTransition(() => {
            router.push(`/dashboard/runs?runId=${flow.draft.runId}`);
          });
          return;
        }

        syncActiveFlow(flow);
        setQuestionsOpen(flow.draft.status === "collecting_input");
        setReviewOpen(flow.draft.status === "review_ready");
      } catch (loadError) {
        setDidAutoloadDraft(true);
        setError(loadError instanceof Error ? loadError.message : "Unable to load drafts.");
      }
    })();
  }, [didAutoloadDraft, router]);

  function syncActiveFlow(flow: IntakeFlowResponse) {
    setActiveFlow(flow);
    setAnswers(normalizeAnswers(flow.questions));
    setCurrentStep(Math.min(flow.draft.currentStep, Math.max(flow.questions.length - 1, 0)));
    setReviewMarkdown(flow.draft.draftMarkdown ?? flow.draft.generatedMarkdown ?? "");
    setDrafts((currentDrafts) => {
      const next = [
        ...currentDrafts.filter((draft) => draft.id !== flow.draft.id),
        ...(flow.draft.runId === null && flow.draft.status !== "archived" ? [flow.draft] : []),
      ];
      return next.sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );
    });
  }

  async function openDraft(draftId: string, automatic = false) {
    try {
      setError(null);
      const flow = await fetchJson<IntakeFlowResponse>(`/api/intake/drafts/${draftId}`);
      if (flow.draft.status === "executing" && flow.draft.runId) {
        startTransition(() => {
          router.push(`/dashboard/runs?runId=${flow.draft.runId}`);
        });
        return;
      }

      syncActiveFlow(flow);
      setQuestionsOpen(flow.draft.status === "collecting_input");
      setReviewOpen(flow.draft.status === "review_ready");
      setIsEditingReview(false);

      if (automatic && flow.draft.status === "executing") {
        setQuestionsOpen(false);
        setReviewOpen(false);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load draft.");
    }
  }

  async function persistQuestionProgress(nextStep: number) {
    if (!activeFlow) {
      return;
    }

    await fetchJson<IntakeFlowResponse>(`/api/intake/drafts/${activeFlow.draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentStep: nextStep,
        answers: activeQuestions.map((question) => ({
          questionId: question.id,
          answer: answers[question.id] ?? "",
        })),
      }),
    }).then((flow) => {
      syncActiveFlow(flow);
    });
  }

  async function submitObjective() {
    setIsSubmitting(true);
    setError(null);

    try {
      const flow = await fetchJson<IntakeFlowResponse>("/api/intake/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
      });

      syncActiveFlow(flow);
      setQuestionsOpen(flow.draft.status === "collecting_input");
      setReviewOpen(flow.draft.status === "review_ready");
      setIsEditingReview(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to start intake.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitClarificationAnswers() {
    if (!activeFlow) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const flow = await fetchJson<IntakeFlowResponse>("/api/intake/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: activeFlow.draft.id,
          currentStep,
          answers: activeQuestions.map((question) => ({
            questionId: question.id,
            answer: answers[question.id] ?? "",
          })),
        }),
      });

      syncActiveFlow(flow);
      const shouldOpenQuestions = flow.draft.status === "collecting_input";
      setQuestionsOpen(shouldOpenQuestions);
      setReviewOpen(flow.draft.status === "review_ready");
      setIsEditingReview(false);
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
    if (!activeFlow) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const flow = await fetchJson<IntakeFlowResponse>(`/api/intake/drafts/${activeFlow.draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftMarkdown: reviewMarkdown,
          currentStep,
        }),
      });
      syncActiveFlow(flow);
      setIsEditingReview(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft.");
    } finally {
      setIsSaving(false);
    }
  }

  async function startExecution(draftId?: string) {
    const targetDraftId = draftId ?? activeFlow?.draft.id;

    if (!targetDraftId) {
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const payload = await fetchJson<{ runId: string }>(
        `/api/intake/drafts/${targetDraftId}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      await refreshDrafts();
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

  async function handleQuestionDialogChange(nextOpen: boolean) {
    setQuestionsOpen(nextOpen);

    if (!nextOpen && activeFlow) {
      try {
        await persistQuestionProgress(currentStep);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save progress.");
      }
    }
  }

  function updateAnswer(questionId: string, value: string) {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: value,
    }));
  }

  const questionProgressLabel =
    activeQuestions.length > 0 ? `${currentStep + 1} of ${activeQuestions.length}` : null;
  const isLastQuestion = activeQuestions.length === 0 || currentStep === activeQuestions.length - 1;

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

        {drafts.length > 0 ? (
          <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
            {drafts.map((draft) => (
              <Card className="h-full min-h-[14rem]" key={draft.id}>
                <CardHeader>
                  <div className="space-y-2">
                    <CardTitle>{draft.objective}</CardTitle>
                    <CardDescription className="line-clamp-3">
                      {draft.clarificationSummary ??
                        "Draft created. Continue the intake to generate a plan."}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-end space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Updated {formatDistanceToNowStrict(new Date(draft.updatedAt))} ago</span>
                    <Badge variant={draft.status === "review_ready" ? "default" : "outline"}>
                      {getDraftStatusLabel(draft)}
                    </Badge>
                    {draft.executionMode ? (
                      <Badge variant="secondary">
                        {draft.executionMode.replace("_", " ")}
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
                <CardFooter className="justify-between gap-3">
                  <Button onClick={() => openDraft(draft.id)} variant="outline">
                    {getDraftActionLabel(draft)}
                  </Button>
                  {draft.status === "review_ready" ? (
                    <Button onClick={() => startExecution(draft.id)} disabled={isExecuting && activeFlow?.draft.id === draft.id}>
                      {isExecuting && activeFlow?.draft.id === draft.id ? "Starting..." : "Start execution"}
                    </Button>
                  ) : null}
                </CardFooter>
              </Card>
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
      </div>

      <Dialog onOpenChange={handleQuestionDialogChange} open={questionsOpen}>
        <DialogContent className="w-full sm:min-w-2xl md:min-w-3xl">
          <DialogHeader>
            <div className="flex flex-row items-center gap-2">
              <DialogTitle>Question</DialogTitle>
              {questionProgressLabel ? <span className="text-sm text-muted-foreground">{questionProgressLabel}</span> : null}
            </div>
          </DialogHeader>

          {activeQuestion ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-base font-medium">{activeQuestion.question}</p>
                <p className="text-sm text-muted-foreground">{activeQuestion.description}</p>
              </div>

              <Textarea
                className="min-h-32"
                onChange={(event) => updateAnswer(activeQuestion.id, event.target.value)}
                placeholder="Add the context the agent needs..."
                value={currentAnswer}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active clarification questions for this draft.
            </p>
          )}

          <DialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <Button
              className="w-full"
              disabled={currentStep === 0 || isSaving || isSubmitting}
              onClick={async () => {
                const nextStep = Math.max(currentStep - 1, 0);
                setCurrentStep(nextStep);
                setIsSaving(true);
                try {
                  await persistQuestionProgress(nextStep);
                } catch (saveError) {
                  setError(saveError instanceof Error ? saveError.message : "Unable to save progress.");
                } finally {
                  setIsSaving(false);
                }
              }}
              variant="outline"
            >
              Back
            </Button>
            {isLastQuestion ? (
              <Button
                className="w-full"
                disabled={isSubmitting || !activeFlow}
                onClick={submitClarificationAnswers}
              >
                {isSubmitting ? "Generating..." : "Generate draft"}
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={!activeQuestion || isSaving || isSubmitting}
                onClick={async () => {
                  const nextStep = Math.min(currentStep + 1, activeQuestions.length - 1);
                  setCurrentStep(nextStep);
                  setIsSaving(true);
                  try {
                    await persistQuestionProgress(nextStep);
                  } catch (saveError) {
                    setError(saveError instanceof Error ? saveError.message : "Unable to save progress.");
                  } finally {
                    setIsSaving(false);
                  }
                }}
              >
                Next
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setReviewOpen} open={reviewOpen}>
        <DialogContent className="w-full sm:min-w-2xl md:min-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle>Review draft</DialogTitle>
                <DialogDescription>
                  Edit the markdown directly or return to the questions to regenerate the draft.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setIsEditingReview((current) => !current)}
                variant="outline"
              >
                {isEditingReview ? "Preview markdown" : "Edit markdown"}
              </Button>
              <Button
                disabled={!reviewHasQuestionEdits}
                onClick={() => {
                  setReviewOpen(false);
                  setQuestionsOpen(true);
                }}
                variant="outline"
              >
                Edit questions
              </Button>
              <Button
                disabled={!reviewHasQuestionEdits || isSubmitting}
                onClick={submitClarificationAnswers}
                variant="outline"
              >
                {isSubmitting ? "Regenerating..." : "Regenerate draft"}
              </Button>
            </div>

            {isEditingReview ? (
              <Textarea
                className="min-h-[420px] font-mono text-sm"
                onChange={(event) => setReviewMarkdown(event.target.value)}
                value={reviewMarkdown}
              />
            ) : (
              <div className="max-h-[420px] overflow-y-auto border p-4">
                <MarkdownPreview content={reviewMarkdown} className="space-y-1" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={isSaving || !activeFlow}
              onClick={saveReviewDraft}
              variant="outline"
            >
              {isSaving ? "Saving..." : "Save draft"}
            </Button>
            <Button disabled={isExecuting || !activeFlow} onClick={() => startExecution()}>
              {isExecuting ? "Starting..." : "Start execution"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
