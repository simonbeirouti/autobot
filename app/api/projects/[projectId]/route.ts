import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchProjectWorkspace, updateProject } from "@/lib/projects/repository";
import { isSupabaseRowNotFoundError } from "@/lib/supabase/errors";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const updateProjectSchema = z.object({
  action: z.enum(["activate", "archive", "delete"]),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { projectId } = await context.params;
    const threadId = new URL(request.url).searchParams.get("threadId");
    const supabase = await createClient();
    const workspace = await fetchProjectWorkspace(supabase, {
      projectId,
      userId: user.sub,
      threadId,
    });

    return NextResponse.json(workspace, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    if (isSupabaseRowNotFoundError(error)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load project." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { projectId } = await context.params;
    const body = updateProjectSchema.parse(await request.json());
    const now = new Date().toISOString();
    const patch =
      body.action === "archive"
        ? { status: "archived" as const, archivedAt: now, deletedAt: null }
        : body.action === "delete"
          ? { status: "deleted" as const, archivedAt: null, deletedAt: now }
          : { status: "active" as const, archivedAt: null, deletedAt: null };

    const supabase = await createClient();
    const project = await updateProject(supabase, {
      projectId,
      userId: user.sub,
      patch,
    });

    return NextResponse.json(project);
  } catch (error) {
    if (isSupabaseRowNotFoundError(error)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update project." },
      { status: 500 },
    );
  }
}
