import { NextResponse } from "next/server";

import { fetchIntakeDrafts } from "@/lib/intake/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = await createClient();
    const drafts = await fetchIntakeDrafts(supabase, { userId: user.sub });

    return NextResponse.json(drafts, {
      headers: {
        "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load drafts." },
      { status: 500 },
    );
  }
}
