"use client";

import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";

import { FeedbackDialog } from "@/components/feedback-dialog";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavSecondary({
  items,
  activeHref,
  onItemClick,
  ...props
}: {
  items: {
    action?: "feedback-dialog";
    icon: LucideIcon;
    href: string;
    title: string;
  }[];
  activeHref?: string | null;
  onItemClick?: (href: string) => void;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.title}>
                {item.action === "feedback-dialog" ? (
                  <SidebarMenuButton
                    onClick={() => setIsFeedbackDialogOpen(true)}
                    size="sm"
                    type="button"
                  >
                    <Icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    isActive={activeHref === item.href}
                  >
                    <Link href={item.href} onClick={() => onItemClick?.(item.href)}>
                      <Icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
      <FeedbackDialog
        onOpenChange={setIsFeedbackDialogOpen}
        open={isFeedbackDialogOpen}
      />
    </SidebarGroup>
  );
}
