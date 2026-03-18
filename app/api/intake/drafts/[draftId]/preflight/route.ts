import { NextResponse } from "next/server";

import { fetchIntakeDraftWithQuestions } from "@/lib/intake/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { buildProjectToolPreflight } from "@/lib/tools/preflight";

export async function GET(
  _request: Request,
  context: { params: Promise<{ draftId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { draftId } = await context.params;
    const supabase = await createClient();
    const { draft } = await fetchIntakeDraftWithQuestions(supabase, {
      draftId,
      userId: user.sub,
    });

    if (!draft.projectId) {
      return NextResponse.json(null);
    }

    const preflight = await buildProjectToolPreflight(supabase, {
      userId: user.sub,
      projectId: draft.projectId,
      objective: draft.objective,
      tasks: draft.taskDrafts.map((task) => ({
        title: task.title,
        executionStrategy: task.executionStrategy,
        toolSummary: task.toolSummary || null,
        requiredToolkitSlugs: task.requiredToolkitSlugs,
      })),
      nextPath: `/dashboard/drafts?draftId=${draft.id}`,
    });

    return NextResponse.json(preflight, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load draft preflight.",
      },
      { status: 500 },
    );
  }
}
