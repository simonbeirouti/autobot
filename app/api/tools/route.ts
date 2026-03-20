import { NextResponse } from "next/server";

import { getComposioToolCatalog } from "@/lib/tools/catalog";
import { fetchProviderConnections } from "@/lib/tools/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = await createClient();
    const connections = await fetchProviderConnections(supabase, { userId: user.sub });
    const catalog = await getComposioToolCatalog(connections);

    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the Composio tool catalog.",
      },
      { status: 500 },
    );
  }
}
