import { PageShell } from "@/components/page-shell";
import { ProjectsOverviewSkeleton } from "@/components/projects-overview-client";

export default function Loading() {
  return (
    <PageShell contentClassName="max-w-none">
      <ProjectsOverviewSkeleton />
    </PageShell>
  );
}
