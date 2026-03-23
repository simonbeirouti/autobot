import { PageShell } from "@/components/layout/page-shell";
import { ChatsDashboardSkeleton } from "@/components/dashboard/chats-dashboard-client";

export default function Loading() {
  return (
    <PageShell
      contentClassName="h-full min-h-0 max-w-none"
      scrollable={false}
      scrollableClassName="overflow-hidden"
    >
      <ChatsDashboardSkeleton />
    </PageShell>
  );
}
