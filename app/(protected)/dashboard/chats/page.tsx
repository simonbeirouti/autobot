import { PageShell } from "@/components/page-shell";
import { ChatsDashboardClient } from "@/components/chats-dashboard-client";

export default function ChatPage() {
  return (
    <PageShell
      contentClassName="h-full min-h-0 max-w-none"
      scrollable={false}
      scrollableClassName="overflow-hidden"
    >
      <ChatsDashboardClient />
    </PageShell>
  );
}
