"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, FolderKanbanIcon } from "lucide-react";

import { useProject } from "@/components/providers/project-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_DESCRIPTION_MIN_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_NAME_MIN_LENGTH,
  isValidProjectDescription,
  isValidProjectName,
  useCreateProjectMutation,
} from "@/lib/query/projects";
import { DASHBOARD_HOME_ROUTE } from "@/lib/routes";
import { cn } from "@/lib/utils";

const onboardingSteps = [
  {
    id: "name",
    eyebrow: "Step 1",
    title: "Name your project",
    description: "Choose a short container name for the workstream you are setting up.",
  },
  {
    id: "details",
    eyebrow: "Step 2",
    title: "Describe what this project will hold",
    description: "Add enough context so the workspace starts with a clear purpose and scope.",
  },
] as const;

export function ProjectOnboardingScreen() {
  const { projects } = useProject();
  const createProjectMutation = useCreateProjectMutation();
  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const isExistingWorkspace = projects.length > 0;
  const isNameValid = isValidProjectName(name);
  const isDescriptionValid = isValidProjectDescription(description);
  const activeStep = onboardingSteps[currentStep];
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  function handleCreateProject() {
    createProjectMutation.mutate({
      name: trimmedName,
      description: trimmedDescription,
    });
  }

  return (
    <section className="relative flex min-h-svh flex-1 overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,209,102,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.1),transparent_32%)]" />
      <div className="relative grid flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,520px)]">
        <div className="flex min-h-svh flex-col justify-between border-b border-border/60 px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:px-14 lg:py-12">
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-3">
                <div className="flex size-11 items-center justify-center bg-amber-500 text-background shadow-[0_20px_60px_-28px_rgba(245,158,11,0.8)]">
                  <FolderKanbanIcon className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">AutoBot workspace setup</p>
                  <p className="text-sm text-muted-foreground">
                    {isExistingWorkspace
                      ? "Create another project container"
                      : "Create your first project"}
                  </p>
                </div>
              </div>
              {isExistingWorkspace ? (
                <Button asChild type="button" variant="ghost">
                  <Link href={DASHBOARD_HOME_ROUTE}>Cancel</Link>
                </Button>
              ) : null}
            </div>

            <div className="space-y-4">
              <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-[0.2em]">
                Project onboarding
              </Badge>
              <div className="space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  {activeStep.eyebrow}
                </p>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  {activeStep.title}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  {activeStep.description}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {onboardingSteps.map((step, index) => {
                const isComplete = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div
                    key={step.id}
                    className={cn(
                      "border px-5 py-4 transition-colors",
                      isCurrent
                        ? "border-foreground/30 bg-foreground/[0.03]"
                        : "border-border/70 bg-background/80",
                    )}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center border text-sm font-medium",
                          isComplete || isCurrent
                            ? "border-amber-500 bg-amber-500 text-background"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {isComplete ? <CheckIcon className="size-4" /> : index + 1}
                      </div>
                      <span className="text-sm font-medium">{step.title}</span>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 border border-border/70 bg-background/85 p-6 backdrop-blur-sm">
            <p className="text-sm font-medium">What happens next</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Once the project is created, AutoBot will select it as your active workspace and
              take you straight into the dashboard.
            </p>
          </div>
        </div>

        <div className="flex min-h-svh items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-xl border border-border/70 bg-background/95 p-6 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-sm sm:p-8">
            {currentStep === 0 ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="project-name">
                    Project name
                  </label>
                  <Input
                    id="project-name"
                    maxLength={PROJECT_NAME_MAX_LENGTH}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Apollo"
                    value={name}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Use {PROJECT_NAME_MIN_LENGTH}-{PROJECT_NAME_MAX_LENGTH} characters.
                    </span>
                    <span>{trimmedName.length}/{PROJECT_NAME_MAX_LENGTH}</span>
                  </div>
                </div>

                <div className="border border-dashed border-border/80 bg-muted/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Preview
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                      {trimmedName.charAt(0).toUpperCase() || "A"}
                    </div>
                    <div>
                      <p className="font-medium">{trimmedName || "Your project name"}</p>
                      <p className="text-sm text-muted-foreground">Icon falls back to the first letter.</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    disabled={!isNameValid}
                    onClick={() => setCurrentStep(1)}
                    type="button"
                  >
                    Continue
                    <ArrowRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border border-border/70 bg-muted/35 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Project summary
                  </p>
                  <p className="mt-2 text-lg font-medium">{trimmedName}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="project-description">
                    Project description
                  </label>
                  <Textarea
                    id="project-description"
                    className="min-h-40"
                    maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe what this project container is for..."
                    value={description}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Use {PROJECT_DESCRIPTION_MIN_LENGTH}-{PROJECT_DESCRIPTION_MAX_LENGTH} characters.
                    </span>
                    <span>{trimmedDescription.length}/{PROJECT_DESCRIPTION_MAX_LENGTH}</span>
                  </div>
                </div>

                {createProjectMutation.error instanceof Error ? (
                  <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {createProjectMutation.error.message}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                  <Button onClick={() => setCurrentStep(0)} type="button" variant="ghost">
                    <ArrowLeftIcon className="size-4" />
                    Back
                  </Button>
                  <Button
                    disabled={!isDescriptionValid || createProjectMutation.isPending}
                    onClick={handleCreateProject}
                    type="button"
                  >
                    {createProjectMutation.isPending ? "Creating..." : "Create project"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
