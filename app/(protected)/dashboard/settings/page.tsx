import { requireUser } from "@/lib/supabase/auth";
import { PageShell } from "@/components/layout/page-shell";
import { SettingsPageClient } from "@/components/dashboard/settings-page-client";

export default async function SettingsPage() {
  await requireUser();

  return (
    <PageShell
      contentClassName="max-w-none xl:h-full"
      scrollable
      scrollableClassName="xl:overflow-hidden"
    >
      <SettingsPageClient />
    </PageShell>
  );
}
