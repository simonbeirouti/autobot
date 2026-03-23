import { PageShell } from "@/components/layout/page-shell";
import { ToolsDashboardClient } from "@/components/dashboard/tools-dashboard-client";

export default function ToolsPage() {
  return (
    <PageShell
      contentClassName="h-full min-h-0 max-w-none"
      scrollable={false}
      scrollableClassName="overflow-y-auto xl:overflow-hidden"
    >
      <ToolsDashboardClient />
    </PageShell>
  );
}
