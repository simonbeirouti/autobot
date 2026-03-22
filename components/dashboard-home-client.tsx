"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ObjectiveIntake } from "@/components/objective-intake";
import { useProject } from "@/components/providers/project-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { PROJECT_ONBOARDING_ROUTE } from "@/lib/routes";

export function DashboardHomeSkeleton() {
  return (
    <section className="flex min-h-full flex-col justify-center py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center">
          <div className="flex w-full flex-col items-center space-y-3">
            <Skeleton className="h-10 w-full max-w-2xl sm:h-12" />
            <Skeleton className="h-4 w-full max-w-3xl" />
            <Skeleton className="h-4 w-5/6 max-w-2xl" />
          </div>

          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Skeleton className="h-12 flex-1" />
              <Skeleton className="h-12 w-full sm:w-32" />
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-10 w-64" />
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="grid gap-4 border bg-card p-4 md:grid-cols-[max-content_minmax(0,1fr)] md:items-start md:gap-8"
              key={index}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <Skeleton className="h-5 w-full max-w-xl" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DashboardHomeClient() {
  const router = useRouter();
  const { activeProject, isLoading, projects } = useProject();

  useEffect(() => {
    if (!isLoading && projects.length === 0) {
      router.replace(PROJECT_ONBOARDING_ROUTE);
    }
  }, [isLoading, projects.length, router]);

  if (isLoading) {
    return <DashboardHomeSkeleton />;
  }

  if (projects.length === 0) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Redirecting to project setup...</div>;
  }

  if (!activeProject) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Select a project to continue.</div>;
  }

  return <ObjectiveIntake projectId={activeProject.id} projectName={activeProject.name} />;
}
