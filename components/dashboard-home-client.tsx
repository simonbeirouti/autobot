"use client";

import { ObjectiveIntake } from "@/components/objective-intake";
import { useProject } from "@/components/providers/project-provider";

export function DashboardHomeClient() {
  const { activeProject, isLoading, projects } = useProject();

  if (isLoading) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Loading project workspace...</div>;
  }

  if (projects.length === 0) {
    return null;
  }

  if (!activeProject) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Select a project to continue.</div>;
  }

  return <ObjectiveIntake projectId={activeProject.id} projectName={activeProject.name} />;
}
