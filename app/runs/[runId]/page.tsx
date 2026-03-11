import { Suspense } from "react";

import { PageShell } from "@/components/page-shell";
import { RunPageClient } from "@/components/run-page-client";

export default function RunPage() {
  return (
    <PageShell contentClassName="max-w-[1480px] gap-6">
      <Suspense fallback={<div className="py-10 text-sm text-foreground/60">Loading workspace...</div>}>
        <RunPageClient />
      </Suspense>
    </PageShell>
  );
}
