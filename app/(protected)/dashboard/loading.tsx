import { DashboardHomeSkeleton } from "@/components/dashboard/dashboard-home-client";
import { PageShell } from "@/components/layout/page-shell";

export default function Loading() {
  return (
    <PageShell contentClassName="max-w-none">
      <DashboardHomeSkeleton />
    </PageShell>
  );
}
