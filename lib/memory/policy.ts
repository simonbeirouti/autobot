import { z } from "zod";

import { agentIds } from "@/lib/agents/schemas";
import type { MemoryContext, MemoryKind, MemoryScope } from "@/lib/memory/types";
import type { Objective, Project } from "@/lib/projects/types";

export const durableMemoryWriteSchema = z.object({
  shouldWrite: z.boolean().default(false),
  scope: z.enum(["company", "project", "objective", "user"]).default("project"),
  kind: z.enum(["objective", "decision", "constraint", "fact", "artifact", "preference"]).default("fact"),
  summary: z.string().max(200).default(""),
  content: z.string().max(1000).default(""),
});

export const chatRoutingDecisionSchema = z.object({
  agentId: z.enum(agentIds).default("orchestrator"),
  responseStyle: z.string().max(120).default("Direct and specific."),
});

export type DurableMemoryWrite = z.infer<typeof durableMemoryWriteSchema>;
export type ChatRoutingDecision = z.infer<typeof chatRoutingDecisionSchema>;

export function shouldPromoteMemory(kind: MemoryKind, scope: MemoryScope) {
  if (scope === "company") {
    return kind === "decision" || kind === "constraint" || kind === "fact";
  }

  if (scope === "project" || scope === "objective") {
    return kind !== "preference";
  }

  return kind === "preference";
}

export function formatMemoryContext(
  project: Project,
  memoryContext: MemoryContext,
  objective?: Objective | null,
) {
  const sections = [
    {
      title: "Project",
      items: [
        `Name: ${project.name}`,
        `Description: ${project.description || "No description yet."}`,
      ],
    },
    {
      title: "Objective",
      items: objective
        ? [
            `Title: ${objective.title}`,
            `Description: ${objective.description || "No description yet."}`,
            `Status: ${objective.status}`,
          ]
        : ["General project conversation"],
    },
    {
      title: "Company memory",
      items: memoryContext.company.map((memory) => `${memory.kind}: ${memory.summary}`),
    },
    {
      title: "Project memory",
      items: memoryContext.project.map((memory) => `${memory.kind}: ${memory.summary}`),
    },
    {
      title: "Objective memory",
      items: memoryContext.objective.map((memory) => `${memory.kind}: ${memory.summary}`),
    },
    {
      title: "User memory",
      items: memoryContext.user.map((memory) => `${memory.kind}: ${memory.summary}`),
    },
  ];

  return sections
    .map((section) =>
      `${section.title}:\n${section.items.length > 0 ? section.items.map((item) => `- ${item}`).join("\n") : "- None yet."}`,
    )
    .join("\n\n");
}

export function createRoutingFallback(message: string): ChatRoutingDecision {
  const normalized = message.toLowerCase();

  if (/(metric|performance|kpi|roi|impact|tradeoff|compare|analysis)/.test(normalized)) {
    return { agentId: "analyst", responseStyle: "Analytical and evidence-driven." };
  }

  if (/(status|next step|workflow|ship|deliver|execute|tool|ops|operation)/.test(normalized)) {
    return { agentId: "operator", responseStyle: "Operational and action-oriented." };
  }

  if (/(research|background|why|market|competitor|context|what do we know)/.test(normalized)) {
    return { agentId: "researcher", responseStyle: "Context-rich and concise." };
  }

  return { agentId: "orchestrator", responseStyle: "Clear, structured, and decisive." };
}

export function createPromotionFallback(params: {
  userMessage: string;
  assistantMessage: string;
  agentId: (typeof agentIds)[number];
  objectiveId?: string | null;
}): DurableMemoryWrite {
  const combined = `${params.userMessage}\n${params.assistantMessage}`.trim();
  const normalized = combined.toLowerCase();
  const defaultScope: MemoryScope = params.objectiveId ? "objective" : "project";

  if (/(decision|decided|we will|plan is|next step)/.test(normalized)) {
    return {
      shouldWrite: true,
      scope: defaultScope,
      kind: "decision",
      summary: params.assistantMessage.slice(0, 180).trim(),
      content: combined.slice(0, 1000),
    };
  }

  if (/(objective|goal|milestone|constraint|must|should)/.test(normalized)) {
    return {
      shouldWrite: true,
      scope: params.objectiveId ? "objective" : params.agentId === "orchestrator" ? "project" : "company",
      kind: params.agentId === "orchestrator" ? "objective" : "constraint",
      summary: params.assistantMessage.slice(0, 180).trim(),
      content: combined.slice(0, 1000),
    };
  }

  return {
    shouldWrite: false,
    scope: defaultScope,
    kind: "fact",
    summary: "",
    content: "",
  };
}
