import { NextResponse } from "next/server";
import { z } from "zod";

import { clarifyObjective } from "@/lib/agents/orchestrator";
import {
  createIntakeDraft,
  replaceIntakeQuestions,
  updateIntakeDraft,
} from "@/lib/intake/repository";
import type { IntakeFlowResponse } from "@/lib/intake/types";
import {
  appendClarificationMessage,
  createSessionId,
  insertUsageRecords,
} from "@/lib/runs/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  objective: z.string().min(8).max(2000),
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

  return "Unable to start intake.";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const payload = bodySchema.parse(await request.json());
    const sessionId = createSessionId();
    const supabase = await createClient();
    const draft = await createIntakeDraft(supabase, {
      sessionId,
      userId: user.sub,
      projectId: payload.projectId,
      objective: payload.objective,
    });

    await appendClarificationMessage(supabase, {
      sessionId,
      userId: user.sub,
      role: "user",
      content: payload.objective,
    });

    const result = await clarifyObjective({
      objective: payload.objective,
      transcript: [{ role: "user", content: payload.objective }],
      clarificationRounds: 0,
    });

    await appendClarificationMessage(supabase, {
      sessionId,
      userId: user.sub,
      role: "assistant",
      content: result.summary,
      questions: result.questions.map((question) => question.prompt),
    });

    const isReviewReady = result.status === "ready_to_execute";
    const savedQuestions = await replaceIntakeQuestions(supabase, {
      draftId: draft.id,
      questions: result.questions,
    });
    const savedDraft = await updateIntakeDraft(supabase, {
      draftId: draft.id,
      userId: user.sub,
      patch: {
        status: isReviewReady ? "review_ready" : "collecting_input",
        clarificationSummary: result.summary,
        executionMode: result.executionMode,
        confidenceToProceed: result.confidenceToProceed,
        currentStep: 0,
        questionCount: result.questions.length,
        generatedMarkdown: result.draftMarkdown || null,
        draftMarkdown: result.draftMarkdown || null,
        taskDrafts: result.tasks,
        eventNarrative: result.eventNarrative,
        lastGeneratedAt: isReviewReady ? new Date().toISOString() : null,
      },
    });

    await insertUsageRecords(supabase, user.sub, [
      {
        runId: null,
        sessionId,
        category: "chat",
        name: "clarification_turn",
        agentId: "orchestrator",
        status: "succeeded",
        inputSummary: payload.objective,
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
    console.error("POST /api/intake/start failed", error);

    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
