import { PageShell } from "@/components/page-shell";
import { ProjectsOverviewClient } from "@/components/projects-overview-client";

export default function ProjectsPage() {
  return (
    <PageShell contentClassName="max-w-none">
      <ProjectsOverviewClient />
    </PageShell>
  );
}
