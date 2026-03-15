import type {
  ClarificationQuestionOption,
  ClarificationQuestionResponse,
  ClarificationTaskDraft,
} from "@/lib/agents/schemas";
import type { ExecutionMode } from "@/lib/runs/types";

export const INTAKE_DRAFT_STATUSES = [
  "collecting_input",
  "review_ready",
  "executing",
  "archived",
] as const;

export type IntakeDraftStatus = (typeof INTAKE_DRAFT_STATUSES)[number];

export type IntakeQuestionInputKind = "single_select" | "multi_select" | "text";

export type IntakeQuestionPrefill = {
  selectedOptionIds: string[];
  otherText: string;
  text: string;
};

export type IntakeQuestion = {
  id: string;
  draftId: string;
  position: number;
  questionKey: string | null;
  question: string;
  description: string;
  inputKind: IntakeQuestionInputKind;
  options: ClarificationQuestionOption[];
  allowOther: boolean;
  otherLabel: string;
  otherPlaceholder: string;
  isOptional: boolean;
  answer: string;
  response: ClarificationQuestionResponse;
  prefill: IntakeQuestionPrefill;
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntakeDraft = {
  id: string;
  sessionId: string;
  runId: string | null;
  projectId: string | null;
  objectiveId: string | null;
  objective: string;
  status: IntakeDraftStatus;
  currentStep: number;
  questionCount: number;
  clarificationSummary: string | null;
  executionMode: ExecutionMode | null;
  confidenceToProceed: number | null;
  generatedMarkdown: string | null;
  draftMarkdown: string | null;
  taskDrafts: ClarificationTaskDraft[];
  eventNarrative: string[];
  lastGeneratedAt: string | null;
  lastEditedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntakeDraftWithQuestions = {
  draft: IntakeDraft;
  questions: IntakeQuestion[];
};

export type IntakeFlowResponse = IntakeDraftWithQuestions & {
  runId?: string;
  error?: string;
};
