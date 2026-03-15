import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchLongTermMemoryByProject } from "@/lib/memory/repository";
import type {
  Objective,
  ObjectiveStatus,
  Project,
  ProjectAsset,
  ProjectChatMessage,
  ProjectChatThread,
  ProjectWorkspace,
} from "@/lib/projects/types";

type ProjectRow = {
  id: string;
  user_id: string;
  company_key: string;
  name: string;
  description: string;
  icon_key: string;
  created_at: string;
  updated_at: string;
};

type ObjectiveRow = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string;
  source_run_id: string | null;
  source_draft_id: string | null;
  status: ObjectiveStatus;
  created_at: string;
  updated_at: string;
};

type AssetRow = {
  id: string;
  project_id: string;
  user_id: string;
  label: string;
  asset_type: string;
  storage_path: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ThreadRow = {
  id: string;
  project_id: string;
  objective_id: string | null;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  project_id: string;
  objective_id: string | null;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agent_id: string | null;
  cited_memory_ids: string[] | null;
  created_at: string;
};

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.user_id,
    companyKey: row.company_key,
    name: row.name,
    description: row.description,
    iconKey: row.icon_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapObjective(row: ObjectiveRow): Objective {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    sourceRunId: row.source_run_id,
    sourceDraftId: row.source_draft_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAsset(row: AssetRow): ProjectAsset {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    label: row.label,
    assetType: row.asset_type,
    storagePath: row.storage_path,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapThread(row: ThreadRow): ProjectChatThread {
  return {
    id: row.id,
    projectId: row.project_id,
    objectiveId: row.objective_id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): ProjectChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    projectId: row.project_id,
    objectiveId: row.objective_id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    agentId: row.agent_id,
    citedMemoryIds: row.cited_memory_ids ?? [],
    createdAt: row.created_at,
  };
}

export async function createProject(
  supabase: SupabaseClient,
  params: {
    userId: string;
    companyKey: string;
    name: string;
    description: string;
    iconKey: string;
  },
) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: params.userId,
      company_key: params.companyKey,
      name: params.name,
      description: params.description,
      icon_key: params.iconKey,
    })
    .select("id, user_id, company_key, name, description, icon_key, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapProject(data as ProjectRow);
}

export async function fetchProjects(
  supabase: SupabaseClient,
  params: { userId: string },
) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id, company_key, name, description, icon_key, created_at, updated_at")
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapProject(row as ProjectRow));
}

export async function fetchProject(
  supabase: SupabaseClient,
  params: { projectId: string; userId: string },
) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id, company_key, name, description, icon_key, created_at, updated_at")
    .eq("id", params.projectId)
    .eq("user_id", params.userId)
    .single();

  if (error) {
    throw error;
  }

  return mapProject(data as ProjectRow);
}

export async function createObjective(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    userId: string;
    title: string;
    description?: string;
    sourceRunId?: string | null;
    sourceDraftId?: string | null;
    status?: ObjectiveStatus;
  },
) {
  const { data, error } = await supabase
    .from("objectives")
    .insert({
      project_id: params.projectId,
      user_id: params.userId,
      title: params.title,
      description: params.description ?? "",
      source_run_id: params.sourceRunId ?? null,
      source_draft_id: params.sourceDraftId ?? null,
      status: params.status ?? "draft",
    })
    .select("id, project_id, user_id, title, description, source_run_id, source_draft_id, status, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapObjective(data as ObjectiveRow);
}

export async function updateObjective(
  supabase: SupabaseClient,
  params: {
    objectiveId: string;
    projectId: string;
    userId: string;
    patch: {
      title?: string;
      description?: string;
      sourceRunId?: string | null;
      sourceDraftId?: string | null;
      status?: ObjectiveStatus;
    };
  },
) {
  const patch: Record<string, unknown> = {};
  if (params.patch.title !== undefined) patch.title = params.patch.title;
  if (params.patch.description !== undefined) patch.description = params.patch.description;
  if (params.patch.sourceRunId !== undefined) patch.source_run_id = params.patch.sourceRunId;
  if (params.patch.sourceDraftId !== undefined) patch.source_draft_id = params.patch.sourceDraftId;
  if (params.patch.status !== undefined) patch.status = params.patch.status;

  const { data, error } = await supabase
    .from("objectives")
    .update(patch)
    .eq("id", params.objectiveId)
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId)
    .select("id, project_id, user_id, title, description, source_run_id, source_draft_id, status, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapObjective(data as ObjectiveRow);
}

export async function fetchObjectives(
  supabase: SupabaseClient,
  params: { projectId: string; userId: string },
) {
  const { data, error } = await supabase
    .from("objectives")
    .select("id, project_id, user_id, title, description, source_run_id, source_draft_id, status, created_at, updated_at")
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapObjective(row as ObjectiveRow));
}

