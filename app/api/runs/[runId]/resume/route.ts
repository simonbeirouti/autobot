import { NextResponse } from "next/server";

import { advanceRunWorkspace } from "@/lib/runs/advance";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

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
    const nextWorkspace = await advanceRunWorkspace({
      supabase,
      user,
      runId,
      force: true,
    });

    return NextResponse.json(nextWorkspace);
  } catch (error) {
    console.error("[runs.resume] request failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to resume run." },
      { status: 500 },
    );
  }
}
