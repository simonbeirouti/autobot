import { NextResponse } from "next/server";
import { z } from "zod";

import {
  beginToolkitAuthorization,
  getRecommendedToolkitSlugs,
  isComposioConfigured,
} from "@/lib/tools/composio";
import { fetchProviderConnectionByToolkit, upsertProviderConnection } from "@/lib/tools/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const startConnectionSchema = z.object({
  toolkitSlug: z.string().trim().min(1),
  nextPath: z.string().trim().min(1).optional().default("/dashboard"),
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

    const body = startConnectionSchema.parse(await request.json());
    const supabase = await createClient();
    const existingConnection = await fetchProviderConnectionByToolkit(supabase, {
      userId: user.sub,
      toolkitSlug: body.toolkitSlug,
    });
    const origin = new URL(request.url).origin;
    const callbackUrl = new URL("/api/composio/callback", origin);
    callbackUrl.searchParams.set("toolkit", body.toolkitSlug);
    callbackUrl.searchParams.set("next", body.nextPath);

    const result = await beginToolkitAuthorization({
      userId: user.sub,
      toolkitSlug: body.toolkitSlug,
      callbackUrl: callbackUrl.toString(),
      sessionId: existingConnection?.composioSessionId ?? null,
      toolkitSlugs: getRecommendedToolkitSlugs(),
    });

    const connection = await upsertProviderConnection(supabase, {
      userId: user.sub,
      toolkitSlug: body.toolkitSlug,
      composioSessionId: result.sessionId,
      connectedAccountId: result.connectedAccountId,
      authScheme: "OAUTH2",
      status: "initiated",
      redirectUrl: result.redirectUrl,
      callbackUrl: callbackUrl.toString(),
      lastSyncedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      connection,
      redirectUrl: result.redirectUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to start provider connection.",
      },
      { status: 500 },
    );
  }
}
