"use client";

import { buildAuthHref } from "@/components/auth/auth-route";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type LogoutButtonProps = {
  className?: string;
  onLogout?: () => void;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
};

export function LogoutButton({
  className,
  onLogout,
  variant = "default",
}: LogoutButtonProps) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    onLogout?.();
    router.push(buildAuthHref("login"));
    router.refresh();
  };

  return (
    <Button className={cn(className)} onClick={logout} variant={variant}>
      Logout
    </Button>
  );
}
