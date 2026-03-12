import { Suspense } from "react";

import { PageShell } from "@/components/page-shell";
import {
  RunsDashboardClient,
  RunsDashboardSkeleton,
} from "@/components/runs-dashboard-client";
import { fetchRuns, fetchWorkspace } from "@/lib/runs/repository";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ runId?: string }>;
}) {
  return (
    <PageShell
      contentClassName="h-full max-w-none"
      scrollable={false}
      scrollableClassName="overflow-y-auto xl:overflow-hidden"
    >
      <Suspense fallback={<RunsDashboardSkeleton />}>
        <RunsPageContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function RunsPageContent({
  searchParams,
}: {
  searchParams: Promise<{ runId?: string }>;
}) {
  const user = await requireUser();
  const { runId } = await searchParams;
  const supabase = await createClient();
  const runs = await fetchRuns(supabase, { userId: user.sub });
  const selectedRunId =
    runId && runs.some((run) => run.id === runId) ? runId : runs[0]?.id ?? null;
  const initialWorkspace = selectedRunId
    ? await fetchWorkspace(supabase, { runId: selectedRunId, userId: user.sub })
    : null;

  return (
    <RunsDashboardClient
      initialRuns={runs}
      initialWorkspace={initialWorkspace}
      initialSelectedRunId={selectedRunId}
    />
  );
}
