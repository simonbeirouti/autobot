import { NextResponse } from "next/server";
import { z } from "zod";

import { advanceRunWorkspace } from "@/lib/runs/advance";
import { listBlockedRunsForUser } from "@/lib/runs/repository";
import { inspectToolkitConnection, isComposioConfigured } from "@/lib/tools/composio";
import { fetchProviderConnectionByToolkit, upsertProviderConnection } from "@/lib/tools/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const syncConnectionSchema = z.object({
  toolkitSlug: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isComposioConfigured()) {
      return NextResponse.json(
        { error: "COMPOSIO_API_KEY is not configured on the server." },
        { status: 500 },
      );
    }

    const body = syncConnectionSchema.parse(await request.json());
    const supabase = await createClient();
    const existingConnection = await fetchProviderConnectionByToolkit(supabase, {
      userId: user.sub,
      toolkitSlug: body.toolkitSlug,
    });

    if (!existingConnection?.composioSessionId) {
      return NextResponse.json(
        { error: "No Composio session found for this provider yet." },
        { status: 409 },
      );
    }

    const result = await inspectToolkitConnection({
      sessionId: existingConnection.composioSessionId,
      toolkitSlug: body.toolkitSlug,
    });

    const connection = await upsertProviderConnection(supabase, {
      userId: user.sub,
      toolkitSlug: body.toolkitSlug,
      composioSessionId: existingConnection.composioSessionId,
      connectedAccountId: result.connectedAccountId,
      authScheme: existingConnection.authScheme ?? "OAUTH2",
      status: result.status,
      redirectUrl: existingConnection.redirectUrl,
      callbackUrl: existingConnection.callbackUrl,
      lastSyncedAt: new Date().toISOString(),
    });

    if (connection.status === "active") {
      const blockedRuns = await listBlockedRunsForUser(supabase, {
        userId: user.sub,
      });

      await Promise.all(
        blockedRuns
          .filter((run) => run.actionRequired?.requiredToolkitSlugs.includes(body.toolkitSlug))
          .map((run) =>
            advanceRunWorkspace({
              supabase,
              user,
              runId: run.id,
              force: true,
            }).catch(() => null),
          ),
      );
    }

    return NextResponse.json(connection);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to sync provider connection.",
      },
      { status: 500 },
    );
  }
}
