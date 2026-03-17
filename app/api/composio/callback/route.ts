import { NextResponse } from "next/server";

import { advanceRunWorkspace } from "@/lib/runs/advance";
import { listBlockedRunsForUser } from "@/lib/runs/repository";
import { inspectToolkitConnection, isComposioConfigured } from "@/lib/tools/composio";
import { fetchProviderConnectionByToolkit, upsertProviderConnection } from "@/lib/tools/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const callbackUrl = new URL(request.url);
  const toolkitSlug = callbackUrl.searchParams.get("toolkit");
  const nextPath = callbackUrl.searchParams.get("next") ?? "/onboarding/providers";
  const redirectUrl = new URL(nextPath, origin);

  try {
    if (!isComposioConfigured()) {
      redirectUrl.searchParams.set("connection", "error");
      redirectUrl.searchParams.set("reason", "missing_composio_api_key");
      return NextResponse.redirect(redirectUrl);
    }

    const user = await getCurrentUser();
    if (!user?.sub || !toolkitSlug) {
      redirectUrl.searchParams.set("connection", "error");
      return NextResponse.redirect(redirectUrl);
    }

    const supabase = await createClient();
    const existingConnection = await fetchProviderConnectionByToolkit(supabase, {
      userId: user.sub,
      toolkitSlug,
    });

    if (!existingConnection?.composioSessionId) {
      redirectUrl.searchParams.set("connection", "missing");
      return NextResponse.redirect(redirectUrl);
    }

    const result = await inspectToolkitConnection({
      sessionId: existingConnection.composioSessionId,
      toolkitSlug,
    });

    const connection = await upsertProviderConnection(supabase, {
      userId: user.sub,
      toolkitSlug,
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
          .filter((run) => run.actionRequired?.requiredToolkitSlugs.includes(toolkitSlug))
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

    redirectUrl.searchParams.set("toolkit", toolkitSlug);
    redirectUrl.searchParams.set("connection", connection.status);
    return NextResponse.redirect(redirectUrl);
  } catch {
    redirectUrl.searchParams.set("connection", "error");
    return NextResponse.redirect(redirectUrl);
  }
}
