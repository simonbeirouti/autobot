import { NextResponse } from "next/server";

import { fetchRuns } from "@/lib/runs/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = await createClient();
    const projectId = new URL(request.url).searchParams.get("projectId");
    const runs = await fetchRuns(supabase, { userId: user.sub, projectId });

    return NextResponse.json(runs, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load runs." },
      { status: 500 },
    );
  }
}
