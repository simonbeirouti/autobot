import { PageShell } from "@/components/page-shell";
import { ChatsDashboardSkeleton } from "@/components/chats-dashboard-client";

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
