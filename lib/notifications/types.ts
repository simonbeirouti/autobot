export const NOTIFICATION_CATEGORIES = ["marketing", "platform_updates"] as const;
export const NOTIFICATION_CHANNELS = ["email", "in_app"] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationPreferences = {
  userId: string;
  marketingEmail: boolean;
  platformUpdatesEmail: boolean;
  platformUpdatesInApp: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  actionLabel: string | null;
  actionHref: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  dedupeKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type NotificationListItem = NotificationRecord & {
  isRead: boolean;
};

export type NotificationPreferenceUpdate = Pick<
  NotificationPreferences,
  "marketingEmail" | "platformUpdatesEmail" | "platformUpdatesInApp"
>;

export type CreateNotificationRequest = {
  userId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  kind: string;
  title: string;
  body: string;
  href?: string | null;
  actionLabel?: string | null;
  actionHref?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type NotificationDeliveryRequest = {
  userId: string;
  category: NotificationCategory;
  kind: string;
  title: string;
  body: string;
  href?: string | null;
  actionLabel?: string | null;
  actionHref?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
  recipientEmail?: string | null;
  recipientName?: string | null;
};
