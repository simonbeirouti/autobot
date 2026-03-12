import { NextResponse } from "next/server";

import { buildInitialRunPayload } from "@/lib/agents/orchestrator";
import { fetchIntakeDraftWithQuestions, updateIntakeDraft } from "@/lib/intake/repository";
import {
  appendClarificationMessage,
  createRun,
  fetchLatestRunBySessionId,
  insertRunEvents,
  insertRunTasks,
  insertUsageRecords,
} from "@/lib/runs/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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
    const { draft } = await fetchIntakeDraftWithQuestions(supabase, { draftId, userId: user.sub });

    if (draft.runId) {
      await updateIntakeDraft(supabase, {
        draftId,
        userId: user.sub,
        patch: {
          status: "archived",
          completedAt: draft.completedAt ?? new Date().toISOString(),
        },
      });
      return NextResponse.json({ runId: draft.runId });
    }

    const existingRun = await fetchLatestRunBySessionId(supabase, {
      sessionId: draft.sessionId,
      userId: user.sub,
    });

    if (existingRun) {
      await updateIntakeDraft(supabase, {
        draftId,
        userId: user.sub,
        patch: {
          status: "archived",
          runId: existingRun.id,
          completedAt: draft.completedAt ?? new Date().toISOString(),
        },
      });
      return NextResponse.json({ runId: existingRun.id });
    }

    if (draft.status !== "review_ready") {
      return NextResponse.json({ error: "Draft is not ready for execution." }, { status: 409 });
    }

    if (!draft.executionMode) {
      return NextResponse.json({ error: "Draft is missing an execution mode." }, { status: 409 });
    }

    const run = await createRun(supabase, {
      sessionId: draft.sessionId,
      userId: user.sub,
      objective: draft.objective,
      executionMode: draft.executionMode,
      readinessSummary: draft.clarificationSummary ?? "Draft approved for execution.",
    });

    const initialPayload = buildInitialRunPayload({
      runId: run.id,
      sessionId: draft.sessionId,
      objective: draft.objective,
      result: {
        status: "ready_to_execute",
        summary: draft.clarificationSummary ?? "Draft approved for execution.",
        confidenceToProceed: draft.confidenceToProceed ?? 0.8,
        executionMode: draft.executionMode,
        questions: [],
        draftMarkdown: draft.draftMarkdown ?? draft.generatedMarkdown ?? "",
        tasks: draft.taskDrafts,
        eventNarrative: draft.eventNarrative,
      },
    });

    await appendClarificationMessage(supabase, {
      sessionId: draft.sessionId,
      userId: user.sub,
      role: "assistant",
      content: `Execution confirmed.\n\n${draft.draftMarkdown ?? draft.generatedMarkdown ?? draft.clarificationSummary ?? ""}`,
    });
    await insertRunTasks(supabase, initialPayload.tasks);
    await insertRunEvents(supabase, initialPayload.events);
    await insertUsageRecords(supabase, user.sub, [
      ...initialPayload.usage,
      {
        runId: run.id,
        sessionId: draft.sessionId,
        category: "chat",
        name: "draft_execution_confirmation",
        agentId: "orchestrator",
        status: "succeeded",
        inputSummary: draft.objective,
        resultSummary: draft.draftMarkdown ?? draft.generatedMarkdown ?? draft.clarificationSummary,
        tokenCount: null,
        latencyMs: null,
        costEstimate: null,
      },
    ]);

    await updateIntakeDraft(supabase, {
      draftId,
      userId: user.sub,
      patch: {
        status: "archived",
        runId: run.id,
        completedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ runId: run.id });
  } catch (error) {
    console.error("POST /api/intake/drafts/[draftId]/execute failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to execute draft." },
      { status: 500 },
    );
  }
}
