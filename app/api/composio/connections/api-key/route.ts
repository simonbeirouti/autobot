import { NextResponse } from "next/server";
import { z } from "zod";

import { getToolsEncryptionSecret } from "@/lib/tools/api-keys";
import { inspectToolkitConnection, isComposioConfigured } from "@/lib/tools/composio";
import { fetchProviderConnectionByToolkit, upsertProviderConnection } from "@/lib/tools/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const saveApiKeySchema = z.object({
  toolkitSlug: z.string().trim().min(1),
  apiKey: z.string().trim().min(1),
  authScheme: z.string().trim().min(1).default("API_KEY"),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = saveApiKeySchema.parse(await request.json());
    const supabase = await createClient();
    const encryptionSecret = getToolsEncryptionSecret();
    const existingConnection = await fetchProviderConnectionByToolkit(supabase, {
      userId: user.sub,
      toolkitSlug: body.toolkitSlug,
    });

    const { data, error } = await supabase.rpc("save_provider_connection_api_key", {
      p_toolkit_slug: body.toolkitSlug,
      p_api_key: body.apiKey,
      p_auth_scheme: body.authScheme,
      p_encryption_secret: encryptionSecret,
    });

    if (error) {
      throw error;
    }

    let connection = {
      id: data.id,
      userId: data.user_id,
      toolkitSlug: data.toolkit_slug,
      composioSessionId: data.composio_session_id,
      connectedAccountId: data.connected_account_id,
      authScheme: data.auth_scheme,
      apiKeyLastFour: data.api_key_last_four,
      apiKeyUpdatedAt: data.api_key_updated_at,
      status: data.status,
      redirectUrl: data.redirect_url,
      callbackUrl: data.callback_url,
      lastSyncedAt: data.last_synced_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    if (existingConnection?.composioSessionId && isComposioConfigured()) {
      const inspected = await inspectToolkitConnection({
        sessionId: existingConnection.composioSessionId,
        toolkitSlug: body.toolkitSlug,
      });

      connection = await upsertProviderConnection(supabase, {
        userId: user.sub,
        toolkitSlug: body.toolkitSlug,
        composioSessionId: existingConnection.composioSessionId,
        connectedAccountId: inspected.connectedAccountId,
        authScheme: body.authScheme,
        apiKeyLastFour: data.api_key_last_four,
        apiKeyUpdatedAt: data.api_key_updated_at,
        status: inspected.status,
        redirectUrl: existingConnection.redirectUrl,
        callbackUrl: existingConnection.callbackUrl,
        lastSyncedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      verified: connection.status === "active",
      connection: {
        id: connection.id,
        userId: connection.userId,
        toolkitSlug: connection.toolkitSlug,
        composioSessionId: connection.composioSessionId,
        connectedAccountId: connection.connectedAccountId,
        authScheme: connection.authScheme,
        apiKeyLastFour: connection.apiKeyLastFour,
        apiKeyUpdatedAt: connection.apiKeyUpdatedAt,
        status: connection.status,
        redirectUrl: connection.redirectUrl,
        callbackUrl: connection.callbackUrl,
        lastSyncedAt: connection.lastSyncedAt,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save API-key connection.",
      },
      { status: 500 },
    );
  }
}
