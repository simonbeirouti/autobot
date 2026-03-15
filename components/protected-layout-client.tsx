"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { RouteBreadcrumb } from "@/app/(protected)/route-breadcrumb";
import { AppSidebar } from "@/components/app-sidebar";
import { useProject } from "@/components/providers/project-provider";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { PROJECT_ONBOARDING_ROUTE } from "@/lib/routes";

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
  const shouldRedirectToOnboarding = !isLoading && projects.length === 0 && isDashboardRoute;

  useEffect(() => {
    if (!shouldRedirectToOnboarding) {
      return;
    }

    router.replace(PROJECT_ONBOARDING_ROUTE);
  }, [router, shouldRedirectToOnboarding]);

  if (isProjectOnboardingRoute) {
    return (
      <Suspense fallback={<div className="min-h-svh flex-1 bg-background" />}>
        {children}
      </Suspense>
    );
  }

  if (shouldRedirectToOnboarding) {
    return <div className="min-h-svh flex-1 bg-background" />;
  }

  if (isDashboardRoute && isLoading) {
    return <div className="min-h-svh flex-1 bg-background" />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <Suspense fallback={null}>
              <RouteBreadcrumb />
            </Suspense>
          </div>
        </header>
        <Suspense fallback={<div className="min-h-0 flex-1 bg-background" />}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}
