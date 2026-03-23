"use client";

import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { SendIcon } from "lucide-react";

import { RouteBreadcrumb } from "@/app/(protected)/route-breadcrumb";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { FeedbackDialog } from "@/components/dashboard/feedback-dialog";
import { NotificationInbox } from "@/components/dashboard/notification-inbox";
import { useProject } from "@/components/providers/project-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PROJECT_ONBOARDING_ROUTE } from "@/lib/routes";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeSwitcher } from "./theme-switcher";

export function ProtectedLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isLoading } = useProject();
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isProjectOnboardingRoute = pathname === PROJECT_ONBOARDING_ROUTE;

  if (isProjectOnboardingRoute) {
    return (
      <Suspense fallback={<div className="min-h-svh flex-1 bg-background" />}>
        {children}
      </Suspense>
    );
  }

  if (isDashboardRoute && isLoading) {
    return <div className="min-h-svh flex-1 bg-background" />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <div className="min-w-0">
              <Suspense fallback={null}>
                <RouteBreadcrumb />
              </Suspense>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationInbox />
            <Button
              onClick={() => setIsFeedbackDialogOpen(true)}
              size="icon"
              variant="outline"
            >
              <SendIcon className="size-4" />
            </Button>
            <ThemeSwitcher />
          </div>
        </header>
        <Suspense fallback={<div className="min-h-0 flex-1 bg-background" />}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </Suspense>
        <FeedbackDialog
          onOpenChange={setIsFeedbackDialogOpen}
          open={isFeedbackDialogOpen}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
