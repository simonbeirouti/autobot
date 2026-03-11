"use client";

import Link from "next/link";
import { TerminalIcon } from "lucide-react";

import {
  protectedNavMain,
  protectedNavSecondary,
  protectedProjects,
} from "@/app/(protected)/layout-config";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <TerminalIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">AutoBot</span>
                  <span className="truncate text-xs">Workspace</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={protectedNavMain} />
        <NavProjects projects={protectedProjects} />
        <NavSecondary items={protectedNavSecondary} className="mt-auto" />
      </SidebarContent>
      {user ? (
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}
