"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import { useProject } from "@/components/providers/project-provider";
import { DASHBOARD_HOME_ROUTE } from "@/lib/routes";
import {
  dashboardQueryKeys,
  dashboardQueryTimings,
  fetchJson,
  filterProjectsByStatus,
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
      queryClient.setQueryData<Project[] | undefined>(
        dashboardQueryKeys.projects.management,
        (current) => upsertProjectInList(current, project),
      );
      setActiveProjectId(project.id);
      startTransition(() => {
        router.replace(DASHBOARD_HOME_ROUTE);
      });
    },
  });
}

type ProjectAction = "activate" | "archive" | "delete";

function updateProjectCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  project: Project,
) {
  queryClient.setQueryData<Project[] | undefined>(
    dashboardQueryKeys.projects.management,
    (current) => {
      const next = upsertProjectInList(current, project);
      return filterProjectsByStatus(next, ["active", "archived"]);
    },
  );

  queryClient.setQueryData<Project[] | undefined>(
    dashboardQueryKeys.projects.all,
    (current) => {
      const next = upsertProjectInList(current, project);
      return filterProjectsByStatus(next, ["active"]);
    },
  );
}

export function useManageProjectsQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: dashboardQueryKeys.projects.management,
    queryFn: () => fetchJson<Project[]>("/api/projects?includeArchived=true"),
    enabled: Boolean(user?.id),
    staleTime: dashboardQueryTimings.projects.staleTime,
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  const { activeProjectId, setActiveProjectId } = useProject();

  return useMutation({
    mutationFn: async ({
      action,
      projectId,
    }: {
      action: ProjectAction;
      projectId: string;
    }) =>
      fetchJson<Project>(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }),
    onSuccess: (project, variables) => {
      updateProjectCaches(queryClient, project);

      const activeProjects =
        queryClient.getQueryData<Project[]>(dashboardQueryKeys.projects.all) ?? [];

      if (variables.action === "activate") {
        setActiveProjectId(project.id);
      } else if (activeProjectId === project.id) {
        setActiveProjectId(activeProjects[0]?.id ?? null);
      }
    },
  });
}
