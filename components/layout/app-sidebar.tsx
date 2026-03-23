"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  protectedNavMain,
  protectedNavSecondary,
  protectedProjects,
  type SidebarNavItem,
  type SidebarProjectItem,
} from "@/app/(protected)/layout-config";
import { NavMain } from "@/components/layout/nav-main";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { NavSecondary } from "@/components/layout/nav-secondary";
import { NavUser } from "@/components/layout/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader
} from "@/components/ui/sidebar";

const SIDEBAR_ACTIVE_ITEM_COOKIE_NAME = "sidebar_active_item";
const SIDEBAR_ACTIVE_ITEM_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
}

function matchesHref(pathname: string, href: string) {
  if (!href || href === "#") {
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function findMatchingHref(
  pathname: string,
  mainItems: SidebarNavItem[],
  projectItems: SidebarProjectItem[],
  secondaryItems: SidebarNavItem[]
) {
  for (const item of mainItems) {
    if (matchesHref(pathname, item.href)) {
      return item.href;
    }

    const subItemMatch = item.items?.find((subItem) => matchesHref(pathname, subItem.href));
    if (subItemMatch) {
      return subItemMatch.href;
    }
  }

  const projectMatch = projectItems.find((item) => matchesHref(pathname, item.href));
  if (projectMatch) {
    return projectMatch.href;
  }

  const secondaryMatch = secondaryItems.find((item) => matchesHref(pathname, item.href));
  return secondaryMatch?.href ?? null;
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [lastClickedHref, setLastClickedHref] = React.useState<string | null>(null);
  const primaryItems = React.useMemo<SidebarNavItem[]>(
    () => [
      ...protectedNavMain,
      ...protectedProjects.map((item) => ({
        href: item.href,
        icon: item.icon,
        title: item.name,
      })),
    ],
    [],
  );

  React.useEffect(() => {
    setLastClickedHref(readCookie(SIDEBAR_ACTIVE_ITEM_COOKIE_NAME));
  }, []);

  const activeHref = React.useMemo(
    () =>
      findMatchingHref(
        pathname,
        protectedNavMain,
        protectedProjects,
        protectedNavSecondary
      ) ?? lastClickedHref,
    [lastClickedHref, pathname]
  );

  const handleItemClick = React.useCallback((href: string) => {
    setLastClickedHref(href);
    document.cookie = `${SIDEBAR_ACTIVE_ITEM_COOKIE_NAME}=${encodeURIComponent(href)}; path=/; max-age=${SIDEBAR_ACTIVE_ITEM_COOKIE_MAX_AGE}`;
  }, []);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="space-y-2">
          <ProjectSwitcher />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={primaryItems}
          activeHref={activeHref}
          onItemClick={handleItemClick}
        />
        <NavSecondary
          items={protectedNavSecondary}
          activeHref={activeHref}
          onItemClick={handleItemClick}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
