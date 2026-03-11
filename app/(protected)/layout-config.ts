import type { LucideIcon } from "lucide-react";
import {
  LifeBuoyIcon,
  SendIcon,
  Footprints,
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
    name: "Runs",
    href: "/runs",
    icon: Footprints,
  },
];

export const protectedRouteTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/runs": "Runs",
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

  return segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;

    return {
      href,
      title:
        protectedRouteTitles[href] ??
        (index > 0 && protectedRouteTitles[`/${segments[index - 1]}`] === "Runs"
          ? segment
          : formatSegment(segment)),
    };
  });
}
