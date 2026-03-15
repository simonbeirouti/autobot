import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MemoryContext,
  MemoryKind,
  MemoryRecord,
  MemoryScope,
  MemorySearchParams,
} from "@/lib/memory/types";

type MemoryRow = {
  id: string;
  user_id: string;
  company_key: string;
  project_id: string | null;
  objective_id: string | null;
  scope: MemoryScope;
  kind: MemoryKind;
  source_type: string;
  source_id: string | null;
  summary: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function mapMemory(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    companyKey: row.company_key,
    projectId: row.project_id,
    objectiveId: row.objective_id,
    scope: row.scope,
    kind: row.kind,
    sourceType: row.source_type,
    sourceId: row.source_id,
    summary: row.summary,
    content: row.content,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function writeLongTermMemory(
  supabase: SupabaseClient,
  params: {
    userId: string;
    companyKey: string;
    projectId?: string | null;
    objectiveId?: string | null;
    scope: MemoryScope;
    kind: MemoryKind;
    sourceType: string;
    sourceId?: string | null;
    summary: string;
    content: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("memory_records")
    .insert({
      user_id: params.userId,
      company_key: params.companyKey,
      project_id: params.projectId ?? null,
      objective_id: params.objectiveId ?? null,
      scope: params.scope,
      kind: params.kind,
      source_type: params.sourceType,
      source_id: params.sourceId ?? null,
      summary: params.summary,
      content: params.content,
      metadata: params.metadata ?? {},
    })
    .select("id, user_id, company_key, project_id, objective_id, scope, kind, source_type, source_id, summary, content, metadata, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapMemory(data as MemoryRow);
}

export async function fetchLongTermMemoryByProject(
  supabase: SupabaseClient,
  params: {
    userId: string;
    projectId: string;
    objectiveId?: string | null;
    limit?: number;
  },
) {
  let query = supabase
    .from("memory_records")
    .select("id, user_id, company_key, project_id, objective_id, scope, kind, source_type, source_id, summary, content, metadata, created_at, updated_at")
    .eq("user_id", params.userId)
    .eq("project_id", params.projectId)
    .order("created_at", { ascending: false });

  if (params.objectiveId === null) {
    query = query.is("objective_id", null);
  } else if (params.objectiveId) {
    query = query.eq("objective_id", params.objectiveId);
  }

  const { data, error } =
    params.limit && params.limit > 0 ? await query.limit(params.limit) : await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapMemory(row as MemoryRow));
}

export async function searchLongTermMemory(
  supabase: SupabaseClient,
  params: MemorySearchParams,
) {
  const limit = Math.min(Math.max(params.limit ?? 8, 1), 20);
  const terms = params.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 8);

  const { data, error } = await supabase
    .from("memory_records")
    .select("id, user_id, company_key, project_id, objective_id, scope, kind, source_type, source_id, summary, content, metadata, created_at, updated_at")
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => mapMemory(row as MemoryRow))
    .filter((memory) => {
      if (memory.scope === "company") {
        return memory.companyKey === params.companyKey;
      }

      if (memory.scope === "project") {
        return memory.projectId === params.projectId;
      }

      if (memory.scope === "objective") {
        return (
          memory.projectId === params.projectId &&
          memory.objectiveId === (params.objectiveId ?? null)
        );
      }

      return memory.userId === params.userId;
    })
    .map((memory) => {
      const haystack = `${memory.summary}\n${memory.content}`.toLowerCase();
      const score = terms.reduce(
        (total, term) => total + (haystack.includes(term) ? 1 : 0),
        0,
      );
      return { memory, score };
    })
    .filter(({ score }) => score > 0 || terms.length === 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        new Date(right.memory.updatedAt).getTime() -
          new Date(left.memory.updatedAt).getTime(),
    )
    .slice(0, limit)
    .map(({ memory }) => memory);
}

export async function resolveMemoryContext(
  supabase: SupabaseClient,
  params: {
    userId: string;
    companyKey: string;
    projectId: string;
    objectiveId?: string | null;
    query?: string;
  },
): Promise<MemoryContext> {
  const query = params.query?.trim() ?? "";

  const loadByScope = async (scope: MemoryScope, limit: number) => {
    if (query) {
      const results = await searchLongTermMemory(supabase, {
        userId: params.userId,
        companyKey: params.companyKey,
        projectId: params.projectId,
        objectiveId: params.objectiveId ?? null,
        query,
        limit,
      });

      return results.filter((item) => item.scope === scope);
    }

    let select = supabase
      .from("memory_records")
      .select("id, user_id, company_key, project_id, objective_id, scope, kind, source_type, source_id, summary, content, metadata, created_at, updated_at")
      .eq("user_id", params.userId)
      .eq("scope", scope)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (scope === "company") {
      select = select.eq("company_key", params.companyKey).is("project_id", null);
    } else if (scope === "project") {
      select = select.eq("project_id", params.projectId).is("objective_id", null);
    } else if (scope === "objective") {
      select = params.objectiveId
        ? select.eq("project_id", params.projectId).eq("objective_id", params.objectiveId)
        : select.limit(0);
    }

    const { data, error } = await select;
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => mapMemory(row as MemoryRow));
  };

  const [company, project, objective, user] = await Promise.all([
    loadByScope("company", 4),
    loadByScope("project", 6),
    loadByScope("objective", 4),
    loadByScope("user", 2),
  ]);

  return {
    company,
    project,
    objective,
    user,
  };
}
