import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isInternalDefinitionVisible,
  isInternalDefinitionEnabled,
  toInternalCatalogRecord,
} from "@/lib/tools/internal-registry";
import {
  fetchInternalToolDefinitionBySlug,
  fetchProjectInternalToolEnablements,
  upsertProjectInternalToolEnablement,
} from "@/lib/tools/repository";
import { resolveCompanyKey } from "@/lib/projects/context";
import { fetchProject } from "@/lib/projects/repository";
import type { InternalToolDetailPayload } from "@/lib/tools/types";
import { isSupabaseRowNotFoundError } from "@/lib/supabase/errors";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const updateEnablementSchema = z.object({
  projectId: z.string().uuid(),
  isEnabled: z.boolean(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ toolSlug: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { toolSlug } = await context.params;
    const requestUrl = new URL(request.url);
    const projectId = requestUrl.searchParams.get("projectId");
    const supabase = await createClient();
    const definition = await fetchInternalToolDefinitionBySlug(supabase, { toolSlug });

    if (!definition) {
      return NextResponse.json({ error: "Internal tool not found." }, { status: 404 });
    }

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

    if (
      !isInternalDefinitionVisible({
        definition,
        companyKey,
        projectId,
      })
    ) {
      return NextResponse.json({ error: "Internal tool not found." }, { status: 404 });
    }

    const enablements =
      projectId
        ? await fetchProjectInternalToolEnablements(supabase, {
            projectId,
            userId: user.sub,
          }).catch(() => [])
        : [];
    const enablement = enablements.find((item) => item.toolSlug === toolSlug);

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        tool: toInternalCatalogRecord({
          definition,
          projectEnabled: isInternalDefinitionEnabled({
            definition,
            enablement: enablement?.isEnabled,
          }),
        }),
      } satisfies InternalToolDetailPayload,
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
          error instanceof Error ? error.message : "Unable to load internal tool details.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ toolSlug: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { toolSlug } = await context.params;
    const body = updateEnablementSchema.parse(await request.json());
    const supabase = await createClient();
    const project = await fetchProject(supabase, {
      projectId: body.projectId,
      userId: user.sub,
    });

    const definition = await fetchInternalToolDefinitionBySlug(supabase, { toolSlug });

    if (!definition) {
      return NextResponse.json({ error: "Internal tool not found." }, { status: 404 });
    }

    if (
      !isInternalDefinitionVisible({
        definition,
        companyKey: project.companyKey,
        projectId: body.projectId,
      })
    ) {
      return NextResponse.json({ error: "Internal tool not found." }, { status: 404 });
    }

    await upsertProjectInternalToolEnablement(supabase, {
      projectId: body.projectId,
      userId: user.sub,
      toolSlug,
      isEnabled: body.isEnabled,
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      tool: toInternalCatalogRecord({
        definition,
        projectEnabled: body.isEnabled,
      }),
    } satisfies InternalToolDetailPayload);
  } catch (error) {
    if (isSupabaseRowNotFoundError(error)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update internal tool settings.",
      },
      { status: 500 },
    );
  }
}
