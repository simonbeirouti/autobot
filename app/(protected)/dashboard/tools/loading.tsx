import { PageShell } from "@/components/layout/page-shell";
import { ToolsDashboardSkeleton } from "@/components/dashboard/tools-dashboard-client";

export default function Loading() {
  return (
    <PageShell
      contentClassName="h-full min-h-0 max-w-none"
      scrollable={false}
      scrollableClassName="overflow-y-auto xl:overflow-hidden"
    >
      <ToolsDashboardSkeleton />
    </PageShell>
  );
}
