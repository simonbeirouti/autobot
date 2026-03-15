"use client";

import { startTransition, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ObjectiveIntake } from "@/components/objective-intake";
import { useProject } from "@/components/providers/project-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dashboardQueryKeys, fetchJson, upsertProjectInList } from "@/lib/query/dashboard";
import type { Project } from "@/lib/projects/types";

export function DashboardHomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { activeProject, isLoading, projects, setActiveProjectId } = useProject();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const isProjectOnboarding = searchParams.get("createProject") === "1" || projects.length === 0;

  const createProjectMutation = useMutation({
    mutationFn: async () =>
      fetchJson<Project>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      }),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[] | undefined>(
        dashboardQueryKeys.projects.all,
        (current) => upsertProjectInList(current, project),
      );
      setActiveProjectId(project.id);
      setName("");
      setDescription("");
      startTransition(() => {
        router.replace("/dashboard");
      });
    },
  });

  if (isLoading) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Loading project workspace...</div>;
  }

  if (isProjectOnboarding) {
    const canCreate = name.trim().length >= 5 && name.trim().length <= 10 && description.trim().length >= 8;

    return (
      <section className="flex min-h-full items-center justify-center py-10">
        <Card className="w-full max-w-3xl border-none shadow-none">
          <CardHeader className="space-y-4 text-center">
            <Badge variant="outline" className="mx-auto">Project onboarding</Badge>
            <CardTitle className="text-4xl tracking-tight">Create your first project</CardTitle>
            <CardDescription className="mx-auto max-w-2xl text-base leading-7">
              Projects are the top-level containers for objectives, assets, and chats. Once this is created, you will move directly into the first objective flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            <Input
              maxLength={10}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name (5-10 characters)"
              value={name}
            />
            <Textarea
              className="min-h-40"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what this project container is for..."
              value={description}
            />
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Icon placeholder will fall back to the first letter of the project name.
              </p>
              <div className="flex items-center gap-3">
                {projects.length > 0 ? (
                  <Button
                    onClick={() => router.replace("/dashboard")}
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  disabled={!canCreate || createProjectMutation.isPending}
                  onClick={() => createProjectMutation.mutate()}
                >
                  {createProjectMutation.isPending ? "Creating..." : "Create project"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!activeProject) {
    return <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">Select a project to continue.</div>;
  }

  return <ObjectiveIntake projectId={activeProject.id} projectName={activeProject.name} />;
}
