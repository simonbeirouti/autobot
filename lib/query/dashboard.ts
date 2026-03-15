import type { IntakeDraft, IntakeFlowResponse } from "@/lib/intake/types";
import type { Project, ProjectWorkspace } from "@/lib/projects/types";
import type { RunListItem, WorkspacePayload } from "@/lib/runs/types";

export const dashboardQueryKeys = {
  drafts: {
    all: (projectId: string) => ["drafts", projectId] as const,
    flow: (draftId: string) => ["draft-flow", draftId] as const,
  },
  projects: {
    all: ["projects"] as const,
    workspace: (projectId: string, threadId?: string | null) =>
      ["project-workspace", projectId, threadId ?? "latest"] as const,
  },
  runs: {
    all: (projectId: string) => ["runs", projectId] as const,
    workspace: (runId: string) => ["run-workspace", runId] as const,
  },
};

export const dashboardQueryTimings = {
  drafts: {
    staleTime: 1000 * 60,
  },
  draftFlow: {
    staleTime: 1000 * 30,
  },
  runs: {
    staleTime: 1000 * 60,
  },
  projects: {
    staleTime: 1000 * 60,
  },
  projectWorkspace: {
    staleTime: 1000 * 15,
  },
  runWorkspace: {
    staleTime: 1000 * 15,
  },
};

export async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return Date.now();
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function getRunsUpdatedAt(runs: RunListItem[]) {
  if (runs.length === 0) {
    return Date.now();
  }

  return Math.max(...runs.map((run) => getTimestamp(run.updatedAt)));
}

export function getDraftsUpdatedAt(drafts: IntakeDraft[]) {
  if (drafts.length === 0) {
    return Date.now();
  }

  return Math.max(...drafts.map((draft) => getTimestamp(draft.updatedAt)));
}

export function mergeRunIntoList(
  runs: RunListItem[] | undefined,
  workspace: WorkspacePayload,
) {
  if (!runs) {
    return [workspace.run];
  }

  const hasRun = runs.some((run) => run.id === workspace.run.id);
  const nextRuns = hasRun
    ? runs.map((run) => (run.id === workspace.run.id ? workspace.run : run))
    : [workspace.run, ...runs];

  return nextRuns.toSorted(
    (left, right) => getTimestamp(right.updatedAt) - getTimestamp(left.updatedAt),
  );
}

export function upsertDraftInList(
  drafts: IntakeDraft[] | undefined,
  draft: IntakeDraft,
) {
  if (!drafts) {
    return [draft];
  }

  const hasDraft = drafts.some((item) => item.id === draft.id);
  const nextDrafts = hasDraft
    ? drafts.map((item) => (item.id === draft.id ? draft : item))
    : [draft, ...drafts];

  return nextDrafts.toSorted(
    (left, right) => getTimestamp(right.updatedAt) - getTimestamp(left.updatedAt),
  );
}

export function upsertProjectInList(
  projects: Project[] | undefined,
  project: Project,
) {
  if (!projects) {
    return [project];
  }

  const hasProject = projects.some((item) => item.id === project.id);
  const nextProjects = hasProject
    ? projects.map((item) => (item.id === project.id ? project : item))
    : [project, ...projects];

  return nextProjects.toSorted(
    (left, right) => getTimestamp(right.updatedAt) - getTimestamp(left.updatedAt),
  );
}

export function getProjectsUpdatedAt(projects: Project[]) {
  if (projects.length === 0) {
    return Date.now();
  }

  return Math.max(...projects.map((project) => getTimestamp(project.updatedAt)));
}

export function mergeProjectWorkspace(
  projects: Project[] | undefined,
  workspace: ProjectWorkspace,
) {
  return upsertProjectInList(projects, workspace.project);
}

export function createOptimisticFlow(
  flow: IntakeFlowResponse,
  patch: {
    currentStep?: number;
    draftMarkdown?: string;
    questions?: IntakeFlowResponse["questions"];
  },
): IntakeFlowResponse {
  const now = new Date().toISOString();

  return {
    draft: {
      ...flow.draft,
      currentStep: patch.currentStep ?? flow.draft.currentStep,
      draftMarkdown:
        patch.draftMarkdown !== undefined ? patch.draftMarkdown : flow.draft.draftMarkdown,
      updatedAt: now,
      lastEditedAt: patch.draftMarkdown !== undefined ? now : flow.draft.lastEditedAt,
    },
    questions: patch.questions ?? flow.questions,
  };
}
