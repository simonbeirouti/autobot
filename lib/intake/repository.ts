import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ClarificationQuestionDraft,
  ClarificationTaskDraft,
} from "@/lib/agents/schemas";
import type { ExecutionMode } from "@/lib/runs/types";
import type {
  IntakeDraft,
  IntakeDraftStatus,
  IntakeDraftWithQuestions,
  IntakeQuestion,
} from "@/lib/intake/types";

type IntakeDraftRow = {
  id: string;
  session_id: string;
  run_id: string | null;
  objective: string;
  status: IntakeDraftStatus;
  current_step: number;
  question_count: number;
  clarification_summary: string | null;
  execution_mode: ExecutionMode | null;
  confidence_to_proceed: number | null;
  generated_markdown: string | null;
  draft_markdown: string | null;
  task_drafts: ClarificationTaskDraft[] | null;
  event_narrative: string[] | null;
  last_generated_at: string | null;
  last_edited_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type IntakeQuestionRow = {
  id: string;
  draft_id: string;
  position: number;
  question: string;
  description: string;
  input_kind: "textarea";
  is_optional: boolean;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapDraft(row: IntakeDraftRow): IntakeDraft {
  return {
    id: row.id,
    sessionId: row.session_id,
    runId: row.run_id,
    objective: row.objective,
    status: row.status,
    currentStep: row.current_step,
    questionCount: row.question_count,
    clarificationSummary: row.clarification_summary,
    executionMode: row.execution_mode,
    confidenceToProceed: row.confidence_to_proceed,
    generatedMarkdown: row.generated_markdown,
    draftMarkdown: row.draft_markdown,
    taskDrafts: (row.task_drafts ?? []) as ClarificationTaskDraft[],
    eventNarrative: (row.event_narrative ?? []) as string[],
    lastGeneratedAt: row.last_generated_at,
    lastEditedAt: row.last_edited_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQuestion(row: IntakeQuestionRow): IntakeQuestion {
  return {
    id: row.id,
    draftId: row.draft_id,
    position: row.position,
    question: row.question,
    description: row.description,
    inputKind: row.input_kind,
    isOptional: row.is_optional,
    answer: row.answer ?? "",
    answeredAt: row.answered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createIntakeDraft(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    userId: string;
    objective: string;
  },
) {
  const { data, error } = await supabase
    .from("intake_drafts")
    .insert({
      session_id: params.sessionId,
      user_id: params.userId,
      objective: params.objective,
    })
    .select(
      "id, session_id, run_id, objective, status, current_step, question_count, clarification_summary, execution_mode, confidence_to_proceed, generated_markdown, draft_markdown, task_drafts, event_narrative, last_generated_at, last_edited_at, completed_at, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapDraft(data as IntakeDraftRow);
}

export async function updateIntakeDraft(
  supabase: SupabaseClient,
  params: {
    draftId: string;
    userId: string;
    patch: {
      status?: IntakeDraftStatus;
      currentStep?: number;
      runId?: string | null;
      questionCount?: number;
      clarificationSummary?: string | null;
      executionMode?: ExecutionMode | null;
      confidenceToProceed?: number | null;
      generatedMarkdown?: string | null;
      draftMarkdown?: string | null;
      taskDrafts?: ClarificationTaskDraft[];
      eventNarrative?: string[];
      lastGeneratedAt?: string | null;
      lastEditedAt?: string | null;
      completedAt?: string | null;
    };
  },
) {
  const patch: Record<string, unknown> = {};

  if (params.patch.status !== undefined) patch.status = params.patch.status;
  if (params.patch.currentStep !== undefined) patch.current_step = params.patch.currentStep;
  if (params.patch.runId !== undefined) patch.run_id = params.patch.runId;
  if (params.patch.questionCount !== undefined) patch.question_count = params.patch.questionCount;
  if (params.patch.clarificationSummary !== undefined) {
    patch.clarification_summary = params.patch.clarificationSummary;
  }
  if (params.patch.executionMode !== undefined) patch.execution_mode = params.patch.executionMode;
  if (params.patch.confidenceToProceed !== undefined) {
    patch.confidence_to_proceed = params.patch.confidenceToProceed;
  }
  if (params.patch.generatedMarkdown !== undefined) {
    patch.generated_markdown = params.patch.generatedMarkdown;
  }
  if (params.patch.draftMarkdown !== undefined) patch.draft_markdown = params.patch.draftMarkdown;
  if (params.patch.taskDrafts !== undefined) patch.task_drafts = params.patch.taskDrafts;
  if (params.patch.eventNarrative !== undefined) patch.event_narrative = params.patch.eventNarrative;
  if (params.patch.lastGeneratedAt !== undefined) patch.last_generated_at = params.patch.lastGeneratedAt;
  if (params.patch.lastEditedAt !== undefined) patch.last_edited_at = params.patch.lastEditedAt;
  if (params.patch.completedAt !== undefined) patch.completed_at = params.patch.completedAt;

  const { data, error } = await supabase
    .from("intake_drafts")
    .update(patch)
    .eq("id", params.draftId)
    .eq("user_id", params.userId)
    .select(
      "id, session_id, run_id, objective, status, current_step, question_count, clarification_summary, execution_mode, confidence_to_proceed, generated_markdown, draft_markdown, task_drafts, event_narrative, last_generated_at, last_edited_at, completed_at, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapDraft(data as IntakeDraftRow);
}

export async function fetchIntakeDraft(
  supabase: SupabaseClient,
  params: { draftId: string; userId: string },
) {
  const { data, error } = await supabase
    .from("intake_drafts")
    .select(
      "id, session_id, run_id, objective, status, current_step, question_count, clarification_summary, execution_mode, confidence_to_proceed, generated_markdown, draft_markdown, task_drafts, event_narrative, last_generated_at, last_edited_at, completed_at, created_at, updated_at",
    )
    .eq("id", params.draftId)
    .eq("user_id", params.userId)
    .single();

  if (error) {
    throw error;
  }

  return mapDraft(data as IntakeDraftRow);
}

export async function fetchIntakeDrafts(
  supabase: SupabaseClient,
  params: { userId: string },
) {
  const { data, error } = await supabase
    .from("intake_drafts")
    .select(
      "id, session_id, run_id, objective, status, current_step, question_count, clarification_summary, execution_mode, confidence_to_proceed, generated_markdown, draft_markdown, task_drafts, event_narrative, last_generated_at, last_edited_at, completed_at, created_at, updated_at",
    )
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapDraft(row as IntakeDraftRow));
}

export async function fetchIntakeQuestions(
  supabase: SupabaseClient,
  params: { draftId: string },
) {
  const { data, error } = await supabase
    .from("intake_questions")
    .select(
      "id, draft_id, position, question, description, input_kind, is_optional, answer, answered_at, created_at, updated_at",
    )
    .eq("draft_id", params.draftId)
    .order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapQuestion(row as IntakeQuestionRow));
}

export async function fetchIntakeDraftWithQuestions(
  supabase: SupabaseClient,
  params: { draftId: string; userId: string },
): Promise<IntakeDraftWithQuestions> {
  const [draft, questions] = await Promise.all([
    fetchIntakeDraft(supabase, params),
    fetchIntakeQuestions(supabase, { draftId: params.draftId }),
  ]);

  return { draft, questions };
}

export async function replaceIntakeQuestions(
  supabase: SupabaseClient,
  params: {
    draftId: string;
    questions: ClarificationQuestionDraft[];
    existingQuestions?: IntakeQuestion[];
  },
) {
  const { error: deleteError } = await supabase
    .from("intake_questions")
    .delete()
    .eq("draft_id", params.draftId);

  if (deleteError) {
    throw deleteError;
  }

  if (params.questions.length === 0) {
    return [] as IntakeQuestion[];
  }

  const { data, error } = await supabase
    .from("intake_questions")
    .insert(
      params.questions.map((question, index) => {
        const preservedQuestion = params.existingQuestions?.find(
          (existingQuestion) =>
            existingQuestion.position === index &&
            existingQuestion.question === question.question &&
            existingQuestion.description === question.description &&
            existingQuestion.inputKind === (question.inputKind ?? "textarea") &&
            existingQuestion.isOptional === (question.optional ?? false),
        );

        return {
          draft_id: params.draftId,
          position: index,
          question: question.question,
          description: question.description,
          input_kind: question.inputKind ?? "textarea",
          is_optional: question.optional ?? false,
          answer: preservedQuestion?.answer.trim().length ? preservedQuestion.answer : null,
          answered_at: preservedQuestion?.answer.trim().length
            ? preservedQuestion.answeredAt ?? new Date().toISOString()
            : null,
        };
      }),
    )
    .select(
      "id, draft_id, position, question, description, input_kind, is_optional, answer, answered_at, created_at, updated_at",
    )
    .order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapQuestion(row as IntakeQuestionRow));
}

export async function updateIntakeQuestionAnswers(
  supabase: SupabaseClient,
  params: {
    draftId: string;
    answers: Array<{ questionId: string; answer: string }>;
  },
) {
  const now = new Date().toISOString();

  for (const item of params.answers) {
    const normalizedAnswer = item.answer.trim();
    const { error } = await supabase
      .from("intake_questions")
      .update({
        answer: normalizedAnswer,
        answered_at: normalizedAnswer ? now : null,
      })
      .eq("id", item.questionId)
      .eq("draft_id", params.draftId);

    if (error) {
      throw error;
    }
  }
}
