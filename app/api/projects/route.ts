import { NextResponse } from "next/server";
import { z } from "zod";

import { deriveProjectIconKey, resolveCompanyKey } from "@/lib/projects/context";
import { createProject, fetchProjects } from "@/lib/projects/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const createProjectSchema = z.object({
  name: z.string().trim().min(5).max(10),
  description: z.string().trim().min(8).max(600),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const supabase = await createClient();
    const projects = await fetchProjects(supabase, { userId: user.sub });
    return NextResponse.json(projects, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load projects." },
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

    const body = createProjectSchema.parse(await request.json());
    const companyKey = resolveCompanyKey({
      sub: user.sub,
      email: typeof user.email === "string" ? user.email : null,
    });
    const supabase = await createClient();
    const project = await createProject(supabase, {
      userId: user.sub,
      companyKey,
      name: body.name,
      description: body.description,
      iconKey: deriveProjectIconKey(body.name),
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create project." },
      { status: 500 },
    );
  }
}
