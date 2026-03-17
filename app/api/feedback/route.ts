import { NextResponse } from "next/server";
import { z } from "zod";

import { createFeedbackSubmission } from "@/lib/feedback/repository";
import { FEEDBACK_SUBMISSION_TYPES } from "@/lib/feedback/types";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const createFeedbackSchema = z.object({
  type: z.enum(FEEDBACK_SUBMISSION_TYPES),
  score: z.number().int().min(1).max(10),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
});

function getDisplayName(user: {
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
  };
}) {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;

  if (typeof metadataName === "string" && metadataName.trim().length > 0) {
    return metadataName.trim();
  }

  if (typeof user.email === "string" && user.email.includes("@")) {
    return user.email.split("@")[0];
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = createFeedbackSchema.parse(await request.json());
    const supabase = await createClient();
    const submission = await createFeedbackSubmission(supabase, {
      userId: user.sub,
      userEmail: typeof user.email === "string" ? user.email : null,
      userName: getDisplayName(user),
      ...body,
    });

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid feedback submission.", issues: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to submit feedback right now.",
      },
      { status: 500 },
    );
  }
}
