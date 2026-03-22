import {
  DraftsDashboardClient,
} from "@/components/drafts-dashboard-client";
import { PageShell } from "@/components/page-shell";

export default function DraftsPage() {
  return (
    <PageShell
      contentClassName="max-w-none xl:h-full"
      scrollable
      scrollableClassName="xl:overflow-hidden"
    >
      <DraftsDashboardClient
        initialFlow={null}
      />
    </PageShell>
  );
}
