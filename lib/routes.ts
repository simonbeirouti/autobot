export const DASHBOARD_HOME_ROUTE = "/dashboard";
export const PROJECT_ONBOARDING_ROUTE = "/projects/new";

export function getProjectSwitcherDestination(pathname: string | null) {
  if (pathname?.startsWith("/dashboard")) {
    return pathname;
  }

  return DASHBOARD_HOME_ROUTE;
}
