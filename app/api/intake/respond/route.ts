import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildInitialRunPayload,
  clarifyObjective,
} from "@/lib/agents/orchestrator";
import {
  appendClarificationMessage,
  createRun,
  fetchClarificationTranscript,
  insertRunEvents,
  insertRunTasks,
  insertUsageRecords,
} from "@/lib/runs/repository";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  objective: z.string().min(8).max(2000),
  sessionId: z.string().uuid(),
  answer: z.string().min(1).max(1200),
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "Unable to continue clarification.";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const payload = bodySchema.parse(await request.json());
    const supabase = await createClient();

    await appendClarificationMessage(supabase, {
      sessionId: payload.sessionId,
      userId: user.sub,
      role: "user",
      content: payload.answer,
    });

    const transcript = await fetchClarificationTranscript(supabase, {
      sessionId: payload.sessionId,
      userId: user.sub,
    });

    const result = await clarifyObjective({
      objective: payload.objective,
      transcript: transcript.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    if (result.status === "needs_input") {
      await appendClarificationMessage(supabase, {
        sessionId: payload.sessionId,
        userId: user.sub,
        role: "assistant",
        content: result.summary,
        questions: result.questions,
      });

      await insertUsageRecords(supabase, user.sub, [
        {
          runId: null,
          sessionId: payload.sessionId,
          category: "chat",
          name: "clarification_turn",
          agentId: "orchestrator",
          status: "succeeded",
          inputSummary: payload.answer,
          resultSummary: result.questions.join(" | "),
          tokenCount: null,
          latencyMs: null,
          costEstimate: null,
        },
      ]);

      return NextResponse.json({
        sessionId: payload.sessionId,
        status: result.status,
        summary: result.summary,
        questions: result.questions,
      });
    }

    const run = await createRun(supabase, {
      sessionId: payload.sessionId,
      userId: user.sub,
      objective: payload.objective,
      executionMode: result.executionMode,
      readinessSummary: result.summary,
    });

    const initialPayload = buildInitialRunPayload({
      runId: run.id,
      sessionId: payload.sessionId,
      objective: payload.objective,
      result,
    });

    await appendClarificationMessage(supabase, {
      sessionId: payload.sessionId,
      userId: user.sub,
      role: "assistant",
      content: result.summary,
    });
    await insertRunTasks(supabase, initialPayload.tasks);
    await insertRunEvents(supabase, initialPayload.events);
    await insertUsageRecords(supabase, user.sub, initialPayload.usage);

    return NextResponse.json({
      sessionId: payload.sessionId,
      runId: run.id,
      status: result.status,
      summary: result.summary,
      questions: [],
    });
  } catch (error) {
    console.error("POST /api/intake/respond failed", error);

    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
