import { NextResponse } from "next/server";

import { advanceRunExecution } from "@/lib/agents/orchestrator";
import {
  fetchWorkspace,
  insertRunEvents,
  insertUsageRecords,
  updateRunStatus,
  updateTaskStatuses,
} from "@/lib/runs/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectTools } from "@/lib/tools/resolver";

export async function POST(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { runId } = await context.params;
    const supabase = await createClient();
    const workspace = await fetchWorkspace(supabase, { runId, userId: user.sub });
    const toolContext =
      workspace.run.projectId
        ? await resolveProjectTools(supabase, {
            projectId: workspace.run.projectId,
            userId: user.sub,
          })
        : null;

    if (workspace.run.status === "completed" || workspace.run.status === "failed") {
      return NextResponse.json(workspace);
    }

    const result = await advanceRunExecution({
      runId: workspace.run.id,
      status: workspace.run.status,
      executionMode: workspace.run.executionMode,
      tasks: workspace.tasks,
      events: workspace.events,
      usage: workspace.usage,
      finalSummary: workspace.run.finalSummary,
      activeToolkitSlugs: toolContext?.activeToolkitSlugs ?? [],
    });

    await updateTaskStatuses(supabase, {
      runId: workspace.run.id,
      userId: user.sub,
      tasks: result.tasks,
    });
    await updateRunStatus(supabase, {
      runId: workspace.run.id,
      userId: user.sub,
      status: result.status,
      finalSummary: result.finalSummary,
    });
    await insertRunEvents(supabase, result.events);
    await insertUsageRecords(supabase, user.sub, result.usage);

    const nextWorkspace = await fetchWorkspace(supabase, { runId, userId: user.sub });
    return NextResponse.json(nextWorkspace);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to advance run." },
      { status: 500 },
    );
  }
}
