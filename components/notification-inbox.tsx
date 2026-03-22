"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, CheckIcon, ChevronRightIcon, InboxIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useDismissAllNotificationsMutation,
  useDismissNotificationMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from "@/lib/query/notifications";
import { cn } from "@/lib/utils";

export function NotificationInbox() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const notificationsQuery = useNotificationsQuery();
  const markReadMutation = useMarkNotificationReadMutation();
  const dismissMutation = useDismissNotificationMutation({
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to dismiss notification.",
      );
    },
  });
  const dismissAllMutation = useDismissAllNotificationsMutation({
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to dismiss notifications.",
      );
    },
    onSuccess: () => {
      toast.success("Notifications dismissed.");
    },
  });

  const notifications = useMemo(
    () => notificationsQuery.data ?? [],
    [notificationsQuery.data],
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isRead),
    [notifications],
  );
  const unreadCount = unreadNotifications.length;

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen);

    if (nextOpen) {
      unreadNotifications.forEach((notification) => {
        markReadMutation.mutate(notification.id);
      });
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button aria-label="Notifications" size="icon" type="button" variant="outline" className="relative">
          <BellIcon className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-black">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(92vw,26rem)] border-border/70 p-0"
        sideOffset={10}
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              Run updates and action-required items land here.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={notifications.length === 0 || dismissAllMutation.isPending}
            onClick={() => dismissAllMutation.mutate()}
          >
            Dismiss all
          </Button>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-dashed border-border/70 bg-muted/40">
              <InboxIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Your inbox is clear</p>
              <p className="text-sm text-muted-foreground">
                New run notifications and prompts will appear here.
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[28rem]">
            <div className="space-y-2 p-3">
              {notifications.map((notification) => {
                const destination =
                  notification.actionTarget?.href ?? notification.actionHref ?? notification.href;
                const actionLabel = notification.actionLabel ?? "Open";

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "space-y-3 border border-border/70 bg-background/95 p-3",
                      !notification.isRead && "border-amber-500/40 bg-amber-500/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {!notification.isRead ? (
                            <span className="inline-flex rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-black">
                              New
                            </span>
                          ) : null}
                          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {notification.category === "platform_updates"
                              ? "Platform update"
                              : "Marketing"}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{notification.title}</p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {notification.body}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => dismissMutation.mutate(notification.id)}
                        aria-label={`Dismiss ${notification.title}`}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {destination ? (
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => {
                            dismissMutation.mutate(notification.id);
                            setIsOpen(false);
                            startTransition(() => {
                              router.push(destination);
                            });
                          }}
                        >
                          {actionLabel}
                          <ChevronRightIcon className="size-3.5" />
                        </Button>
                      ) : null}
                      {notification.isRead ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckIcon className="size-3.5" />
                          Read
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
