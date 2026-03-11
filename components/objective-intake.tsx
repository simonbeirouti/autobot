"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type IntakeResponse = {
  sessionId: string;
  status: "needs_input" | "ready_to_execute";
  summary: string;
  questions: string[];
  runId?: string;
  error?: string;
};

const starterPrompts = [
  "Launch an AI assistant for our SDR team that can qualify inbound leads.",
  "Reduce support backlog by automating ticket triage and handoff.",
  "Design a workflow to research competitors and summarize weekly changes.",
];

function getSuggestedAnswers(question: string) {
  const normalizedQuestion = question.toLowerCase();

  if (
    normalizedQuestion.includes("outcome") ||
    normalizedQuestion.includes("success") ||
    normalizedQuestion.includes("metric")
  ) {
    return [
      "Success means shipping a working first version that the team can use this month.",
      "The primary KPI is reducing manual work by at least 30%.",
      "We need a measurable business result, not just a prototype demo.",
    ];
  }

  if (
    normalizedQuestion.includes("audience") ||
    normalizedQuestion.includes("customer") ||
    normalizedQuestion.includes("user")
  ) {
    return [
      "This is mainly for our internal operations team.",
      "The first users are our existing customers in the mid-market segment.",
      "The audience is the sales team, with managers as the main stakeholders.",
    ];
  }

  if (
    normalizedQuestion.includes("deadline") ||
    normalizedQuestion.includes("constraint") ||
    normalizedQuestion.includes("respect") ||
    normalizedQuestion.includes("timeline")
  ) {
    return [
      "Keep the first version lightweight and ready within two weeks.",
      "Do not require new vendors or a major process change.",
      "Stay within current tools and avoid handling sensitive customer data.",
    ];
  }

  return [
    "Optimize for speed to first value over completeness.",
    "Keep the first version simple and easy for the team to adopt.",
    "Assume a small pilot before broader rollout.",
  ];
}

