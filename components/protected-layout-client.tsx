"use client";

import { Suspense, useEffect } from "react";
import { BellIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { RouteBreadcrumb } from "@/app/(protected)/route-breadcrumb";
import { AppSidebar } from "@/components/app-sidebar";
import { useProject } from "@/components/providers/project-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PROJECT_ONBOARDING_ROUTE } from "@/lib/routes";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function ProtectedLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, projects } = useProject();

  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isProjectOnboardingRoute = pathname === PROJECT_ONBOARDING_ROUTE;
  const shouldRedirectToProjectOnboarding =
    !isLoading &&
    projects.length === 0 &&
    isDashboardRoute;

  useEffect(() => {
    if (!shouldRedirectToProjectOnboarding) {
      return;
    }

    router.replace(PROJECT_ONBOARDING_ROUTE);
  }, [router, shouldRedirectToProjectOnboarding]);

  if (isProjectOnboardingRoute) {
    return (
      <Suspense fallback={<div className="min-h-svh flex-1 bg-background" />}>
        {children}
      </Suspense>
    );
  }

  if (shouldRedirectToProjectOnboarding) {
    return <div className="min-h-svh flex-1 bg-background" />;
  }

  if (isDashboardRoute && isLoading) {
    return <div className="min-h-svh flex-1 bg-background" />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
            <Button aria-label="Notifications" size="icon" type="button" variant="outline">
              <BellIcon className="size-4" />
            </Button>
            <ThemeSwitcher />
          </div>
        </header>
        <Suspense fallback={<div className="min-h-0 flex-1 bg-background" />}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}
