export const DASHBOARD_HOME_ROUTE = "/dashboard";
export const PROJECTS_ROUTE = "/dashboard/projects";
export const SETTINGS_ROUTE = "/dashboard/settings";
export const PROJECT_ONBOARDING_ROUTE = "/new";

export const PUBLIC_MARKETING_ROUTES = [
  {
    href: "/",
    label: "Home",
  },
  {
    href: "/about",
    label: "About",
  },
] as const;

export function getProjectSwitcherDestination(pathname: string | null) {
  if (pathname?.startsWith("/dashboard")) {
    return pathname;
  }

  return DASHBOARD_HOME_ROUTE;
}
