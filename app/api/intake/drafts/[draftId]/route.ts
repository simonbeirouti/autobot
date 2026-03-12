import { NextResponse } from "next/server";
import { z } from "zod";

import {
  fetchIntakeDraftWithQuestions,
  updateIntakeDraft,
  updateIntakeQuestionAnswers,
} from "@/lib/intake/repository";
import type { IntakeFlowResponse } from "@/lib/intake/types";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  draftMarkdown: z.string().max(20_000).optional(),
  currentStep: z.number().int().min(0).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        answer: z.string().max(2000),
      }),
    )
    .optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ draftId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { draftId } = await context.params;
    const supabase = await createClient();
    const draft = await fetchIntakeDraftWithQuestions(supabase, { draftId, userId: user.sub });
    const response: IntakeFlowResponse = draft;
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load draft." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ draftId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const payload = bodySchema.parse(await request.json());
    const { draftId } = await context.params;
    const supabase = await createClient();

    if (payload.answers?.length) {
      await updateIntakeQuestionAnswers(supabase, {
        draftId,
        answers: payload.answers,
      });
    }

    const draft = await updateIntakeDraft(supabase, {
      draftId,
      userId: user.sub,
      patch: {
        currentStep: payload.currentStep,
        draftMarkdown: payload.draftMarkdown,
        lastEditedAt: payload.draftMarkdown !== undefined ? new Date().toISOString() : undefined,
      },
    });
    const questions = (await fetchIntakeDraftWithQuestions(supabase, {
      draftId,
      userId: user.sub,
    })).questions;

    const response: IntakeFlowResponse = { draft, questions };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update draft." },
      { status: 500 },
    );
  }
}
