"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import {
  dashboardQueryKeys,
  dashboardQueryTimings,
  fetchJson,
} from "@/lib/query/dashboard";
import type {
  NotificationListItem,
  NotificationPreferenceUpdate,
  NotificationPreferences,
} from "@/lib/notifications/types";

type NotificationMutationCallbacks<TData> = {
  onError?: (error: unknown) => void;
  onSuccess?: (data: TData) => void;
};

export function useNotificationPreferencesQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: dashboardQueryKeys.notifications.preferences,
    queryFn: () => fetchJson<NotificationPreferences>("/api/settings/notifications"),
    enabled: Boolean(user?.id),
    staleTime: dashboardQueryTimings.notifications.staleTime,
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: NotificationPreferenceUpdate) =>
      fetchJson<NotificationPreferences>("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (preferences) => {
      queryClient.setQueryData(
        dashboardQueryKeys.notifications.preferences,
        preferences,
      );
    },
  });
}

export function useNotificationsQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: dashboardQueryKeys.notifications.all,
    queryFn: () => fetchJson<NotificationListItem[]>("/api/notifications"),
    enabled: Boolean(user?.id),
    staleTime: dashboardQueryTimings.notifications.staleTime,
    refetchInterval: 1000 * 30,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) =>
      fetchJson<NotificationListItem>(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      }),
    onSuccess: (notification) => {
      queryClient.setQueryData<NotificationListItem[] | undefined>(
        dashboardQueryKeys.notifications.all,
        (current) =>
          current?.map((item) => (item.id === notification.id ? notification : item)) ?? [],
      );
    },
  });
}

export function useDismissNotificationMutation(
  callbacks?: NotificationMutationCallbacks<NotificationListItem>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) =>
      fetchJson<NotificationListItem>(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      }),
    onSuccess: (notification) => {
      queryClient.setQueryData<NotificationListItem[] | undefined>(
        dashboardQueryKeys.notifications.all,
        (current) => current?.filter((item) => item.id !== notification.id) ?? [],
      );
      callbacks?.onSuccess?.(notification);
    },
    onError: callbacks?.onError,
  });
}

export function useDismissAllNotificationsMutation(
  callbacks?: NotificationMutationCallbacks<{ success: true }>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      fetchJson<{ success: true }>("/api/notifications/dismiss-all", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.setQueryData<NotificationListItem[]>(
        dashboardQueryKeys.notifications.all,
        [],
      );
      callbacks?.onSuccess?.({ success: true });
    },
    onError: callbacks?.onError,
  });
}
