import { NextResponse } from "next/server";
import { z } from "zod";

import { upsertInternalToolDefinition, fetchInternalToolDefinitions } from "@/lib/tools/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const manageCustomToolSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9_]+$/),
  toolkitSlug: z.string().min(2).max(80).regex(/^[a-z0-9_]+$/).optional(),
  title: z.string().min(2).max(120),
  description: z.string().min(2).max(500),
  executionMode: z.enum(["read", "write", "admin"]).default("read"),
  riskLevel: z.enum(["low", "medium", "high"]).default("low"),
  inputSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  outputSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  tags: z.array(z.string().min(1)).default([]),
  capabilities: z.array(z.string().min(1)).default([]),
  approvalPolicy: z.enum(["none", "confirm_writes"]).default("none"),
  enabledByDefault: z.boolean().default(true),
  companyKey: z.string().min(1),
  projectIds: z.array(z.string().uuid()).default([]),
  endpointUrl: z.string().url(),
  method: z.enum(["GET", "POST"]).default("POST"),
  headers: z.record(z.string(), z.string()).default({}),
  includeContext: z.boolean().default(true),
  timeoutMs: z.number().int().min(100).max(30000).default(10000),
});

function isAuthorized(request: Request) {
  const adminKey = process.env.AUTOBOT_INTERNAL_ADMIN_KEY?.trim();
  if (!adminKey) {
    throw new Error("AUTOBOT_INTERNAL_ADMIN_KEY is not configured.");
  }

  return request.headers.get("x-autobot-admin-key") === adminKey;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Admin authorization required." }, { status: 403 });
    }

    const url = new URL(request.url);
    const companyKey = url.searchParams.get("companyKey");
    const admin = createAdminClient();
    const definitions = await fetchInternalToolDefinitions(admin);
    const tools = definitions.filter((definition) => {
      if (definition.source !== "internal_custom") {
        return false;
      }

      if (!companyKey) {
        return true;
      }

      return definition.metadata.companyKey === companyKey;
    });

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        toolCount: tools.length,
        tools,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to manage internal custom tools.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Admin authorization required." }, { status: 403 });
    }

    const body = manageCustomToolSchema.parse(await request.json());
    const admin = createAdminClient();
    const tool = await upsertInternalToolDefinition(admin, {
      slug: body.slug,
      toolkitSlug: body.toolkitSlug ?? body.slug,
      source: "internal_custom",
      title: body.title,
      description: body.description,
      executionMode: body.executionMode,
      riskLevel: body.riskLevel,
      executorKey: "internal_custom_http",
      inputSchema: body.inputSchema ?? null,
      outputSchema: body.outputSchema ?? null,
      tags: body.tags,
      capabilities: body.capabilities,
      approvalPolicy: body.approvalPolicy,
      requiresConnection: false,
      enabledByDefault: body.enabledByDefault,
      metadata: {
        companyKey: body.companyKey,
        projectIds: body.projectIds,
        handlerType: "http_request",
        endpointUrl: body.endpointUrl,
        method: body.method,
        headers: body.headers,
        includeContext: body.includeContext,
        timeoutMs: body.timeoutMs,
        createdBy: user.sub,
      },
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      tool,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save internal custom tool.",
      },
      { status: 500 },
    );
  }
}
