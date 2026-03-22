"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRightIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
  activeHref,
  onItemClick,
}: {
  items: {
    icon: LucideIcon;
    isActive?: boolean;
    items?: {
      href: string;
      title: string;
    }[];
    href: string;
    title: string;
  }[];
  activeHref?: string | null;
  onItemClick?: (href: string) => void;
}) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const Icon = item.icon;
          const isItemActive =
            activeHref === item.href || item.items?.some((subItem) => activeHref === subItem.href);

          return (
            <Collapsible key={item.title} asChild defaultOpen={isItemActive || item.isActive}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isItemActive}>
                  <Link href={item.href} onClick={() => onItemClick?.(item.href)}>
                    <Icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <ChevronRightIcon />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={activeHref === subItem.href}
                            >
                              <Link href={subItem.href} onClick={() => onItemClick?.(subItem.href)}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
