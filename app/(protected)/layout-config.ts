import type { LucideIcon } from "lucide-react";
import {
  LifeBuoyIcon,
  SendIcon,
  FileTextIcon,
  Footprints,
  FolderKanbanIcon,
  TerminalSquareIcon,
} from "lucide-react";

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
  // {
  //   title: "Models",
  //   href: "#",
  //   icon: BotIcon,
  //   items: [
  //     {
  //       title: "Genesis",
  //       href: "#",
  //     },
  //     {
  //       title: "Explorer",
  //       href: "#",
  //     },
  //     {
  //       title: "Quantum",
  //       href: "#",
  //     },
  //   ],
  // },
  // {
  //   title: "Documentation",
  //   href: "#",
  //   icon: BookOpenIcon,
  //   items: [
  //     {
  //       title: "Introduction",
  //       href: "#",
  //     },
  //     {
  //       title: "Get Started",
  //       href: "#",
  //     },
  //     {
  //       title: "Tutorials",
  //       href: "#",
  //     },
  //     {
  //       title: "Changelog",
  //       href: "#",
  //     },
  //   ],
  // },
  // {
  //   title: "Settings",
  //   href: "#",
  //   icon: Settings2Icon,
  //   items: [
  //     {
  //       title: "General",
  //       href: "#",
  //     },
  //     {
  //       title: "Team",
  //       href: "#",
  //     },
  //     {
  //       title: "Billing",
  //       href: "#",
  //     },
  //     {
  //       title: "Limits",
  //       href: "#",
  //     },
  //   ],
  // },
];

export const protectedNavSecondary: SidebarNavItem[] = [
  {
    title: "Support",
    href: "#",
    icon: LifeBuoyIcon,
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
    name: "Projects",
    href: "/dashboard/projects",
    icon: FolderKanbanIcon,
  },
  {
    name: "Runs",
    href: "/dashboard/runs",
    icon: Footprints,
  },
];

export const protectedRouteTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/drafts": "Drafts",
  "/dashboard/projects": "Projects",
  "/dashboard/runs": "Runs",
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
  const dashboardCrumb = {
    href: "/dashboard",
    title: protectedRouteTitles["/dashboard"],
  };

  if (segments.length === 0 || pathname === "/dashboard") {
    return [dashboardCrumb];
  }

  const breadcrumbs = [dashboardCrumb];

  for (let index = 0; index < segments.length; index += 1) {
    const href = `/${segments.slice(0, index + 1).join("/")}`;

    if (href === dashboardCrumb.href) {
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
