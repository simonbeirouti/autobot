"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ObjectiveIntake } from "@/components/objective-intake";
import { useProject } from "@/components/providers/project-provider";
import { PROJECT_ONBOARDING_ROUTE } from "@/lib/routes";

export function DashboardHomeClient() {
  const router = useRouter();
  const { activeProject, isLoading, projects } = useProject();

  useEffect(() => {
    if (!isLoading && projects.length === 0) {
      router.replace(PROJECT_ONBOARDING_ROUTE);
    }
  }, [isLoading, projects.length, router]);

  if (isLoading) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Loading project workspace...</div>;
  }

  if (projects.length === 0) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Redirecting to project setup...</div>;
  }

  if (!activeProject) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Select a project to continue.</div>;
  }

  return <ObjectiveIntake projectId={activeProject.id} projectName={activeProject.name} />;
}
