import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getFallbackInternalToolDefinitions,
  getInternalDefinitionBySlug,
} from "@/lib/tools/internal-registry";
import type {
  InternalToolDefinition,
  ProjectToolkitSelection,
  ProjectInternalToolEnablement,
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

type InternalToolDefinitionRow = {
  id: string;
  slug: string;
  toolkit_slug: string;
  source: "internal_builtin" | "internal_custom";
  title: string;
  description: string;
  execution_mode: "read" | "write" | "admin";
  risk_level: "low" | "medium" | "high";
  executor_key: string;
  input_schema: Record<string, unknown> | null;
  output_schema: Record<string, unknown> | null;
  tags: string[] | null;
  capabilities: string[] | null;
  approval_policy: "none" | "confirm_writes";
  requires_connection: boolean;
  enabled_by_default: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ProjectInternalToolEnablementRow = {
  id: string;
  project_id: string;
  user_id: string;
  tool_slug: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
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

function mapInternalToolDefinition(row: InternalToolDefinitionRow): InternalToolDefinition {
  return {
    id: row.id,
    slug: row.slug,
    toolkitSlug: row.toolkit_slug,
    source: row.source,
    title: row.title,
    description: row.description,
    executionMode: row.execution_mode,
    riskLevel: row.risk_level,
    executorKey: row.executor_key,
    inputSchema: row.input_schema,
    outputSchema: row.output_schema,
    tags: row.tags ?? [],
    capabilities: row.capabilities ?? [],
    approvalPolicy: row.approval_policy,
    requiresConnection: row.requires_connection,
    enabledByDefault: row.enabled_by_default,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectInternalToolEnablement(
  row: ProjectInternalToolEnablementRow,
): ProjectInternalToolEnablement {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    toolSlug: row.tool_slug,
    isEnabled: row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

export async function fetchInternalToolDefinitions(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("internal_tool_definitions")
    .select(
      "id, slug, toolkit_slug, source, title, description, execution_mode, risk_level, executor_key, input_schema, output_schema, tags, capabilities, approval_policy, requires_connection, enabled_by_default, metadata, created_at, updated_at",
    )
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapInternalToolDefinition(row as InternalToolDefinitionRow));
}

export async function fetchInternalToolDefinitionsWithFallback(supabase: SupabaseClient) {
  try {
    const definitions = await fetchInternalToolDefinitions(supabase);
    if (definitions.length === 0) {
      return getFallbackInternalToolDefinitions();
    }

    const mergedDefinitions = new Map(
      getFallbackInternalToolDefinitions().map((definition) => [definition.slug, definition]),
    );

    for (const definition of definitions) {
      mergedDefinitions.set(definition.slug, definition);
    }

    return Array.from(mergedDefinitions.values());
  } catch {
    return getFallbackInternalToolDefinitions();
  }
}

export async function fetchInternalToolDefinitionBySlug(
  supabase: SupabaseClient,
  params: { toolSlug: string },
) {
  const definitions = await fetchInternalToolDefinitionsWithFallback(supabase);
  return (
    definitions.find((definition) => definition.slug === params.toolSlug) ??
    getInternalDefinitionBySlug(params.toolSlug)
  );
}

export async function upsertInternalToolDefinition(
  supabase: SupabaseClient,
  params: {
    slug: string;
    toolkitSlug: string;
    source: "internal_builtin" | "internal_custom";
    title: string;
    description: string;
    executionMode: "read" | "write" | "admin";
    riskLevel: "low" | "medium" | "high";
    executorKey: string;
    inputSchema?: Record<string, unknown> | null;
    outputSchema?: Record<string, unknown> | null;
    tags?: string[];
    capabilities?: string[];
    approvalPolicy?: "none" | "confirm_writes";
    requiresConnection?: boolean;
    enabledByDefault?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("internal_tool_definitions")
    .upsert(
      {
        slug: params.slug,
        toolkit_slug: params.toolkitSlug,
        source: params.source,
        title: params.title,
        description: params.description,
        execution_mode: params.executionMode,
        risk_level: params.riskLevel,
        executor_key: params.executorKey,
        input_schema: params.inputSchema ?? null,
        output_schema: params.outputSchema ?? null,
        tags: params.tags ?? [],
        capabilities: params.capabilities ?? [],
        approval_policy: params.approvalPolicy ?? "none",
        requires_connection: params.requiresConnection ?? false,
        enabled_by_default: params.enabledByDefault ?? true,
        metadata: params.metadata ?? {},
      },
      { onConflict: "slug" },
    )
    .select(
      "id, slug, toolkit_slug, source, title, description, execution_mode, risk_level, executor_key, input_schema, output_schema, tags, capabilities, approval_policy, requires_connection, enabled_by_default, metadata, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapInternalToolDefinition(data as InternalToolDefinitionRow);
}

export async function fetchProjectInternalToolEnablements(
  supabase: SupabaseClient,
  params: { projectId: string; userId: string },
) {
  const { data, error } = await supabase
    .from("project_internal_tool_enablements")
    .select("id, project_id, user_id, tool_slug, is_enabled, created_at, updated_at")
    .eq("project_id", params.projectId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    mapProjectInternalToolEnablement(row as ProjectInternalToolEnablementRow),
  );
}

export async function upsertProjectInternalToolEnablement(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    userId: string;
    toolSlug: string;
    isEnabled: boolean;
  },
) {
  const { data, error } = await supabase
    .from("project_internal_tool_enablements")
    .upsert(
      {
        project_id: params.projectId,
        user_id: params.userId,
        tool_slug: params.toolSlug,
        is_enabled: params.isEnabled,
      },
      { onConflict: "project_id,tool_slug" },
    )
    .select("id, project_id, user_id, tool_slug, is_enabled, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapProjectInternalToolEnablement(data as ProjectInternalToolEnablementRow);
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
