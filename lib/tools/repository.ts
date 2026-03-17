import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ProjectToolkitSelection,
  ProviderConnection,
  ToolInvocationStatus,
  ToolkitConnectionStatus,
  UserToolOnboarding,
} from "@/lib/tools/types";

type UserToolOnboardingRow = {
  user_id: string;
  selected_toolkit_slugs: string[] | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProviderConnectionRow = {
  id: string;
  user_id: string;
  toolkit_slug: string;
  composio_session_id: string | null;
  connected_account_id: string | null;
  auth_scheme: string | null;
  api_key_last_four: string | null;
  api_key_updated_at: string | null;
  status: ToolkitConnectionStatus;
  redirect_url: string | null;
  callback_url: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectToolkitSelectionRow = {
  id: string;
  project_id: string;
  user_id: string;
  toolkit_slug: string;
  created_at: string;
};

function mapOnboarding(row: UserToolOnboardingRow): UserToolOnboarding {
  return {
    userId: row.user_id,
    selectedToolkitSlugs: row.selected_toolkit_slugs ?? [],
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProviderConnection(row: ProviderConnectionRow): ProviderConnection {
  return {
    id: row.id,
    userId: row.user_id,
    toolkitSlug: row.toolkit_slug,
    composioSessionId: row.composio_session_id,
    connectedAccountId: row.connected_account_id,
    authScheme: row.auth_scheme,
    apiKeyLastFour: row.api_key_last_four,
    apiKeyUpdatedAt: row.api_key_updated_at,
    status: row.status,
    redirectUrl: row.redirect_url,
    callbackUrl: row.callback_url,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectToolkitSelection(row: ProjectToolkitSelectionRow): ProjectToolkitSelection {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    toolkitSlug: row.toolkit_slug,
    createdAt: row.created_at,
  };
}

export async function fetchUserToolOnboarding(
  supabase: SupabaseClient,
  params: { userId: string },
) {
  const { data, error } = await supabase
    .from("user_tool_onboarding")
    .select("user_id, selected_toolkit_slugs, completed_at, created_at, updated_at")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapOnboarding(data as UserToolOnboardingRow) : null;
}

export async function upsertUserToolOnboarding(
  supabase: SupabaseClient,
  params: {
    userId: string;
    selectedToolkitSlugs: string[];
    completedAt?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("user_tool_onboarding")
    .upsert(
      {
        user_id: params.userId,
        selected_toolkit_slugs: params.selectedToolkitSlugs,
        ...(params.completedAt !== undefined ? { completed_at: params.completedAt } : {}),
      },
      { onConflict: "user_id" },
    )
    .select("user_id, selected_toolkit_slugs, completed_at, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapOnboarding(data as UserToolOnboardingRow);
}

export async function fetchProviderConnections(
  supabase: SupabaseClient,
  params: { userId: string },
) {
  const { data, error } = await supabase
    .from("provider_connections")
    .select(
      "id, user_id, toolkit_slug, composio_session_id, connected_account_id, auth_scheme, api_key_last_four, api_key_updated_at, status, redirect_url, callback_url, last_synced_at, created_at, updated_at",
    )
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapProviderConnection(row as ProviderConnectionRow));
}

export async function fetchProviderConnectionByToolkit(
  supabase: SupabaseClient,
  params: { userId: string; toolkitSlug: string },
) {
  const { data, error } = await supabase
    .from("provider_connections")
    .select(
      "id, user_id, toolkit_slug, composio_session_id, connected_account_id, auth_scheme, api_key_last_four, api_key_updated_at, status, redirect_url, callback_url, last_synced_at, created_at, updated_at",
    )
    .eq("user_id", params.userId)
    .eq("toolkit_slug", params.toolkitSlug)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProviderConnection(data as ProviderConnectionRow) : null;
}

export async function upsertProviderConnection(
  supabase: SupabaseClient,
  params: {
    userId: string;
    toolkitSlug: string;
    composioSessionId?: string | null;
    connectedAccountId?: string | null;
    authScheme?: string | null;
    apiKeyLastFour?: string | null;
    apiKeyUpdatedAt?: string | null;
    status: ToolkitConnectionStatus;
    redirectUrl?: string | null;
    callbackUrl?: string | null;
    lastSyncedAt?: string | null;
  },
) {
  const current = await fetchProviderConnectionByToolkit(supabase, {
    userId: params.userId,
    toolkitSlug: params.toolkitSlug,
  });

  const payload = {
    user_id: params.userId,
    toolkit_slug: params.toolkitSlug,
    composio_session_id: params.composioSessionId ?? current?.composioSessionId ?? null,
    connected_account_id: params.connectedAccountId ?? current?.connectedAccountId ?? null,
    auth_scheme: params.authScheme ?? current?.authScheme ?? null,
    api_key_last_four: params.apiKeyLastFour ?? current?.apiKeyLastFour ?? null,
    api_key_updated_at: params.apiKeyUpdatedAt ?? current?.apiKeyUpdatedAt ?? null,
    status: params.status,
    redirect_url: params.redirectUrl ?? current?.redirectUrl ?? null,
    callback_url: params.callbackUrl ?? current?.callbackUrl ?? null,
    last_synced_at: params.lastSyncedAt ?? current?.lastSyncedAt ?? null,
  };

  const query = current
    ? supabase.from("provider_connections").update(payload).eq("id", current.id)
    : supabase.from("provider_connections").insert(payload);

  const { data, error } = await query
    .select(
      "id, user_id, toolkit_slug, composio_session_id, connected_account_id, auth_scheme, api_key_last_four, api_key_updated_at, status, redirect_url, callback_url, last_synced_at, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapProviderConnection(data as ProviderConnectionRow);
}

export async function fetchProjectToolkitSelections(
  supabase: SupabaseClient,
  params: { projectId: string; userId: string },
) {
  const { data, error } = await supabase
    .from("project_toolkit_selections")
    .select("id, project_id, user_id, toolkit_slug, created_at")
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapProjectToolkitSelection(row as ProjectToolkitSelectionRow));
}

export async function replaceProjectToolkitSelections(
  supabase: SupabaseClient,
  params: { projectId: string; userId: string; toolkitSlugs: string[] },
) {
  const { error: deleteError } = await supabase
    .from("project_toolkit_selections")
    .delete()
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId);

  if (deleteError) {
    throw deleteError;
  }

  if (params.toolkitSlugs.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("project_toolkit_selections")
    .insert(
      params.toolkitSlugs.map((toolkitSlug) => ({
        project_id: params.projectId,
        user_id: params.userId,
        toolkit_slug: toolkitSlug,
      })),
    )
    .select("id, project_id, user_id, toolkit_slug, created_at");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapProjectToolkitSelection(row as ProjectToolkitSelectionRow));
}

export async function insertToolInvocation(
  supabase: SupabaseClient,
  params: {
    userId: string;
    toolkitSlug: string;
    toolSlug: string;
    status: ToolInvocationStatus;
    inputSummary?: string | null;
    resultSummary?: string | null;
    projectId?: string | null;
    objectiveId?: string | null;
    threadId?: string | null;
    runId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("tool_invocations")
    .insert({
      user_id: params.userId,
      project_id: params.projectId ?? null,
      objective_id: params.objectiveId ?? null,
      thread_id: params.threadId ?? null,
      run_id: params.runId ?? null,
      toolkit_slug: params.toolkitSlug,
      tool_slug: params.toolSlug,
      status: params.status,
      input_summary: params.inputSummary ?? null,
      result_summary: params.resultSummary ?? null,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}
