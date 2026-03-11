"use client";

import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontalIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const INITIAL_PROJECT_COUNT = 3;
const PROJECT_PAGE_SIZE = 7;

export function NavProjects({
  projects,
}: {
  projects: {
    icon: LucideIcon;
    href: string;
    name: string;
  }[];
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_PROJECT_COUNT);
  const visibleProjects = projects.slice(-visibleCount);
  const hasMoreProjects = visibleCount < projects.length;

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {visibleProjects.map((item) => {
          const Icon = item.icon;

          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild>
                <Link href={item.href}>
                  <Icon />
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
        {hasMoreProjects ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() =>
                setVisibleCount((currentCount) =>
                  Math.min(projects.length, currentCount + PROJECT_PAGE_SIZE),
                )
              }
            >
              <MoreHorizontalIcon />
              <span>More</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarGroup>
  );
}
