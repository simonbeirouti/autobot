import type { SupabaseClient } from "@supabase/supabase-js";

import { sendNotificationEmail } from "@/lib/notifications/email";
import {
  createNotification,
  ensureNotificationPreferences,
} from "@/lib/notifications/repository";
import type {
  NotificationDeliveryRequest,
  NotificationPreferences,
  NotificationRecord,
} from "@/lib/notifications/types";

function shouldSendChannel(
  preferences: NotificationPreferences,
  category: NotificationDeliveryRequest["category"],
  channel: NotificationRecord["channel"],
) {
  if (category === "marketing") {
    return channel === "email" ? preferences.marketingEmail : false;
  }

  return channel === "email"
    ? preferences.platformUpdatesEmail
    : preferences.platformUpdatesInApp;
}

export async function deliverNotification(
  supabase: SupabaseClient,
  params: NotificationDeliveryRequest,
) {
  const preferences = await ensureNotificationPreferences(supabase, {
    userId: params.userId,
  });
  const deliveries: {
    email: NotificationRecord | null;
    inApp: NotificationRecord | null;
  } = {
    email: null,
    inApp: null,
  };

  if (shouldSendChannel(preferences, params.category, "in_app")) {
    deliveries.inApp = await createNotification(supabase, {
      userId: params.userId,
      category: params.category,
      channel: "in_app",
      kind: params.kind,
      title: params.title,
      body: params.body,
      href: params.href ?? null,
      actionLabel: params.actionLabel ?? null,
      actionHref: params.actionHref ?? null,
      dedupeKey: params.dedupeKey ? `${params.dedupeKey}:in_app` : null,
      metadata: params.metadata ?? {},
    });
  }

  if (
    shouldSendChannel(preferences, params.category, "email") &&
    params.recipientEmail
  ) {
    deliveries.email = await createNotification(supabase, {
      userId: params.userId,
      category: params.category,
      channel: "email",
      kind: params.kind,
      title: params.title,
      body: params.body,
      href: params.href ?? null,
      actionLabel: params.actionLabel ?? null,
      actionHref: params.actionHref ?? null,
      dedupeKey: params.dedupeKey ? `${params.dedupeKey}:email` : null,
      metadata: params.metadata ?? {},
    });

    try {
      await sendNotificationEmail({
        actionLabel: params.actionLabel ?? null,
        actionUrl: params.actionHref ?? params.href ?? null,
        body: params.body,
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName ?? null,
        subject: params.title,
      });
    } catch (error) {
      console.error("Failed to send notification email", {
        error,
        notificationId: deliveries.email.id,
        userId: params.userId,
      });
    }
  }

  return deliveries;
}
