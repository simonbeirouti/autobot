import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ensureNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/notifications/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const updateNotificationPreferencesSchema = z.object({
  marketingEmail: z.boolean(),
  platformUpdatesEmail: z.boolean(),
  platformUpdatesInApp: z.boolean(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = await createClient();
    const preferences = await ensureNotificationPreferences(supabase, { userId: user.sub });

    return NextResponse.json(preferences, {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load notification preferences.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = updateNotificationPreferencesSchema.parse(await request.json());
    const supabase = await createClient();
    const preferences = await updateNotificationPreferences(supabase, {
      userId: user.sub,
      patch: body,
    });

    return NextResponse.json(preferences);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid notification preferences.", issues: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update notification preferences.",
      },
      { status: 500 },
    );
  }
}
