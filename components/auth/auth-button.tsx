import Link from "next/link";
import { Button } from "../ui/button";
import { buildAuthHref } from "@/components/auth/auth-route";
import { getCurrentUser } from "@/lib/supabase/auth";
import { LogoutButton } from "./logout-button";
import { DASHBOARD_HOME_ROUTE } from "@/lib/routes";

export async function AuthButton() {
  const user = await getCurrentUser();

  return user ? (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline">
        <Link href={DASHBOARD_HOME_ROUTE}>Dashboard</Link>
      </Button>
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild variant="outline">
        <Link href={buildAuthHref("login")}>Sign in</Link>
      </Button>
      <Button asChild variant="default">
        <Link href={buildAuthHref("sign-up")}>Sign up</Link>
      </Button>
    </div>
  );
}
