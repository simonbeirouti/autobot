import { RouteStateCard } from "@/components/dashboard/route-state-card";

export default function NotFound() {
  return (
    <RouteStateCard
      title="Page not found"
      description="The page you were looking for does not exist or has already moved."
      primaryAction={{ href: "/", label: "Go home" }}
    />
  );
}