export function ObjectiveIntake() {
  const router = useRouter();
  const [objective, setObjective] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyRunId, setReadyRunId] = useState<string | null>(null);

  const canStart = objective.trim().length >= 8 && !isSubmitting;
  const canRespond =
    questions.length > 0 &&
    questions.every((question) => (answers[question] ?? "").trim().length > 0) &&
    !isSubmitting;

  const statusLabel = useMemo(() => {
    if (readyRunId) {
      return "Execution ready";
    }
    if (questions.length > 0) {
      return "Clarifying scope";
    }
    return "Waiting for an objective";
  }, [questions.length, readyRunId]);

  useEffect(() => {
    setAnswers((currentAnswers) =>
      Object.fromEntries(
        questions.map((question) => [question, currentAnswers[question] ?? ""]),
      ),
    );
  }, [questions]);

  function setAnswerForQuestion(question: string, value: string) {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [question]: value,
    }));
  }

  function buildClarificationAnswer() {
    return questions
      .map(
        (question, index) =>
          `${index + 1}. ${question}\nAnswer: ${(answers[question] ?? "").trim()}`,
      )
      .join("\n\n");
  }

  async function submitObjective() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/intake/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
      });
      const payload = (await response.json()) as IntakeResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to start intake.");
      }

      setSessionId(payload.sessionId);
      setSummary(payload.summary);
      setQuestions(payload.questions);
      setAnswers({});

      if (payload.runId) {
        setReadyRunId(payload.runId);
      }
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

  async function submitClarificationAnswer() {
    if (!sessionId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/intake/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          sessionId,
          answer: buildClarificationAnswer(),
        }),
      });
      const payload = (await response.json()) as IntakeResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to continue clarification.");
      }

      setSummary(payload.summary);
      setQuestions(payload.questions);
      setAnswers({});

      if (payload.runId) {
        setReadyRunId(payload.runId);
      }
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

  useEffect(() => {
    if (!readyRunId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      startTransition(() => {
        router.push(`/runs/${readyRunId}`);
      });
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [readyRunId, router]);

  return (
    <section className="relative flex min-h-full flex-col items-center justify-center overflow-hidden py-16">

      <div className="w-full max-w-4xl space-y-8">
        <div className="border border-black/10 bg-white/85 p-4 shadow-[0_30px_80px_rgba(73,58,28,0.14)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              className="pl-3 text-base shadow-none focus-visible:ring-0 sm:text-lg"
              onChange={(event) => setObjective(event.target.value)}
              placeholder="Describe the business objective you want the agent system to own..."
              value={objective}
            />
            <Button
              className="text-base"
              disabled={!canStart}
              onClick={submitObjective}
            >
              {isSubmitting && !sessionId ? "Thinking..." : "Start"}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {starterPrompts.map((prompt) => (
              <button
                className="border border-black/10 bg-black/[0.03] px-3 py-1.5 text-left text-xs text-foreground/70 transition hover:bg-black/[0.06]"
                key={prompt}
                onClick={() => setObjective(prompt)}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full">
          <div className="border border-black/10 bg-white/70 p-6 shadow-[0_16px_50px_rgba(73,58,28,0.08)] backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-foreground/45">
                  Agent State
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{statusLabel}</h2>
              </div>
              <div className="border border-black/10 px-3 py-1 text-xs text-foreground/60">
                {sessionId ? `Session ${sessionId.slice(0, 8)}` : "No session"}
              </div>
            </div>

            {summary ? (
              <div className="bg-stone-950 px-5 py-4 font-mono text-sm text-stone-100">
                {summary}
              </div>
            ) : (
              <div className="border border-dashed border-black/12 px-5 py-8 text-sm text-foreground/55">
                The first response will decide whether clarification is needed or the
                agent can move directly into a run.
              </div>
            )}

            {questions.length > 0 ? (
              <div className="mt-5 space-y-4">
                <div className="border border-black/8 bg-black/[0.02] px-4 py-3 text-sm text-foreground/65">
                  Answer each clarification item directly or use a suggested response to move faster.
                </div>
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div
                      className="border border-black/8 bg-black/[0.03] p-4"
                      key={`${question}-${index}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground/45">
                          Clarification {index + 1}
                        </p>
                        <div className="text-xs text-foreground/45">
                          {(answers[question] ?? "").trim().length > 0 ? "Answered" : "Needs input"}
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-medium text-foreground">{question}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {getSuggestedAnswers(question).map((suggestion) => (
                          <button
                            className="border border-black/10 bg-white/80 px-3 py-1.5 text-left text-xs text-foreground/75 transition hover:bg-white"
                            key={suggestion}
                            onClick={() => setAnswerForQuestion(question, suggestion)}
                            type="button"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        className="mt-3 min-h-24 border-black/10 bg-white/80 px-4 py-3 text-sm shadow-none focus-visible:ring-0"
                        onChange={(event) => setAnswerForQuestion(question, event.target.value)}
                        placeholder="Add your answer or refine one of the suggested options..."
                        value={answers[question] ?? ""}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3 border border-black/8 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-foreground/60">
                    AutoBot will combine these answers into the next planning pass.
                  </p>
                  <Button
                    className="h-12 px-6"
                    disabled={!canRespond}
                    onClick={submitClarificationAnswer}
                  >
                    {isSubmitting ? "Updating..." : "Continue"}
                  </Button>
                </div>
              </div>
            ) : null}

            {readyRunId ? (
              <div className="mt-5 border border-emerald-400/35 bg-emerald-500/10 px-5 py-4">
                <p className="text-sm text-emerald-950">
                  Intake is locked. Opening the live workspace now.
                </p>
                <Button
                  className="mt-3"
                  onClick={() => router.push(`/runs/${readyRunId}`)}
                  variant="secondary"
                >
                  Open workspace
                </Button>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-900">
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
        </div>
      </div>
    </section>
  );
}
