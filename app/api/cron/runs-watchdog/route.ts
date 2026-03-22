import { NextResponse } from "next/server";

import { sweepRunsWatchdog } from "@/lib/runs/watchdog";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const vercelCronHeader = request.headers.get("x-vercel-cron");

  if (cronSecret) {
    return authorization === `Bearer ${cronSecret}`;
  }

  return process.env.NODE_ENV !== "production" || vercelCronHeader === "1";
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const result = await sweepRunsWatchdog({
      supabase,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[runs.watchdog] cron failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to sweep runs.",
      },
      { status: 500 },
    );
  }
}
