import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateNotificationRequest,
  NotificationListItem,
  NotificationPreferenceUpdate,
  NotificationPreferences,
  NotificationRecord,
} from "@/lib/notifications/types";

type NotificationPreferencesRow = {
  user_id: string;
  marketing_email: boolean;
  platform_updates_email: boolean;
  platform_updates_in_app: boolean;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  category: NotificationRecord["category"];
  channel: NotificationRecord["channel"];
  kind: string;
  title: string;
  body: string;
  href: string | null;
  action_label: string | null;
  action_href: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  dedupe_key: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function mapPreferences(row: NotificationPreferencesRow): NotificationPreferences {
  return {
    userId: row.user_id,
    marketingEmail: row.marketing_email,
    platformUpdatesEmail: row.platform_updates_email,
    platformUpdatesInApp: row.platform_updates_in_app,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row: NotificationRow): NotificationListItem {
  const metadata = row.metadata ?? {};

  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    channel: row.channel,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    actionLabel: row.action_label,
    actionHref: row.action_href,
    actionTarget:
      typeof metadata.actionTarget === "object" && metadata.actionTarget !== null
        ? (metadata.actionTarget as NotificationListItem["actionTarget"])
        : null,
    readAt: row.read_at,
    dismissedAt: row.dismissed_at,
    dedupeKey: row.dedupe_key,
    metadata,
    createdAt: row.created_at,
    isRead: row.read_at !== null,
  };
}

export async function ensureNotificationPreferences(
  supabase: SupabaseClient,
  params: { userId: string },
) {
  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: params.userId }, { onConflict: "user_id" })
    .select(
      "user_id, marketing_email, platform_updates_email, platform_updates_in_app, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapPreferences(data as NotificationPreferencesRow);
}

export async function updateNotificationPreferences(
  supabase: SupabaseClient,
  params: { userId: string; patch: NotificationPreferenceUpdate },
) {
  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: params.userId,
        marketing_email: params.patch.marketingEmail,
        platform_updates_email: params.patch.platformUpdatesEmail,
        platform_updates_in_app: params.patch.platformUpdatesInApp,
      },
      { onConflict: "user_id" },
    )
    .select(
      "user_id, marketing_email, platform_updates_email, platform_updates_in_app, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapPreferences(data as NotificationPreferencesRow);
}

export async function createNotification(
  supabase: SupabaseClient,
  params: CreateNotificationRequest,
) {
  const payload = {
    user_id: params.userId,
    category: params.category,
    channel: params.channel,
    kind: params.kind,
    title: params.title.trim(),
    body: params.body.trim(),
    href: params.href ?? null,
    action_label: params.actionLabel ?? null,
    action_href: params.actionHref ?? null,
    dedupe_key: params.dedupeKey ?? null,
    metadata: params.metadata ?? {},
  };

  if (params.dedupeKey && params.dedupeKey.length > 0) {
    const { data: existing, error: existingError } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", params.userId)
      .eq("channel", params.channel)
      .eq("dedupe_key", params.dedupeKey)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    const query = existing
      ? supabase
          .from("notifications")
          .update({
            ...payload,
            dismissed_at: null,
            read_at: null,
          })
          .eq("id", existing.id)
      : supabase.from("notifications").insert(payload);

    const { data, error } = await query
      .select(
        "id, user_id, category, channel, kind, title, body, href, action_label, action_href, read_at, dismissed_at, dedupe_key, metadata, created_at",
      )
      .single();

    if (error) {
      throw error;
    }

    return mapNotification(data as NotificationRow);
  }

  const { data, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select(
      "id, user_id, category, channel, kind, title, body, href, action_label, action_href, read_at, dismissed_at, dedupe_key, metadata, created_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapNotification(data as NotificationRow);
}

export async function listNotifications(
  supabase: SupabaseClient,
  params: { userId: string; limit?: number },
) {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, user_id, category, channel, kind, title, body, href, action_label, action_href, read_at, dismissed_at, dedupe_key, metadata, created_at",
    )
    .eq("user_id", params.userId)
    .eq("channel", "in_app")
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 25);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapNotification(row as NotificationRow));
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  params: { userId: string; notificationId: string },
) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", params.notificationId)
    .eq("user_id", params.userId)
    .is("read_at", null)
    .select(
      "id, user_id, category, channel, kind, title, body, href, action_label, action_href, read_at, dismissed_at, dedupe_key, metadata, created_at",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapNotification(data as NotificationRow) : null;
}

export async function dismissNotification(
  supabase: SupabaseClient,
  params: { userId: string; notificationId: string },
) {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .update({ dismissed_at: timestamp, read_at: timestamp })
    .eq("id", params.notificationId)
    .eq("user_id", params.userId)
    .select(
      "id, user_id, category, channel, kind, title, body, href, action_label, action_href, read_at, dismissed_at, dedupe_key, metadata, created_at",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapNotification(data as NotificationRow) : null;
}

export async function dismissAllNotifications(
  supabase: SupabaseClient,
  params: { userId: string },
) {
  const timestamp = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: timestamp, read_at: timestamp })
    .eq("user_id", params.userId)
    .eq("channel", "in_app")
    .is("dismissed_at", null);

  if (error) {
    throw error;
  }
}

export async function dismissNotificationByDedupeKey(
  supabase: SupabaseClient,
  params: { userId: string; dedupeKey: string; channel?: NotificationRecord["channel"] },
) {
  const timestamp = new Date().toISOString();
  let query = supabase
    .from("notifications")
    .update({ dismissed_at: timestamp, read_at: timestamp })
    .eq("user_id", params.userId)
    .eq("dedupe_key", params.dedupeKey);

  if (params.channel) {
    query = query.eq("channel", params.channel);
  }

  const { error } = await query.is("dismissed_at", null);

  if (error) {
    throw error;
  }
}
