import { PageShell } from "@/components/layout/page-shell";
import { RunsDashboardSkeleton } from "@/components/dashboard/runs-dashboard-client";

export default function Loading() {
  return (
    <PageShell
      contentClassName="max-w-none xl:h-full"
      scrollable
      scrollableClassName="xl:overflow-hidden"
    >
      <RunsDashboardSkeleton />
    </PageShell>
  );
}
