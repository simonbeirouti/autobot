import { PageShell } from "@/components/page-shell";
import { RunsDashboardSkeleton } from "@/components/runs-dashboard-client";

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
