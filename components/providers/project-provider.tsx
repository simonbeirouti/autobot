"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import { dashboardQueryKeys, dashboardQueryTimings, fetchJson } from "@/lib/query/dashboard";
import type { Project } from "@/lib/projects/types";

const ACTIVE_PROJECT_STORAGE_KEY = "autobot-active-project-id";
const ACTIVE_PROJECT_SNAPSHOT_STORAGE_KEY = "autobot-active-project-snapshot";

type ProjectDisplay = Pick<Project, "description" | "iconKey" | "id" | "name">;

type ProjectContextValue = {
  activeProject: Project | null;
  activeProjectDisplay: ProjectDisplay | null;
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

function toProjectDisplay(project: Project | null | undefined): ProjectDisplay | null {
  if (!project) {
    return null;
  }

  return {
    description: project.description,
    iconKey: project.iconKey,
    id: project.id,
    name: project.name,
  };
}

function readStoredProjectSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(ACTIVE_PROJECT_SNAPSHOT_STORAGE_KEY);
    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value) as Partial<ProjectDisplay>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.description !== "string" ||
      typeof parsed.iconKey !== "string"
    ) {
      return null;
    }

    return {
      description: parsed.description,
      iconKey: parsed.iconKey,
      id: parsed.id,
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

function writeStoredProjectSnapshot(project: ProjectDisplay | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!project) {
    window.localStorage.removeItem(ACTIVE_PROJECT_SNAPSHOT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_PROJECT_SNAPSHOT_STORAGE_KEY, JSON.stringify(project));
}

export function ProjectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading: isAuthLoading, user } = useAuth();
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [activeProjectSnapshot, setActiveProjectSnapshot] = useState<ProjectDisplay | null>(null);
  const [hasHydratedStoredProject, setHasHydratedStoredProject] = useState(false);

  const projectsQuery = useQuery({
    queryKey: dashboardQueryKeys.projects.all,
    queryFn: () => fetchJson<Project[]>("/api/projects"),
    enabled: Boolean(user?.id),
    refetchOnMount: "always",
    staleTime: dashboardQueryTimings.projects.staleTime,
  });

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const isProjectStateLoading =
    isAuthLoading ||
    isRestoring ||
    !hasHydratedStoredProject ||
    (Boolean(user?.id) && !projectsQuery.isFetchedAfterMount);
  const activeProject =
    (activeProjectId ? projects.find((project) => project.id === activeProjectId) : null) ?? null;
  const activeProjectDisplay =
    toProjectDisplay(activeProject) ??
    (activeProjectSnapshot?.id === activeProjectId ? activeProjectSnapshot : null);

  if (
    projectsQuery.error &&
    !projectsQuery.isLoading &&
    !projectsQuery.isFetching &&
    !projectsQuery.data
  ) {
    throw projectsQuery.error;
  }

  useEffect(() => {
    setActiveProjectIdState(readStoredProjectId());
    setActiveProjectSnapshot(readStoredProjectSnapshot());
    setHasHydratedStoredProject(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasHydratedStoredProject) {
      return;
    }

    if (!user?.id) {
      window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
      writeStoredProjectSnapshot(null);
      setActiveProjectIdState(null);
      setActiveProjectSnapshot(null);
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.projects.all });
      return;
    }

    if (isProjectStateLoading) {
      return;
    }

    if (!projects.length) {
      setActiveProjectIdState(null);
      setActiveProjectSnapshot(null);
      window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
      writeStoredProjectSnapshot(null);
      return;
    }

    const hasStored = activeProjectId && projects.some((project) => project.id === activeProjectId);
    const nextProjectId = hasStored ? activeProjectId : projects[0]?.id ?? null;
    setActiveProjectIdState(nextProjectId);

    if (nextProjectId) {
      window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, nextProjectId);
      const nextProject = projects.find((project) => project.id === nextProjectId) ?? null;
      const nextSnapshot = toProjectDisplay(nextProject);
      setActiveProjectSnapshot(nextSnapshot);
      writeStoredProjectSnapshot(nextSnapshot);
    } else {
      setActiveProjectSnapshot(null);
      writeStoredProjectSnapshot(null);
    }
  }, [activeProjectId, hasHydratedStoredProject, isProjectStateLoading, projects, queryClient, user?.id]);

  const value = useMemo<ProjectContextValue>(() => {
    return {
      activeProject,
      activeProjectDisplay,
      activeProjectId: activeProject?.id ?? activeProjectId ?? null,
      isLoading: isProjectStateLoading,
      projects,
      setActiveProjectId(projectId) {
        setActiveProjectIdState(projectId);
        const nextSnapshot =
          toProjectDisplay(projects.find((project) => project.id === projectId) ?? null) ??
          (projectId === activeProjectSnapshot?.id ? activeProjectSnapshot : null);
        setActiveProjectSnapshot(nextSnapshot);
        if (typeof window !== "undefined") {
          if (projectId) {
            window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId);
            writeStoredProjectSnapshot(nextSnapshot);
          } else {
            window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
            writeStoredProjectSnapshot(null);
          }
        }
      },
    };
  }, [
    activeProject,
    activeProjectDisplay,
    activeProjectId,
    activeProjectSnapshot,
    isProjectStateLoading,
    projects,
  ]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within ProjectProvider");
  }

  return context;
}
