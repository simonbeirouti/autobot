import { NextResponse } from "next/server";

import { fetchProjectWorkspace } from "@/lib/projects/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load project." },
      { status: 500 },
    );
  }
}
