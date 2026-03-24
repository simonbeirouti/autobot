import Link from "next/link";

import { AuthButton } from "../auth/auth-button";
import { MarketingContactLink } from "@/components/marketing/marketing-contact-sheet";
import { MobileNavMenu } from "./mobile-nav-menu";
import { PUBLIC_MARKETING_ROUTES } from "@/lib/routes";
import { getCurrentUser } from "@/lib/supabase/auth";

export default async function Nav() {
  const user = await getCurrentUser();

  return (
    <nav className="w-full px-4 pt-4 sm:px-6">
      <div className="relative mx-auto flex h-16 w-full items-center justify-between border border-border/70 bg-background/45 px-5 py-3 text-sm shadow-[0_20px_45px_-32px_rgba(15,23,42,0.35)] backdrop-blur-md supports-[backdrop-filter]:bg-background/25">
        <div className="flex items-center gap-5 font-semibold">
          <Link href="/">AutoBot</Link>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {PUBLIC_MARKETING_ROUTES.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className="mr-2 font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {route.label}
            </Link>
          ))}
          <MarketingContactLink variant="outline">
            Contact
          </MarketingContactLink>
          <AuthButton />
        </div>
        <MobileNavMenu isAuthenticated={Boolean(user)} />
      </div>
    </nav>
  );
}
