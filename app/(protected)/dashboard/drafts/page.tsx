import { Suspense } from "react";

import {
  DraftsDashboardClient,
  DraftsDashboardSkeleton,
} from "@/components/drafts-dashboard-client";
import { PageShell } from "@/components/page-shell";
import { fetchIntakeDraftWithQuestions, fetchIntakeDrafts } from "@/lib/intake/repository";
import { isActiveIntakeDraft, sortDraftsByCreatedAt } from "@/lib/intake/presentation";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default function DraftsPage({
  searchParams,
}: {
  searchParams: Promise<{ draftId?: string }>;
}) {
  return (
    <PageShell
      contentClassName="h-full max-w-none"
      scrollable={false}
      scrollableClassName="overflow-y-auto xl:overflow-hidden"
    >
      <Suspense fallback={<DraftsDashboardSkeleton />}>
        <DraftsPageContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function DraftsPageContent({
  searchParams,
}: {
  searchParams: Promise<{ draftId?: string }>;
}) {
  const user = await requireUser();
  const { draftId } = await searchParams;
  const supabase = await createClient();
  const allDrafts = await fetchIntakeDrafts(supabase, { userId: user.sub });
  const drafts = sortDraftsByCreatedAt(allDrafts.filter(isActiveIntakeDraft));
  const selectedDraftId =
    draftId && drafts.some((draft) => draft.id === draftId) ? draftId : drafts[0]?.id ?? null;
  const initialFlow = selectedDraftId
    ? await fetchIntakeDraftWithQuestions(supabase, {
        draftId: selectedDraftId,
        userId: user.sub,
      })
    : null;

  return (
    <DraftsDashboardClient
      initialDrafts={drafts}
      initialFlow={initialFlow}
      initialSelectedDraftId={selectedDraftId}
    />
  );
}
