import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ClarificationQuestionDraft,
  ClarificationQuestionOption,
  ClarificationQuestionResponse,
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
  project_id: string | null;
  objective_id: string | null;
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
  question_key: string | null;
  question: string;
  description: string;
  input_kind: "single_select" | "multi_select" | "text" | "textarea";
  options: ClarificationQuestionOption[] | null;
  allow_other: boolean | null;
  other_label: string | null;
  other_placeholder: string | null;
  is_optional: boolean;
  answer: string | null;
  answer_text: string | null;
  response: ClarificationQuestionResponse | null;
  prefill:
    | {
        selectedOptionIds?: string[];
        otherText?: string;
        text?: string;
      }
    | null;
  answered_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapDraft(row: IntakeDraftRow): IntakeDraft {
  return {
    id: row.id,
    sessionId: row.session_id,
    runId: row.run_id,
    projectId: row.project_id,
    objectiveId: row.objective_id,
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
  const legacyAnswer = row.answer_text ?? row.answer ?? "";
  const response = {
    selectedOptionIds: row.response?.selectedOptionIds ?? [],
    otherText: row.response?.otherText ?? "",
    text: row.response?.text ?? legacyAnswer,
  };

  return {
    id: row.id,
    draftId: row.draft_id,
    position: row.position,
    questionKey: row.question_key,
    question: row.question,
    description: row.description,
    inputKind: row.input_kind === "textarea" ? "text" : row.input_kind,
    options: (row.options ?? []) as ClarificationQuestionOption[],
    allowOther: row.allow_other ?? false,
    otherLabel: row.other_label ?? "Other",
    otherPlaceholder: row.other_placeholder ?? "Add a different answer",
    isOptional: row.is_optional,
    answer: legacyAnswer,
    response,
    prefill: {
      selectedOptionIds: row.prefill?.selectedOptionIds ?? [],
      otherText: row.prefill?.otherText ?? "",
      text: row.prefill?.text ?? "",
    },
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
    projectId: string;
    objective: string;
  },
) {
  const { data, error } = await supabase
    .from("intake_drafts")
    .insert({
      session_id: params.sessionId,
      user_id: params.userId,
      project_id: params.projectId,
      objective: params.objective,
    })
    .select(
      "id, session_id, run_id, project_id, objective_id, objective, status, current_step, question_count, clarification_summary, execution_mode, confidence_to_proceed, generated_markdown, draft_markdown, task_drafts, event_narrative, last_generated_at, last_edited_at, completed_at, created_at, updated_at",
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
      projectId?: string | null;
      objectiveId?: string | null;
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
  if (params.patch.projectId !== undefined) patch.project_id = params.patch.projectId;
  if (params.patch.objectiveId !== undefined) patch.objective_id = params.patch.objectiveId;
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
      "id, session_id, run_id, project_id, objective_id, objective, status, current_step, question_count, clarification_summary, execution_mode, confidence_to_proceed, generated_markdown, draft_markdown, task_drafts, event_narrative, last_generated_at, last_edited_at, completed_at, created_at, updated_at",
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
      "id, session_id, run_id, project_id, objective_id, objective, status, current_step, question_count, clarification_summary, execution_mode, confidence_to_proceed, generated_markdown, draft_markdown, task_drafts, event_narrative, last_generated_at, last_edited_at, completed_at, created_at, updated_at",
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
  params: { userId: string; projectId?: string | null },
) {
  let query = supabase
    .from("intake_drafts")
    .select(
      "id, session_id, run_id, project_id, objective_id, objective, status, current_step, question_count, clarification_summary, execution_mode, confidence_to_proceed, generated_markdown, draft_markdown, task_drafts, event_narrative, last_generated_at, last_edited_at, completed_at, created_at, updated_at",
    )
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false });

  if (params.projectId) {
    query = query.eq("project_id", params.projectId);
  }

  const { data, error } = await query;

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
      "id, draft_id, position, question_key, question, description, input_kind, options, allow_other, other_label, other_placeholder, is_optional, answer, answer_text, response, prefill, answered_at, created_at, updated_at",
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
            (question.id && existingQuestion.questionKey === question.id) ||
            (
              existingQuestion.position === index &&
              existingQuestion.question === question.prompt
            ),
        );

        return {
          draft_id: params.draftId,
          position: index,
          question_key: question.id,
          question: question.prompt,
          description: question.helpText,
          input_kind: question.inputKind ?? "text",
          options: question.options ?? [],
          allow_other: question.allowOther ?? false,
          other_label: question.otherLabel ?? "Other",
          other_placeholder: question.otherPlaceholder ?? "Add a different answer",
          is_optional: question.optional ?? false,
          answer: preservedQuestion?.answer.trim().length ? preservedQuestion.answer : null,
          answer_text: preservedQuestion?.answer.trim().length ? preservedQuestion.answer : null,
          response:
            preservedQuestion && (
              preservedQuestion.response.selectedOptionIds.length > 0 ||
              preservedQuestion.response.otherText.trim().length > 0 ||
              preservedQuestion.response.text.trim().length > 0
            )
              ? preservedQuestion.response
              : {},
          prefill: question.prefill ?? {},
          answered_at: preservedQuestion?.answer.trim().length
            ? preservedQuestion.answeredAt ?? new Date().toISOString()
            : null,
        };
      }),
    )
    .select(
      "id, draft_id, position, question_key, question, description, input_kind, options, allow_other, other_label, other_placeholder, is_optional, answer, answer_text, response, prefill, answered_at, created_at, updated_at",
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
    answers: Array<{ questionId: string; response: ClarificationQuestionResponse; answerText: string }>;
  },
) {
  const now = new Date().toISOString();

  for (const item of params.answers) {
    const normalizedAnswer = item.answerText.trim();
    const normalizedResponse: ClarificationQuestionResponse = {
      selectedOptionIds: item.response.selectedOptionIds ?? [],
      otherText: item.response.otherText ?? "",
      text: item.response.text ?? "",
    };
    const { error } = await supabase
      .from("intake_questions")
      .update({
        answer: normalizedAnswer,
        answer_text: normalizedAnswer,
        response: normalizedResponse,
        answered_at: normalizedAnswer ? now : null,
      })
      .eq("id", item.questionId)
      .eq("draft_id", params.draftId);

    if (error) {
      throw error;
    }
  }
}
