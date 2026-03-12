import { NextResponse } from "next/server";
import { z } from "zod";

import { clarifyObjective } from "@/lib/agents/orchestrator";
import {
  fetchIntakeDraftWithQuestions,
  replaceIntakeQuestions,
  updateIntakeDraft,
  updateIntakeQuestionAnswers,
} from "@/lib/intake/repository";
import type { IntakeFlowResponse } from "@/lib/intake/types";
import {
  appendClarificationMessage,
  fetchClarificationTranscript,
  insertUsageRecords,
} from "@/lib/runs/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  draftId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        answer: z.string().max(2000),
      }),
    )
    .min(1),
  currentStep: z.number().int().min(0).optional(),
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Unable to continue clarification.";
}

function buildClarificationMessage(
  questions: Array<{ question: string; answer: string; isOptional: boolean }>,
) {
  return questions
    .map((question, index) => {
      const answer = question.answer.trim();
      const renderedAnswer = answer || (question.isOptional ? "Left open for now." : "No answer provided yet.");
      return `${index + 1}. ${question.question}\nAnswer: ${renderedAnswer}`;
    })
    .join("\n\n");
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const payload = bodySchema.parse(await request.json());
    const supabase = await createClient();
    const existing = await fetchIntakeDraftWithQuestions(supabase, {
      draftId: payload.draftId,
      userId: user.sub,
    });

    await updateIntakeQuestionAnswers(supabase, {
      draftId: payload.draftId,
      answers: payload.answers,
    });

    const updatedQuestions = existing.questions.map((question) => {
      const incoming = payload.answers.find((item) => item.questionId === question.id);
      return {
        ...question,
        answer: incoming ? incoming.answer : question.answer,
      };
    });

    const answerMessage = buildClarificationMessage(
      updatedQuestions.map((question) => ({
        question: question.question,
        answer: question.answer,
        isOptional: question.isOptional,
      })),
    );

    await appendClarificationMessage(supabase, {
      sessionId: existing.draft.sessionId,
      userId: user.sub,
      role: "user",
      content: answerMessage,
    });

    const transcript = await fetchClarificationTranscript(supabase, {
      sessionId: existing.draft.sessionId,
      userId: user.sub,
    });

    const result = await clarifyObjective({
      objective: existing.draft.objective,
      transcript: transcript.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    await appendClarificationMessage(supabase, {
      sessionId: existing.draft.sessionId,
      userId: user.sub,
      role: "assistant",
      content: result.summary,
      questions: result.questions.map((question) => question.question),
    });

    const isReviewReady = result.status === "ready_to_execute";
    const nextQuestions = isReviewReady && result.questions.length === 0
      ? updatedQuestions.map((question) => ({
          question: question.question,
          description: question.description,
          optional: question.isOptional,
          inputKind: question.inputKind,
        }))
      : result.questions;
    const savedQuestions = await replaceIntakeQuestions(supabase, {
      draftId: payload.draftId,
      questions: nextQuestions,
    });
    const savedDraft = await updateIntakeDraft(supabase, {
      draftId: payload.draftId,
      userId: user.sub,
      patch: {
        status: isReviewReady ? "review_ready" : "collecting_input",
        clarificationSummary: result.summary,
        executionMode: result.executionMode,
        confidenceToProceed: result.confidenceToProceed,
        currentStep: Math.min(payload.currentStep ?? 0, Math.max(nextQuestions.length - 1, 0)),
        questionCount: nextQuestions.length,
        generatedMarkdown: result.draftMarkdown || null,
        draftMarkdown: result.draftMarkdown || existing.draft.draftMarkdown,
        taskDrafts: result.tasks,
        eventNarrative: result.eventNarrative,
        lastGeneratedAt: isReviewReady ? new Date().toISOString() : existing.draft.lastGeneratedAt,
      },
    });

    await insertUsageRecords(supabase, user.sub, [
      {
        runId: null,
        sessionId: existing.draft.sessionId,
        category: "chat",
        name: "clarification_turn",
        agentId: "orchestrator",
        status: "succeeded",
        inputSummary: answerMessage,
        resultSummary: result.summary,
        tokenCount: null,
        latencyMs: null,
        costEstimate: null,
      },
    ]);

    const response: IntakeFlowResponse = {
      draft: savedDraft,
      questions: savedQuestions,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("POST /api/intake/respond failed", error);

    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
