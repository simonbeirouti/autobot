import { PageShell } from "@/components/page-shell";
import { SettingsPageSkeleton } from "@/components/settings-page-client";

export default function Loading() {
  return (
    <PageShell contentClassName="max-w-none">
      <SettingsPageSkeleton />
    </PageShell>
  );
}
