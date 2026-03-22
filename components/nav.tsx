import Link from "next/link";

import { AuthButton } from "./auth/auth-button";
import { MobileNavMenu } from "./mobile-nav-menu";
import { PUBLIC_MARKETING_ROUTES } from "@/lib/routes";
import { getCurrentUser } from "@/lib/supabase/auth";

export default async function Nav() {
  const user = await getCurrentUser();

  return (
    <nav className="flex h-16 w-full justify-center">
      <div className="flex w-full items-center justify-between px-5 py-3 text-sm">
        <div className="flex items-center gap-5 font-semibold">
          <Link href="/">AutoBot</Link>
        </div>
        <div className="hidden items-center gap-6 md:flex">
          {PUBLIC_MARKETING_ROUTES.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {route.label}
            </Link>
          ))}
          <AuthButton />
        </div>
        <MobileNavMenu isAuthenticated={Boolean(user)} />
      </div>
    </nav>
  );
}
