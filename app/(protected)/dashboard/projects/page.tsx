import { PageShell } from "@/components/layout/page-shell";
import { ProjectsOverviewClient } from "@/components/dashboard/projects-overview-client";

export default function ProjectsPage() {
  return (
    <PageShell contentClassName="max-w-none">
      <ProjectsOverviewClient />
    </PageShell>
  );
}
