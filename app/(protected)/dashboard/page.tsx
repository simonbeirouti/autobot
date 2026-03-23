import { PageShell } from "@/components/layout/page-shell";
import { DashboardHomeClient } from "@/components/dashboard/dashboard-home-client";

export default function Home() {
  return (
    <PageShell contentClassName="max-w-none">
      <DashboardHomeClient />
    </PageShell>
  );
}
