import { NextResponse } from "next/server";

import { dismissAllNotifications } from "@/lib/notifications/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = await createClient();
    await dismissAllNotifications(supabase, { userId: user.sub });

    return NextResponse.json({ success: true as const });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to dismiss notifications.",
      },
      { status: 500 },
    );
  }
}
