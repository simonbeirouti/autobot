import { z } from "zod";

export const agentIds = ["orchestrator", "researcher", "operator", "analyst"] as const;

export const executionModeSchema = z.enum(["single_agent", "multi_agent"]);

export const clarificationTaskSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(300).optional().default(""),
  agentId: z.enum(agentIds).optional().default("orchestrator"),
});

export const clarificationResultSchema = z.object({
  status: z.enum(["needs_input", "ready_to_execute"]),
  summary: z.string().min(1).max(500),
  confidenceToProceed: z.number().min(0).max(1),
  executionMode: executionModeSchema,
  questions: z.array(z.string().min(3).max(180)).max(3).default([]),
  tasks: z.array(clarificationTaskSchema).max(8).default([]),
  eventNarrative: z.array(z.string().min(3).max(220)).max(8).default([]),
});

export type ClarificationTaskDraft = z.infer<typeof clarificationTaskSchema>;
export type ClarificationResult = z.infer<typeof clarificationResultSchema>;

