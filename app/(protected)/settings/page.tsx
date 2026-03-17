import { requireUser } from "@/lib/supabase/auth";
import { PageShell } from "@/components/page-shell";
import { SettingsPageClient } from "@/components/settings-page-client";

export default async function SettingsPage() {
  await requireUser();

  return (
    <PageShell contentClassName="max-w-none">
      <SettingsPageClient />
    </PageShell>
  );
}
