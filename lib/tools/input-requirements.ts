import type {
  ClarificationQuestionDraft,
  ClarificationTaskDraft,
} from "@/lib/agents/schemas";
import type { IntakeQuestion } from "@/lib/intake/types";
import type { RequiredToolInput, RunTask } from "@/lib/runs/types";

type ToolInputFieldSpec = {
  field: string;
  label: string;
  promptPrefix: string;
  helpText: string;
  placeholder: string;
};

const REQUIRED_TOOL_INPUT_SPECS: Record<string, ToolInputFieldSpec[]> = {
  page_extractor: [
    {
      field: "url",
      label: "Page URL",
      promptPrefix: "Which page URL should AutoBot extract",
      helpText: "Provide the exact page URL, including https://.",
      placeholder: "https://example.com/page",
    },
  ],
  site_crawler: [
    {
      field: "rootUrl",
      label: "Site URL",
      promptPrefix: "Which site or section should AutoBot crawl",
      helpText: "Provide the root URL to crawl, including https://.",
      placeholder: "https://example.com",
    },
  ],
  sitemap_robots_audit: [
    {
      field: "siteUrl",
      label: "Site URL",
      promptPrefix: "Which site should AutoBot audit for robots.txt and sitemap coverage",
      helpText: "Provide the site home URL, including https://.",
      placeholder: "https://example.com",
    },
  ],
  content_inventory: [
    {
      field: "rootUrl",
      label: "Site URL",
      promptPrefix: "Which site or section should AutoBot inventory",
      helpText: "Provide the root URL to inventory, including https://.",
      placeholder: "https://example.com",
    },
  ],
};

function normalizeUrlCandidate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function extractFirstUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s)]+/i);
  return match ? normalizeUrlCandidate(match[0]) : null;
}

export function buildToolInputQuestionKey(params: {
  taskIndex: number;
  toolkitSlug: string;
  field: string;
}) {
  return `tool_input:${params.taskIndex}:${params.toolkitSlug}:${params.field}`;
}

function parseToolInputQuestionKey(questionKey: string | null) {
  if (!questionKey || !questionKey.startsWith("tool_input:")) {
    return null;
  }

  const [, taskIndex, toolkitSlug, field] = questionKey.split(":");
  const parsedTaskIndex = Number(taskIndex);
  if (!Number.isInteger(parsedTaskIndex) || !toolkitSlug || !field) {
    return null;
  }

  return {
    taskIndex: parsedTaskIndex,
    toolkitSlug,
    field,
  };
}

function readQuestionAnswer(question: Pick<IntakeQuestion, "answer" | "response">) {
  const text = question.response.text?.trim() || question.answer.trim();
  return text;
}

export function withInferredToolInputs<T extends { title: string; description?: string | null; toolInput?: Record<string, Record<string, unknown>> }>(
  params: {
    objective: string;
    tasks: T[];
  },
) {
  return params.tasks.map((task) => {
    const toolInput = { ...(task.toolInput ?? {}) };
    const urlCandidate = extractFirstUrl(
      [params.objective, task.title, task.description ?? ""].filter(Boolean).join("\n"),
    );

    Object.entries(REQUIRED_TOOL_INPUT_SPECS).forEach(([toolkitSlug, specs]) => {
      if (!urlCandidate) {
        return;
      }

      specs.forEach((spec) => {
        if (
          ["url", "rootUrl", "siteUrl"].includes(spec.field) &&
          !toolInput[toolkitSlug]?.[spec.field]
        ) {
          toolInput[toolkitSlug] = {
            ...(toolInput[toolkitSlug] ?? {}),
            [spec.field]: urlCandidate,
          };
        }
      });
    });

    return {
      ...task,
      toolInput,
    };
  });
}

export function applyAnsweredToolInputQuestions<T extends { toolInput?: Record<string, Record<string, unknown>> }>(
  params: {
    tasks: T[];
    questions: IntakeQuestion[];
  },
) {
  const tasks = params.tasks.map((task) => ({
    ...task,
    toolInput: { ...(task.toolInput ?? {}) },
  }));

  params.questions.forEach((question) => {
    const parsed = parseToolInputQuestionKey(question.questionKey);
    if (!parsed) {
      return;
    }

    const answer = normalizeUrlCandidate(readQuestionAnswer(question)) ?? readQuestionAnswer(question);
    if (!answer) {
      return;
    }

    const task = tasks[parsed.taskIndex];
    if (!task) {
      return;
    }

    task.toolInput[parsed.toolkitSlug] = {
      ...(task.toolInput[parsed.toolkitSlug] ?? {}),
      [parsed.field]: answer,
    };
  });

  return tasks;
}

export function buildMissingToolInputQuestions(params: {
  tasks: ClarificationTaskDraft[];
}) {
  const questions: ClarificationQuestionDraft[] = [];

  params.tasks.forEach((task, taskIndex) => {
    const requiredToolkits = task.requiredToolkitSlugs ?? [];
    requiredToolkits.forEach((toolkitSlug) => {
      const specs = REQUIRED_TOOL_INPUT_SPECS[toolkitSlug] ?? [];
      specs.forEach((spec) => {
        const currentValue = task.toolInput?.[toolkitSlug]?.[spec.field];
        const currentText = typeof currentValue === "string" ? currentValue.trim() : "";
        if (currentText) {
          return;
        }

        questions.push({
          id: buildToolInputQuestionKey({
            taskIndex,
            toolkitSlug,
            field: spec.field,
          }),
          prompt: `${spec.promptPrefix} for "${task.title}"?`,
          helpText: spec.helpText,
          inputKind: "text",
          options: [],
          allowOther: false,
          otherLabel: "Other",
          otherPlaceholder: spec.placeholder,
          optional: false,
          prefill: {
            selectedOptionIds: [],
            otherText: "",
            text: "",
          },
        });
      });
    });
  });

  return questions;
}

export function getMissingRequiredToolInputsForRunTasks(params: {
  tasks: Array<{
    id?: string;
    title: string;
    requiredToolkitSlugs: string[];
    toolInput: Record<string, Record<string, unknown>>;
  }>;
}) {
  const missing: RequiredToolInput[] = [];

  params.tasks.forEach((task) => {
    task.requiredToolkitSlugs.forEach((toolkitSlug) => {
      const specs = REQUIRED_TOOL_INPUT_SPECS[toolkitSlug] ?? [];
      specs.forEach((spec) => {
        const value = task.toolInput?.[toolkitSlug]?.[spec.field];
        const stringValue = typeof value === "string" ? value.trim() : "";
        if (stringValue) {
          return;
        }

        missing.push({
          taskId: task.id ?? null,
          taskTitle: task.title,
          toolkitSlug,
          field: spec.field,
          label: spec.label,
          prompt: `${spec.promptPrefix} for "${task.title}"?`,
          helpText: spec.helpText,
          placeholder: spec.placeholder,
          value: "",
        });
      });
    });
  });

  return missing;
}

export function mergeToolInputValuesIntoRunTasks(params: {
  tasks: RunTask[];
  inputs: Array<{ taskId: string; toolkitSlug: string; field: string; value: string }>;
}) {
  return params.tasks.map((task) => {
    const matching = params.inputs.filter((input) => input.taskId === task.id);
    if (matching.length === 0) {
      return task;
    }

    const nextToolInput = { ...(task.toolInput ?? {}) };
    matching.forEach((input) => {
      nextToolInput[input.toolkitSlug] = {
        ...(nextToolInput[input.toolkitSlug] ?? {}),
        [input.field]: input.value,
      };
    });

    return {
      ...task,
      toolInput: nextToolInput,
    };
  });
}
