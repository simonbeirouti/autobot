import { NextResponse } from "next/server";

import {
  isInternalDefinitionVisible,
  isInternalDefinitionEnabled,
  toInternalCatalogRecord,
} from "@/lib/tools/internal-registry";
import {
  fetchInternalToolDefinitionsWithFallback,
  fetchProjectInternalToolEnablements,
} from "@/lib/tools/repository";
import { resolveCompanyKey } from "@/lib/projects/context";
import { fetchProject } from "@/lib/projects/repository";
import type { InternalToolCatalog } from "@/lib/tools/types";
import { isSupabaseRowNotFoundError } from "@/lib/supabase/errors";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const projectId = requestUrl.searchParams.get("projectId");
    const supabase = await createClient();
    const companyKey =
      projectId
        ? (
            await fetchProject(supabase, {
              projectId,
              userId: user.sub,
            })
          ).companyKey
        : resolveCompanyKey({
            sub: user.sub,
            email: typeof user.email === "string" ? user.email : null,
          });
    const [definitions, enablements] = await Promise.all([
      fetchInternalToolDefinitionsWithFallback(supabase),
      projectId
        ? fetchProjectInternalToolEnablements(supabase, {
            projectId,
            userId: user.sub,
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const enablementBySlug = new Map(
      enablements.map((enablement) => [enablement.toolSlug, enablement.isEnabled]),
    );
    const tools = definitions
      .filter((definition) =>
        isInternalDefinitionVisible({
          definition,
          companyKey,
          projectId,
        }),
      )
      .map((definition) =>
        toInternalCatalogRecord({
          definition,
          projectEnabled: isInternalDefinitionEnabled({
            definition,
            enablement: enablementBySlug.get(definition.slug),
          }),
        }),
      );

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        toolCount: tools.length,
        tools,
      } satisfies InternalToolCatalog,
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (isSupabaseRowNotFoundError(error)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load internal tool catalog.",
      },
      { status: 500 },
    );
  }
}
