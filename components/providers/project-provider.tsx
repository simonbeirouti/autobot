"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import { dashboardQueryKeys, dashboardQueryTimings, fetchJson } from "@/lib/query/dashboard";
import type { Project } from "@/lib/projects/types";

const ACTIVE_PROJECT_STORAGE_KEY = "autobot-active-project-id";

type ProjectContextValue = {
  activeProject: Project | null;
  activeProjectId: string | null;
  isLoading: boolean;
  projects: Project[];
  setActiveProjectId: (projectId: string | null) => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

function readStoredProjectId() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
}

export function ProjectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading: isAuthLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(readStoredProjectId);

  const projectsQuery = useQuery({
    queryKey: dashboardQueryKeys.projects.all,
    queryFn: () => fetchJson<Project[]>("/api/projects"),
    enabled: Boolean(user?.id),
    staleTime: dashboardQueryTimings.projects.staleTime,
  });

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!user?.id) {
      window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
      setActiveProjectIdState(null);
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.projects.all });
      return;
    }

    if (!projects.length) {
      setActiveProjectIdState(null);
      window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
      return;
    }

    const hasStored = activeProjectId && projects.some((project) => project.id === activeProjectId);
    const nextProjectId = hasStored ? activeProjectId : projects[0]?.id ?? null;
    setActiveProjectIdState(nextProjectId);

    if (nextProjectId) {
      window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, nextProjectId);
    }
  }, [activeProjectId, projects, queryClient, user?.id]);

  const value = useMemo<ProjectContextValue>(() => {
    const activeProject =
      (activeProjectId
        ? projects.find((project) => project.id === activeProjectId)
        : null) ?? null;

    return {
      activeProject,
      activeProjectId: activeProject?.id ?? activeProjectId ?? null,
      isLoading: isAuthLoading || projectsQuery.isLoading,
      projects,
      setActiveProjectId(projectId) {
        setActiveProjectIdState(projectId);
        if (typeof window !== "undefined") {
          if (projectId) {
            window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId);
          } else {
            window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
          }
        }
      },
    };
  }, [activeProjectId, isAuthLoading, projects, projectsQuery.isLoading]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within ProjectProvider");
  }

  return context;
}
