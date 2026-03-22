import { NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_ONBOARDING_TOOLKITS, RECOMMENDED_TOOLKITS } from "@/lib/tools/config";
import {
  createComposioClient,
  inspectToolkitConnection,
  isComposioConfigured,
} from "@/lib/tools/composio";
import {
  fetchProviderConnections,
  fetchUserToolOnboarding,
  upsertProviderConnection,
  upsertUserToolOnboarding,
} from "@/lib/tools/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const updateOnboardingSchema = z.object({
  selectedToolkitSlugs: z.array(z.string().trim().min(1)).max(24),
  completed: z.boolean().optional().default(false),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = await createClient();
    const [onboarding, connections] = await Promise.all([
      fetchUserToolOnboarding(supabase, { userId: user.sub }),
      fetchProviderConnections(supabase, { userId: user.sub }),
    ]);
    const selectedToolkitSlugs =
      onboarding?.selectedToolkitSlugs.length
        ? onboarding.selectedToolkitSlugs
        : DEFAULT_ONBOARDING_TOOLKITS;
    let refreshedConnections = connections;

    if (isComposioConfigured() && refreshedConnections.length === 0) {
      try {
        const composio = createComposioClient();
        refreshedConnections = await Promise.all(
          selectedToolkitSlugs.map(async (toolkitSlug) => {
            const remoteAccounts = await composio.connectedAccounts.list({
              userIds: [user.sub],
              toolkitSlugs: [toolkitSlug],
            });
            const activeAccount = remoteAccounts.items.find(
              (account) => account.status?.toLowerCase() === "active",
            );

            if (!activeAccount) {
              return null;
            }

            return upsertProviderConnection(supabase, {
              userId: user.sub,
              toolkitSlug,
              connectedAccountId: activeAccount.id,
              authScheme: "OAUTH2",
              status: "active",
              lastSyncedAt: new Date().toISOString(),
            });
          }),
        ).then((connections) =>
          connections.filter((connection): connection is NonNullable<typeof connection> => Boolean(connection)),
        );
      } catch {
        refreshedConnections = connections;
      }
    }

    const syncedConnections =
      isComposioConfigured()
        ? await Promise.all(
            refreshedConnections.map(async (connection) => {
              if (!connection.composioSessionId) {
                return connection;
              }

              try {
                const remote = await inspectToolkitConnection({
                  sessionId: connection.composioSessionId,
                  toolkitSlug: connection.toolkitSlug,
                });

                return upsertProviderConnection(supabase, {
                  userId: user.sub,
                  toolkitSlug: connection.toolkitSlug,
                  composioSessionId: connection.composioSessionId,
                  connectedAccountId: remote.connectedAccountId,
                  authScheme: connection.authScheme ?? "OAUTH2",
                  status: remote.status,
                  redirectUrl: connection.redirectUrl,
                  callbackUrl: connection.callbackUrl,
                  lastSyncedAt: new Date().toISOString(),
                });
              } catch {
                return connection;
              }
            }),
          )
        : connections;

    return NextResponse.json({
      recommendedToolkits: RECOMMENDED_TOOLKITS,
      onboarding,
      connections: syncedConnections,
      defaultToolkitSlugs: selectedToolkitSlugs,
    }, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load tool onboarding state.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = updateOnboardingSchema.parse(await request.json());
    const supabase = await createClient();
    const onboarding = await upsertUserToolOnboarding(supabase, {
      userId: user.sub,
      selectedToolkitSlugs: body.selectedToolkitSlugs,
      completedAt: body.completed ? new Date().toISOString() : null,
    });

    return NextResponse.json(onboarding);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update tool onboarding state.",
      },
      { status: 500 },
    );
  }
}
