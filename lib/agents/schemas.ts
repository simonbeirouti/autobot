import { z } from "zod";

export const agentIds = ["orchestrator", "researcher", "operator", "analyst"] as const;

export const executionModeSchema = z.enum(["single_agent", "multi_agent"]);

export const clarificationInputKindSchema = z.enum([
  "single_select",
  "multi_select",
  "text",
]);

export const clarificationTaskSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(300).optional().default(""),
  agentId: z.enum(agentIds).optional().default("orchestrator"),
  requiredToolkitSlugs: z.array(z.string().min(1).max(80)).max(8).optional().default([]),
  optionalToolkitSlugs: z.array(z.string().min(1).max(80)).max(8).optional().default([]),
  requiredToolIds: z.array(z.string().min(1).max(120)).max(8).optional().default([]),
  toolRequirement: z
    .enum(["none", "optional", "required"])
    .optional()
    .default("none"),
  executionStrategy: z
    .enum(["manual_setup", "tool_execution", "analysis_only"])
    .optional()
    .default("analysis_only"),
  toolSummary: z.string().max(240).optional().default(""),
  toolInput: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional()
    .default({}),
});

export const clarificationQuestionOptionSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  description: z.string().max(180).optional().default(""),
  isRecommended: z.boolean().optional().default(false),
});

export const clarificationQuestionPrefillSchema = z.object({
  selectedOptionIds: z.array(z.string().min(1).max(120)).max(8).optional().default([]),
  otherText: z.string().max(300).optional().default(""),
  text: z.string().max(600).optional().default(""),
});

export const clarificationQuestionSchema = z.object({
  id: z.string().min(1).max(120),
  prompt: z.string().min(3).max(180),
  helpText: z.string().min(3).max(240),
  optional: z.boolean().optional().default(false),
  inputKind: clarificationInputKindSchema.optional().default("text"),
  options: z.array(clarificationQuestionOptionSchema).max(8).optional().default([]),
  allowOther: z.boolean().optional().default(false),
  otherLabel: z.string().max(80).optional().default("Other"),
  otherPlaceholder: z
    .string()
    .max(160)
    .optional()
    .default("Add a different answer"),
  prefill: clarificationQuestionPrefillSchema
    .optional()
    .default({ selectedOptionIds: [], otherText: "", text: "" }),
});

export const clarificationResultSchema = z.object({
  status: z.enum(["needs_input", "ready_to_execute"]),
  summary: z.string().min(1).max(500),
  confidenceToProceed: z.number().min(0).max(1),
  executionMode: executionModeSchema,
  questions: z.array(clarificationQuestionSchema).max(8).default([]),
  draftMarkdown: z.string().max(8_000).optional().default(""),
  tasks: z.array(clarificationTaskSchema).max(8).default([]),
  eventNarrative: z.array(z.string().min(3).max(220)).max(8).default([]),
});

export const clarificationQuestionResponseSchema = z.object({
  selectedOptionIds: z.array(z.string().min(1).max(120)).max(8).optional().default([]),
  otherText: z.string().max(300).optional().default(""),
  text: z.string().max(2000).optional().default(""),
});

export type ClarificationQuestionDraft = z.infer<typeof clarificationQuestionSchema>;
export type ClarificationQuestionOption = z.infer<typeof clarificationQuestionOptionSchema>;
export type ClarificationQuestionPrefill = z.infer<typeof clarificationQuestionPrefillSchema>;
export type ClarificationTaskDraft = z.infer<typeof clarificationTaskSchema>;
export type ClarificationResult = z.infer<typeof clarificationResultSchema>;
export type ClarificationQuestionResponse = z.infer<typeof clarificationQuestionResponseSchema>;
