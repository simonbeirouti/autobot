import type { IntakeDraft } from "@/lib/intake/types";

const DRAFT_OBJECTIVE_MAX_LENGTH = 42;

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function isActiveIntakeDraft(draft: IntakeDraft) {
  return draft.status !== "archived" && draft.runId === null;
}

export function sortDraftsByCreatedAt(drafts: IntakeDraft[]) {
  return drafts.toSorted(
    (left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt),
  );
}

export function getDraftStatusLabel(draft: IntakeDraft) {
  if (draft.status === "review_ready") {
    return "Review ready";
  }

  if (draft.status === "executing") {
    return "Executing";
  }

  if (draft.status === "archived") {
    return "Archived";
  }

  return "Collecting input";
}

export function truncateDraftObjective(objective: string) {
  if (objective.length <= DRAFT_OBJECTIVE_MAX_LENGTH) {
    return objective;
  }

  return `${objective.slice(0, DRAFT_OBJECTIVE_MAX_LENGTH - 3).trimEnd()}...`;
}
