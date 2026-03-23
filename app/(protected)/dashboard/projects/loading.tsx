import { PageShell } from "@/components/layout/page-shell";
import { ProjectsOverviewSkeleton } from "@/components/dashboard/projects-overview-client";

export default function Loading() {
  return (
    <PageShell contentClassName="max-w-none">
      <ProjectsOverviewSkeleton />
    </PageShell>
  );
}
