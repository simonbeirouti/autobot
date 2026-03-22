import { DashboardHomeSkeleton } from "@/components/dashboard-home-client";
import { PageShell } from "@/components/page-shell";

export default function Loading() {
  return (
    <PageShell contentClassName="max-w-none">
      <DashboardHomeSkeleton />
    </PageShell>
  );
}
