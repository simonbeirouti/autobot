import { PageShell } from "@/components/page-shell";
import { ToolsDashboardClient } from "@/components/tools-dashboard-client";

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
