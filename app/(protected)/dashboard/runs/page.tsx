import { PageShell } from "@/components/page-shell";
import {
  RunsDashboardClient,
} from "@/components/runs-dashboard-client";

export default function RunsPage() {
  return (
    <PageShell
      contentClassName="max-w-none xl:h-full"
      scrollable
      scrollableClassName="xl:overflow-hidden"
    >
      <RunsDashboardClient
        initialWorkspace={null}
      />
    </PageShell>
  );
}
