"use client";

import { usePathname } from "next/navigation";

import { RouteStateCard } from "@/components/dashboard/route-state-card";
import { DASHBOARD_HOME_ROUTE } from "@/lib/routes";

function getProtectedFallbackHref(pathname: string) {
  if (!pathname.startsWith("/dashboard")) {
    return DASHBOARD_HOME_ROUTE;
  }

  const segments = pathname.split("/").filter(Boolean).slice(0, 2);
  return `/${segments.join("/")}`;
}

export default function ProtectedNotFound() {
  const pathname = usePathname();

  return (
    <RouteStateCard
      title="Workspace page not found"
      description="That dashboard view or record could not be found for your account."
      primaryAction={{ href: getProtectedFallbackHref(pathname), label: "Back to section" }}
    />
  );
}
