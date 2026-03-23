import { PageShell } from "@/components/layout/page-shell";
import { SettingsPageSkeleton } from "@/components/dashboard/settings-page-client";

export default function Loading() {
  return (
    <PageShell
      contentClassName="max-w-none xl:h-full"
      scrollable
      scrollableClassName="xl:overflow-hidden"
    >
      <SettingsPageSkeleton />
    </PageShell>
  );
}
