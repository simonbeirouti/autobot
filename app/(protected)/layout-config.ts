import type { LucideIcon } from "lucide-react";
import {
  LifeBuoyIcon,
  SendIcon,
  FileTextIcon,
  Footprints,
  FolderKanbanIcon,
  Rows3Icon,
  TerminalSquareIcon,
  WrenchIcon,
} from "lucide-react";

import { PROJECTS_ROUTE } from "@/lib/routes";

export type SidebarNavItem = {
  icon: LucideIcon;
  isActive?: boolean;
  items?: {
    href: string;
    title: string;
  }[];
  href: string;
  title: string;
};

export type SidebarProjectItem = {
  icon: LucideIcon;
  href: string;
  name: string;
};

export const protectedNavMain: SidebarNavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: TerminalSquareIcon,
    isActive: true,
    // items: [
    //   {
    //     title: "Dashboard",
    //     href: "/dashboard",
    //   },
    //   {
    //     title: "Objective",
    //     href: "/protected",
    //   },
    // ],
  },
];

export const protectedNavSecondary: SidebarNavItem[] = [
  {
    title: "Projects",
    href: PROJECTS_ROUTE,
    icon: Rows3Icon,
  },
  {
    title: "Feedback",
    href: "#",
    icon: SendIcon,
  },
];

export const protectedProjects: SidebarProjectItem[] = [
  {
    name: "Drafts",
    href: "/dashboard/drafts",
    icon: FileTextIcon,
  },
  {
    name: "Chat",
    href: "/dashboard/chats",
    icon: FolderKanbanIcon,
  },
  {
    name: "Runs",
    href: "/dashboard/runs",
    icon: Footprints,
  },
  {
    name: "Tools",
    href: "/dashboard/tools",
    icon: WrenchIcon,
  },
];

export const protectedRouteTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/drafts": "Drafts",
  "/dashboard/chats": "Chat",
  "/dashboard/runs": "Runs",
  "/dashboard/tools": "Tools",
  "/projects": "Projects",
  "/projects/new": "New Project",
};

function formatSegment(segment: string) {
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getProtectedBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [];
  }

  const rootHref = `/${segments[0]}`;
  const rootCrumb = {
    href: rootHref,
    title: protectedRouteTitles[rootHref] ?? formatSegment(segments[0]),
  };

  if (segments.length === 1) {
    return [rootCrumb];
  }

  const breadcrumbs = [rootCrumb];

  for (let index = 0; index < segments.length; index += 1) {
    const href = `/${segments.slice(0, index + 1).join("/")}`;

    if (href === rootCrumb.href) {
      continue;
    }

    const parentHref = `/${segments.slice(0, index).join("/")}`;
    breadcrumbs.push({
      href,
      title:
        protectedRouteTitles[href] ??
        (protectedRouteTitles[parentHref] === "Runs" ? segments[index] : formatSegment(segments[index])),
    });
  }

  return breadcrumbs;
}
