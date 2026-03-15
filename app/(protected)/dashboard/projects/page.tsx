import { PageShell } from "@/components/page-shell";
import { ProjectsDashboardClient } from "@/components/projects-dashboard-client";

export default function ProjectsPage() {
  return (
    <PageShell
      contentClassName="h-full max-w-none"
      scrollable={false}
      scrollableClassName="overflow-y-auto xl:overflow-hidden"
    >
      <ProjectsDashboardClient />
    </PageShell>
  );
}
