import { NextResponse } from "next/server";

import { fetchWorkspace } from "@/lib/runs/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

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

    return NextResponse.json(workspace, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load run." },
      { status: 500 },
    );
  }
}
