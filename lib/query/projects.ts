"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useProject } from "@/components/providers/project-provider";
import { DASHBOARD_HOME_ROUTE } from "@/lib/routes";
import {
  dashboardQueryKeys,
  fetchJson,
  upsertProjectInList,
} from "@/lib/query/dashboard";
import type { Project, ProjectOnboardingRequest } from "@/lib/projects/types";

export const PROJECT_NAME_MIN_LENGTH = 5;
export const PROJECT_NAME_MAX_LENGTH = 10;
export const PROJECT_DESCRIPTION_MIN_LENGTH = 8;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 600;

export function isValidProjectName(value: string) {
  const trimmedValue = value.trim();
  return (
    trimmedValue.length >= PROJECT_NAME_MIN_LENGTH &&
    trimmedValue.length <= PROJECT_NAME_MAX_LENGTH
  );
}

export function isValidProjectDescription(value: string) {
  const trimmedValue = value.trim();
  return (
    trimmedValue.length >= PROJECT_DESCRIPTION_MIN_LENGTH &&
    trimmedValue.length <= PROJECT_DESCRIPTION_MAX_LENGTH
  );
}

export function useCreateProjectMutation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setActiveProjectId } = useProject();

  return useMutation({
    mutationFn: async (payload: ProjectOnboardingRequest) =>
      fetchJson<Project>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[] | undefined>(
        dashboardQueryKeys.projects.all,
        (current) => upsertProjectInList(current, project),
      );
      setActiveProjectId(project.id);
      startTransition(() => {
        router.replace(DASHBOARD_HOME_ROUTE);
      });
    },
  });
}
