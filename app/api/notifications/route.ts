import { NextResponse } from "next/server";

import { listNotifications } from "@/lib/notifications/repository";
import { sendDueRunBlockedEmail } from "@/lib/runs/action-required";
import { listBlockedRunsForUser } from "@/lib/runs/repository";
import { sweepRunsWatchdog } from "@/lib/runs/watchdog";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function getRecipientName(user: {
  email?: string | null;
  user_metadata?: { full_name?: string | null; name?: string | null };
}) {
  return user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = await createClient();
    await sweepRunsWatchdog({
      supabase,
      userId: user.sub,
    });
    const blockedRuns = await listBlockedRunsForUser(supabase, {
      userId: user.sub,
    });

    await Promise.all(
      blockedRuns.map((run) =>
        sendDueRunBlockedEmail(supabase, {
          userId: user.sub,
          recipientEmail: typeof user.email === "string" ? user.email : null,
          recipientName: getRecipientName(user),
          run,
        }),
      ),
    );

    const notifications = await listNotifications(supabase, {
      userId: user.sub,
      limit: 25,
    });

    return NextResponse.json(notifications, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load notifications.",
      },
      { status: 500 },
    );
  }
}
