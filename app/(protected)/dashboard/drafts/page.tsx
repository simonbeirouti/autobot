import {
  DraftsDashboardClient,
} from "@/components/drafts-dashboard-client";
import { PageShell } from "@/components/page-shell";

export default function DraftsPage() {
  return (
    <PageShell
      contentClassName="h-full max-w-none"
      scrollable={false}
      scrollableClassName="overflow-y-auto xl:overflow-hidden"
    >
      <DraftsDashboardClient
        initialFlow={null}
      />
    </PageShell>
  );
}
