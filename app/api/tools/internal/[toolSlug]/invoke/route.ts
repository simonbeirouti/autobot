import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isInternalDefinitionVisible,
  toResolvedInternalToolCandidate,
} from "@/lib/tools/internal-registry";
import { fetchInternalToolDefinitionBySlug } from "@/lib/tools/repository";
import { executeResolvedTool } from "@/lib/tools/runtime";
import { resolveCompanyKey } from "@/lib/projects/context";
import { fetchObjective, fetchProject } from "@/lib/projects/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const invokeToolSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  objectiveId: z.string().uuid().optional().nullable(),
  input: z.record(z.string(), z.unknown()).default({}),
  confirmedWriteActions: z.boolean().optional().default(false),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ toolSlug: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { toolSlug } = await context.params;
    const body = invokeToolSchema.parse(await request.json());
    const supabase = await createClient();
    const definition = await fetchInternalToolDefinitionBySlug(supabase, { toolSlug });

    if (!definition) {
      return NextResponse.json({ error: "Internal tool not found." }, { status: 404 });
    }

    let companyKey = resolveCompanyKey({
      sub: user.sub,
      email: typeof user.email === "string" ? user.email : null,
    });

    if (body.projectId) {
      const project = await fetchProject(supabase, {
        projectId: body.projectId,
        userId: user.sub,
      });
      companyKey = project.companyKey;
    }

    if (body.projectId && body.objectiveId) {
      await fetchObjective(supabase, {
        objectiveId: body.objectiveId,
        projectId: body.projectId,
        userId: user.sub,
      });
    }

    if (
      !isInternalDefinitionVisible({
        definition,
        companyKey,
        projectId: body.projectId ?? null,
      })
    ) {
      return NextResponse.json({ error: "Internal tool not found." }, { status: 404 });
    }

    const result = await executeResolvedTool({
      supabase,
      context: {
        userId: user.sub,
        projectId: body.projectId ?? null,
        objectiveId: body.objectiveId ?? null,
        threadId: null,
        runId: null,
        allowedToolkitSlugs: [definition.toolkitSlug],
        confirmedWriteActions: body.confirmedWriteActions,
      },
      candidate: toResolvedInternalToolCandidate(definition),
      input: body.input,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to invoke internal tool.",
      },
      { status: 500 },
    );
  }
}
