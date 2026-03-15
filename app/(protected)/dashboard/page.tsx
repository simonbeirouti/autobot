import { PageShell } from "@/components/page-shell";
import { DashboardHomeClient } from "@/components/dashboard-home-client";

export default function Home() {
  return (
    <PageShell contentClassName="max-w-none">
      <DashboardHomeClient />
    </PageShell>
  );
}
