import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applyActionRequiredToTasks,
  buildManualPauseActionRequired,
  sendDueRunBlockedEmail,
} from "@/lib/runs/action-required";
import {
  fetchWorkspace,
  syncRunTasks,
  updateRunStatus,
} from "@/lib/runs/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const updateRunSchema = z.object({
  action: z.enum(["stop"]),
});

export async function GET(
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

    await sendDueRunBlockedEmail(supabase, {
      userId: user.sub,
      recipientEmail: typeof user.email === "string" ? user.email : null,
      recipientName:
        user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      run: workspace.run,
    });

    return NextResponse.json(workspace, {
      headers: {
        "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load run." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = updateRunSchema.parse(await request.json());
    const { runId } = await context.params;
    const supabase = await createClient();
    const workspace = await fetchWorkspace(supabase, { runId, userId: user.sub });

    if (body.action === "stop") {
      if (workspace.run.status === "completed" || workspace.run.status === "failed") {
        return NextResponse.json(
          { error: "Completed or failed runs cannot be stopped." },
          { status: 409 },
        );
      }

      const actionRequired = buildManualPauseActionRequired({ runId });
      const pausedTasks = applyActionRequiredToTasks(
        workspace.tasks.map((task) =>
          task.status === "underway" ? { ...task, status: "waiting" as const } : task,
        ),
        actionRequired,
      );

      await syncRunTasks(supabase, {
        runId,
        tasks: pausedTasks,
      });
      await updateRunStatus(supabase, {
        runId,
        userId: user.sub,
        status: "blocked",
        actionRequired,
      });

      const nextWorkspace = await fetchWorkspace(supabase, { runId, userId: user.sub });
      return NextResponse.json(nextWorkspace);
    }

    return NextResponse.json({ error: "Unsupported run action." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid run action.", issues: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update run." },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const { error } = await supabase
      .from("runs")
      .delete()
      .eq("id", runId)
      .eq("user_id", user.sub);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true as const, runId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete run." },
      { status: 500 },
    );
  }
}
