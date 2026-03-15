export const MEMORY_SCOPES = ["company", "project", "objective", "user"] as const;
export const MEMORY_KINDS = [
  "objective",
  "decision",
  "constraint",
  "fact",
  "artifact",
  "preference",
] as const;

export type MemoryScope = (typeof MEMORY_SCOPES)[number];
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export type MemoryRecord = {
  id: string;
  userId: string;
  companyKey: string;
  projectId: string | null;
  objectiveId: string | null;
  scope: MemoryScope;
  kind: MemoryKind;
  sourceType: string;
  sourceId: string | null;
  summary: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MemorySearchParams = {
  userId: string;
  companyKey: string;
  projectId: string | null;
  objectiveId?: string | null;
  query: string;
  limit?: number;
};

export type MemoryContext = {
  company: MemoryRecord[];
  project: MemoryRecord[];
  objective: MemoryRecord[];
  user: MemoryRecord[];
};