export async function fetchObjective(
  supabase: SupabaseClient,
  params: { objectiveId: string; projectId: string; userId: string },
) {
  const { data, error } = await supabase
    .from("objectives")
    .select("id, project_id, user_id, title, description, source_run_id, source_draft_id, status, created_at, updated_at")
    .eq("id", params.objectiveId)
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId)
    .single();

  if (error) {
    throw error;
  }

  return mapObjective(data as ObjectiveRow);
}

export async function fetchProjectAssets(
  supabase: SupabaseClient,
  params: { projectId: string; userId: string },
) {
  const { data, error } = await supabase
    .from("project_assets")
    .select("id, project_id, user_id, label, asset_type, storage_path, metadata, created_at, updated_at")
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapAsset(row as AssetRow));
}

export async function createProjectChatThread(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    objectiveId?: string | null;
    userId: string;
    title?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("project_chat_threads")
    .insert({
      project_id: params.projectId,
      objective_id: params.objectiveId ?? null,
      user_id: params.userId,
      title: params.title ?? null,
    })
    .select("id, project_id, objective_id, user_id, title, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapThread(data as ThreadRow);
}

export async function fetchProjectThreads(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    userId: string;
    objectiveId?: string | null;
  },
) {
  let query = supabase
    .from("project_chat_threads")
    .select("id, project_id, objective_id, user_id, title, created_at, updated_at")
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false });

  if (params.objectiveId === null) {
    query = query.is("objective_id", null);
  } else if (params.objectiveId) {
    query = query.eq("objective_id", params.objectiveId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapThread(row as ThreadRow));
}

export async function fetchProjectThread(
  supabase: SupabaseClient,
  params: {
    threadId: string;
    projectId: string;
    userId: string;
  },
) {
  const { data, error } = await supabase
    .from("project_chat_threads")
    .select("id, project_id, objective_id, user_id, title, created_at, updated_at")
    .eq("id", params.threadId)
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId)
    .single();

  if (error) {
    throw error;
  }

  return mapThread(data as ThreadRow);
}

export async function touchProjectChatThread(
  supabase: SupabaseClient,
  params: {
    threadId: string;
    projectId: string;
    userId: string;
    title?: string | null;
  },
) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.title !== undefined) {
    patch.title = params.title;
  }

  const { error } = await supabase
    .from("project_chat_threads")
    .update(patch)
    .eq("id", params.threadId)
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId);

  if (error) {
    throw error;
  }
}

export async function appendProjectChatMessage(
  supabase: SupabaseClient,
  params: {
    threadId: string;
    projectId: string;
    objectiveId?: string | null;
    userId: string;
    role: "user" | "assistant" | "system";
    content: string;
    agentId?: string | null;
    citedMemoryIds?: string[];
  },
) {
  const { data, error } = await supabase
    .from("project_chat_messages")
    .insert({
      thread_id: params.threadId,
      project_id: params.projectId,
      objective_id: params.objectiveId ?? null,
      user_id: params.userId,
      role: params.role,
      content: params.content,
      agent_id: params.agentId ?? null,
      cited_memory_ids: params.citedMemoryIds ?? [],
    })
    .select("id, thread_id, project_id, objective_id, user_id, role, content, agent_id, cited_memory_ids, created_at")
    .single();

  if (error) {
    throw error;
  }

  await touchProjectChatThread(supabase, {
    threadId: params.threadId,
    projectId: params.projectId,
    userId: params.userId,
  });

  return mapMessage(data as MessageRow);
}

export async function fetchProjectChatMessages(
  supabase: SupabaseClient,
  params: {
    threadId: string;
    projectId: string;
    userId: string;
  },
) {
  const { data, error } = await supabase
    .from("project_chat_messages")
    .select("id, thread_id, project_id, objective_id, user_id, role, content, agent_id, cited_memory_ids, created_at")
    .eq("thread_id", params.threadId)
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapMessage(row as MessageRow));
}

export async function fetchProjectWorkspace(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    userId: string;
    threadId?: string | null;
  },
): Promise<ProjectWorkspace> {
  const [project, objectives, assets, threads, recentMemories] = await Promise.all([
    fetchProject(supabase, { projectId: params.projectId, userId: params.userId }),
    fetchObjectives(supabase, { projectId: params.projectId, userId: params.userId }),
    fetchProjectAssets(supabase, { projectId: params.projectId, userId: params.userId }),
    fetchProjectThreads(supabase, { projectId: params.projectId, userId: params.userId }),
    fetchLongTermMemoryByProject(supabase, {
      userId: params.userId,
      projectId: params.projectId,
      limit: 8,
    }),
  ]);

  const activeThread = params.threadId
    ? threads.find((thread) => thread.id === params.threadId) ?? null
    : threads[0] ?? null;
  const messages = activeThread
    ? await fetchProjectChatMessages(supabase, {
        threadId: activeThread.id,
        projectId: params.projectId,
        userId: params.userId,
      })
    : [];

  return {
    project,
    objectives,
    assets,
    threads,
    activeThread,
    messages,
    recentMemories,
  };
}
