"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { buildAuthHref } from "@/components/auth/auth-route";
import { createClient } from "@/lib/supabase/client";
export function NavUser() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);
    const supabase = createClient();

    await supabase.auth.signOut();
    router.push(buildAuthHref("login"));
    router.refresh();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/30 active:bg-destructive/10 border border-destructive"
          disabled={isPending}
          onClick={() => void handleLogout()}
          tooltip="Log out"
        >
          <LogOutIcon />
          <span>{isPending ? "Logging out..." : "Log out"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
