import { NextResponse } from "next/server";
import { z } from "zod";

import { clarifyObjective } from "@/lib/agents/orchestrator";
import { clarificationQuestionResponseSchema } from "@/lib/agents/schemas";
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
import {
  buildProjectToolPreflight,
  resolveProjectToolPlanningTasks,
} from "@/lib/tools/preflight";
import {
  applyAnsweredToolInputQuestions,
  buildMissingToolInputQuestions,
  withInferredToolInputs,
} from "@/lib/tools/input-requirements";
import { resolveProjectTools } from "@/lib/tools/resolver";
import { resolveProjectToolRuntime } from "@/lib/tools/runtime";

const bodySchema = z.object({
  draftId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        response: clarificationQuestionResponseSchema,
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
  questions: Array<{
    question: string;
    answerText: string;
    isOptional: boolean;
  }>,
) {
  return questions
    .map((question, index) => {
      const answer = question.answerText.trim();
      const renderedAnswer = answer || (question.isOptional ? "Left open for now." : "No answer provided yet.");
      return `${index + 1}. ${question.question}\nAnswer: ${renderedAnswer}`;
    })
    .join("\n\n");
}

function formatResponseAnswer(question: {
  inputKind: string;
  options: Array<{ id: string; label: string }>;
  allowOther: boolean;
  response: { selectedOptionIds?: string[]; otherText?: string; text?: string };
}) {
  if (question.inputKind === "text") {
    return question.response.text?.trim() ?? "";
  }

  const optionLabels = (question.response.selectedOptionIds ?? [])
    .filter((optionId) => optionId !== "__other__")
    .map((optionId) => question.options.find((option) => option.id === optionId)?.label ?? optionId)
    .filter(Boolean);
  const otherText = question.allowOther ? question.response.otherText?.trim() ?? "" : "";
  return [...optionLabels, otherText].filter((value) => value.length > 0).join(", ");
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
      answers: existing.questions.map((question) => {
        const incoming = payload.answers.find((item) => item.questionId === question.id);
        const response = incoming?.response ?? question.response;
        return {
          questionId: question.id,
          response,
          answerText: formatResponseAnswer({
            inputKind: question.inputKind,
            options: question.options,
            allowOther: question.allowOther,
            response,
          }),
        };
      }),
    });

    const updatedQuestions = existing.questions.map((question) => {
      const incoming = payload.answers.find((item) => item.questionId === question.id);
      return {
        ...question,
        response: incoming ? incoming.response : question.response,
        answer: incoming
          ? formatResponseAnswer({
              inputKind: question.inputKind,
              options: question.options,
              allowOther: question.allowOther,
              response: incoming.response,
            })
          : question.answer,
      };
    });

    const answerMessage = buildClarificationMessage(
      updatedQuestions.map((question) => ({
        question: question.question,
        answerText: question.answer,
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
    const [projectTools, toolRuntime] =
      existing.draft.projectId
        ? await Promise.all([
            resolveProjectTools(supabase, {
              userId: user.sub,
              projectId: existing.draft.projectId,
            }),
            resolveProjectToolRuntime(supabase, {
              userId: user.sub,
              projectId: existing.draft.projectId,
              query: existing.draft.objective,
            }),
          ])
        : [
            {
              selectedToolkitSlugs: [] as string[],
              activeToolkitSlugs: [] as string[],
              inactiveToolkitSlugs: [] as string[],
              markdown: "Project tool context:\nSelected toolkits: none\nConnected and ready: none",
            },
            {
              toolCandidates: [] as Array<{ title: string; toolkitSlug: string }>,
            },
          ];

    const result = await clarifyObjective({
      objective: existing.draft.objective,
      transcript: transcript.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      clarificationRounds: transcript.filter(
        (message) => message.role === "assistant" && message.questions.length > 0,
      ).length,
      planningContext: {
        markdown: [
          projectTools.markdown,
          toolRuntime.toolCandidates.length > 0
            ? `Likely helpful tools: ${toolRuntime.toolCandidates
                .slice(0, 8)
                .map((candidate) => `${candidate.title} [${candidate.toolkitSlug}]`)
                .join(", ")}`
            : "Likely helpful tools: none identified yet.",
        ].join("\n"),
        selectedToolkitSlugs: projectTools.selectedToolkitSlugs,
        activeToolkitSlugs: projectTools.activeToolkitSlugs,
        inactiveToolkitSlugs: projectTools.inactiveToolkitSlugs,
      },
    });

    await appendClarificationMessage(supabase, {
      sessionId: existing.draft.sessionId,
      userId: user.sub,
      role: "assistant",
      content: result.summary,
      questions: result.questions.map((question) => question.prompt),
    });

    const isPlannerReady = result.status === "ready_to_execute";
    const taskDrafts =
      isPlannerReady && existing.draft.projectId
        ? (
            await resolveProjectToolPlanningTasks(supabase, {
              userId: user.sub,
              projectId: existing.draft.projectId,
              objective: existing.draft.objective,
              tasks: result.tasks.map((task) => ({
                title: task.title,
                description: task.description,
                toolRequirement: task.toolRequirement,
                executionStrategy: task.executionStrategy,
                toolSummary: task.toolSummary || null,
                requiredToolkitSlugs: task.requiredToolkitSlugs,
                optionalToolkitSlugs: task.optionalToolkitSlugs,
              })),
              discoverMissingToolkitRequirements: true,
            })
          ).map((task, index) => ({
            ...result.tasks[index],
            toolRequirement: task.toolRequirement,
            executionStrategy: task.executionStrategy,
            toolSummary: task.toolSummary ?? result.tasks[index]?.toolSummary ?? "",
            requiredToolkitSlugs: task.requiredToolkitSlugs,
            optionalToolkitSlugs: task.optionalToolkitSlugs,
          }))
        : result.tasks;
    const taskDraftsWithInput = applyAnsweredToolInputQuestions({
      tasks: withInferredToolInputs({
        objective: existing.draft.objective,
        tasks: taskDrafts,
      }),
      questions: updatedQuestions,
    });
    const missingToolInputQuestions =
      isPlannerReady ? buildMissingToolInputQuestions({ tasks: taskDraftsWithInput }) : [];
    const isReviewReady = isPlannerReady && missingToolInputQuestions.length === 0;
    const nextQuestions = isPlannerReady && result.questions.length === 0
      ? updatedQuestions.map((question) => ({
          id: question.questionKey ?? question.id,
          prompt: question.question,
          helpText: question.description,
          optional: question.isOptional,
          inputKind: question.inputKind,
          options: question.options,
          allowOther: question.allowOther,
          otherLabel: question.otherLabel,
          otherPlaceholder: question.otherPlaceholder,
          prefill: question.prefill,
        }))
      : result.questions;
    const mergedQuestions = [
      ...nextQuestions.filter((question) => !String(question.id).startsWith("tool_input:")),
      ...missingToolInputQuestions,
    ];
    const savedQuestions = await replaceIntakeQuestions(supabase, {
      draftId: payload.draftId,
      questions: mergedQuestions,
      existingQuestions: updatedQuestions,
    });
    const savedDraft = await updateIntakeDraft(supabase, {
      draftId: payload.draftId,
      userId: user.sub,
      patch: {
        status: isReviewReady ? "review_ready" : "collecting_input",
        clarificationSummary:
          missingToolInputQuestions.length > 0
            ? `${result.summary}\n\nAutoBot still needs a few missing tool details before execution can start.`
            : result.summary,
        executionMode: result.executionMode,
        confidenceToProceed: result.confidenceToProceed,
        currentStep: Math.min(payload.currentStep ?? 0, Math.max(mergedQuestions.length - 1, 0)),
        questionCount: mergedQuestions.length,
        generatedMarkdown: result.draftMarkdown || null,
        draftMarkdown: result.draftMarkdown || existing.draft.draftMarkdown,
        taskDrafts: taskDraftsWithInput,
        eventNarrative: result.eventNarrative,
        lastGeneratedAt: isReviewReady ? new Date().toISOString() : existing.draft.lastGeneratedAt,
      },
    });
    const toolPreflight =
      isReviewReady && existing.draft.projectId
        ? await buildProjectToolPreflight(supabase, {
            userId: user.sub,
            projectId: existing.draft.projectId,
            objective: existing.draft.objective,
            tasks: taskDrafts.map((task) => ({
              title: task.title,
              description: task.description,
              toolRequirement: task.toolRequirement,
              executionStrategy: task.executionStrategy,
              toolSummary: task.toolSummary || null,
              requiredToolkitSlugs: task.requiredToolkitSlugs,
              optionalToolkitSlugs: task.optionalToolkitSlugs,
            })),
            nextPath: `/dashboard/drafts?draftId=${payload.draftId}`,
          })
        : null;

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
      toolPreflight,
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
