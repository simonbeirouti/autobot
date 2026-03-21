import { NextResponse } from "next/server";
import { z } from "zod";

import { clarificationQuestionResponseSchema } from "@/lib/agents/schemas";
import {
  fetchIntakeDraftWithQuestions,
  updateIntakeDraft,
  updateIntakeQuestionAnswers,
} from "@/lib/intake/repository";
import type { IntakeFlowResponse } from "@/lib/intake/types";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { buildProjectToolPreflight } from "@/lib/tools/preflight";

async function buildDraftToolPreflight(
  supabase: Awaited<ReturnType<typeof createClient>>,
  draft: IntakeFlowResponse["draft"],
  userId: string,
) {
  if (!draft.projectId) {
    return null;
  }

  return buildProjectToolPreflight(supabase, {
    userId,
    projectId: draft.projectId,
    objective: draft.objective,
    tasks: draft.taskDrafts.map((task) => ({
      title: task.title,
      toolRequirement: task.toolRequirement,
      executionStrategy: task.executionStrategy,
      toolSummary: task.toolSummary || null,
      requiredToolkitSlugs: task.requiredToolkitSlugs,
      optionalToolkitSlugs: task.optionalToolkitSlugs,
    })),
    nextPath: `/dashboard/drafts?draftId=${draft.id}`,
  });
}

const bodySchema = z.object({
  draftMarkdown: z.string().max(20_000).optional(),
  currentStep: z.number().int().min(0).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        response: clarificationQuestionResponseSchema,
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
    const toolPreflight = await buildDraftToolPreflight(supabase, draft.draft, user.sub);
    const response: IntakeFlowResponse = {
      ...draft,
      toolPreflight,
    };
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
      const existing = await fetchIntakeDraftWithQuestions(supabase, { draftId, userId: user.sub });
      await updateIntakeQuestionAnswers(supabase, {
        draftId,
        answers: existing.questions.map((question) => {
          const incoming = payload.answers?.find((item) => item.questionId === question.id);
          const response = incoming?.response ?? question.response;
          const optionLabels = (response.selectedOptionIds ?? [])
            .filter((optionId) => optionId !== "__other__")
            .map((optionId) => question.options.find((option) => option.id === optionId)?.label ?? optionId);
          const answerText = question.inputKind === "text"
            ? response.text?.trim() ?? ""
            : [...optionLabels, response.otherText?.trim() ?? ""]
                .filter((value) => value.length > 0)
                .join(", ");

          return {
            questionId: question.id,
            response,
            answerText,
          };
        }),
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

    const toolPreflight = await buildDraftToolPreflight(supabase, draft, user.sub);
    const response: IntakeFlowResponse = { draft, questions, toolPreflight };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update draft." },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    const { error } = await supabase
      .from("intake_drafts")
      .delete()
      .eq("id", draftId)
      .eq("user_id", user.sub);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true as const, draftId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete draft." },
      { status: 500 },
    );
  }
}
