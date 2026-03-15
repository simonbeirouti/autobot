import { PageShell } from "@/components/page-shell";
import {
  RunsDashboardClient,
} from "@/components/runs-dashboard-client";

export default function RunsPage() {
  return (
    <PageShell
      contentClassName="h-full max-w-none"
      scrollable={false}
      scrollableClassName="overflow-y-auto xl:overflow-hidden"
    >
      <RunsDashboardClient
        initialWorkspace={null}
      />
    </PageShell>
  );
}
