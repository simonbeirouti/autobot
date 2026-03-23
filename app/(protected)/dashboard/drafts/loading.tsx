import { PageShell } from "@/components/layout/page-shell";
import { DraftsDashboardSkeleton } from "@/components/dashboard/drafts-dashboard-client";

export default function Loading() {
  return (
    <PageShell
      contentClassName="max-w-none xl:h-full"
      scrollable
      scrollableClassName="xl:overflow-hidden"
    >
      <DraftsDashboardSkeleton />
    </PageShell>
  );
}
