import { NextResponse } from "next/server";

import { getComposioToolsForToolkit } from "@/lib/tools/catalog";
import { getCurrentUser } from "@/lib/supabase/auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ toolkitSlug: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { toolkitSlug } = await context.params;
    const tools = await getComposioToolsForToolkit(toolkitSlug);

    return NextResponse.json(
      {
        toolkitSlug,
        generatedAt: new Date().toISOString(),
        toolCount: tools.length,
        tools,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=1800, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load toolkit tools from Composio.",
      },
      { status: 500 },
    );
  }
}
