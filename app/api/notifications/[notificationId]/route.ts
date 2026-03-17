import { NextResponse } from "next/server";
import { z } from "zod";

import {
  dismissNotification,
  markNotificationRead,
} from "@/lib/notifications/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const updateNotificationSchema = z.object({
  action: z.enum(["read", "dismiss"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { notificationId } = await context.params;
    const body = updateNotificationSchema.parse(await request.json());
    const supabase = await createClient();
    const notification =
      body.action === "dismiss"
        ? await dismissNotification(supabase, {
            userId: user.sub,
            notificationId,
          })
        : await markNotificationRead(supabase, {
            userId: user.sub,
            notificationId,
          });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    return NextResponse.json(notification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid notification action.", issues: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update notification.",
      },
      { status: 500 },
    );
  }
}
