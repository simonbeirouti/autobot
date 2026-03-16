import { NextResponse } from "next/server";

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

    await upsertProviderConnection(supabase, {
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

    redirectUrl.searchParams.set("toolkit", toolkitSlug);
    redirectUrl.searchParams.set("connection", result.status);
    return NextResponse.redirect(redirectUrl);
  } catch {
    redirectUrl.searchParams.set("connection", "error");
    return NextResponse.redirect(redirectUrl);
  }
}
