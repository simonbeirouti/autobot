"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronsUpDown,
  FolderKanbanIcon,
  PlusIcon,
} from "lucide-react";

import { useProject } from "@/components/providers/project-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DASHBOARD_HOME_ROUTE,
  PROJECT_ONBOARDING_ROUTE,
  getProjectSwitcherDestination,
} from "@/lib/routes";

export function ProjectSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const { activeProject, projects, setActiveProjectId } = useProject();

  const switchDestination = getProjectSwitcherDestination(pathname);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {activeProject ? (
                  <span className="text-sm font-semibold">{activeProject.iconKey}</span>
                ) : (
                  <FolderKanbanIcon className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeProject?.name ?? "Select project"}
                </span>
                <span className="truncate text-xs">
                  {activeProject?.description || "Project container"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Projects
            </DropdownMenuLabel>
            {projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => {
                  setActiveProjectId(project.id);
                  router.push(switchDestination || DASHBOARD_HOME_ROUTE);
                }}
                className="gap-3 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border text-xs font-semibold">
                  {project.iconKey}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{project.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {project.description}
                  </div>
                </div>
                {activeProject?.id === project.id ? <CheckIcon className="size-4" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => router.push(PROJECT_ONBOARDING_ROUTE)}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <PlusIcon className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">New project</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
