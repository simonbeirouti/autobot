import { NextResponse } from "next/server";
import { z } from "zod";

import { promoteDurableFactsFromTurn, streamProjectChat } from "@/lib/agents/project-chat";
import { resolveCompanyKey } from "@/lib/projects/context";
import {
  appendProjectChatMessage,
  createProjectChatThread,
  fetchObjective,
  fetchProject,
  fetchProjectThread,
  touchProjectChatThread,
} from "@/lib/projects/repository";
import type { ProjectChatResponse, ProjectChatStreamEvent } from "@/lib/projects/types";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const projectChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  threadId: z.string().uuid().nullable().optional(),
  objectiveId: z.string().uuid().nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user?.sub) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { projectId } = await context.params;
    const body = projectChatSchema.parse(await request.json());
    const supabase = await createClient();
    const project = await fetchProject(supabase, { projectId, userId: user.sub });
    const objective =
      body.objectiveId
        ? await fetchObjective(supabase, {
            objectiveId: body.objectiveId,
            projectId,
            userId: user.sub,
          })
        : null;
    const companyKey = resolveCompanyKey({
      sub: user.sub,
      email: typeof user.email === "string" ? user.email : null,
    });
    const thread =
      body.threadId
        ? await fetchProjectThread(supabase, {
            threadId: body.threadId,
            projectId,
            userId: user.sub,
          })
        : await createProjectChatThread(supabase, {
            projectId,
            objectiveId: body.objectiveId ?? null,
            userId: user.sub,
            title: body.message.slice(0, 80),
          });

    if (!body.threadId) {
      await touchProjectChatThread(supabase, {
        threadId: thread.id,
        projectId,
        userId: user.sub,
        title: body.message.slice(0, 80),
      });
    }

    await appendProjectChatMessage(supabase, {
      threadId: thread.id,
      projectId,
      userId: user.sub,
      role: "user",
      content: body.message,
      objectiveId: thread.objectiveId,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const pushEvent = (event: ProjectChatStreamEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        pushEvent({ type: "thread", threadId: thread.id });

        try {
          const response = streamProjectChat(supabase, {
            userId: user.sub,
            companyKey,
            project,
            objective,
            objectiveId: thread.objectiveId,
            threadId: thread.id,
            message: body.message,
          });

          let payload: ProjectChatResponse | null = null;

          while (true) {
            const next = await response.next();
            if (next.done) {
              payload = next.value;
              break;
            }

            pushEvent(next.value);
          }

          if (!payload) {
            throw new Error("Chat response stream ended without a final payload.");
          }

          await appendProjectChatMessage(supabase, {
            threadId: thread.id,
            projectId,
            userId: user.sub,
            role: "assistant",
            content: payload.answer,
            agentId: payload.routedAgentId,
            citedMemoryIds: payload.citedMemoryIds,
            objectiveId: thread.objectiveId,
          });

          await promoteDurableFactsFromTurn(supabase, {
            userId: user.sub,
            companyKey,
            project,
            objectiveId: thread.objectiveId,
            threadId: thread.id,
            userMessage: body.message,
            assistantMessage: payload.answer,
            agentId: payload.routedAgentId as "orchestrator" | "researcher" | "operator" | "analyst",
          });

          pushEvent({ type: "final", ...payload });
          controller.close();
        } catch (error) {
          pushEvent({
            type: "error",
            error: error instanceof Error ? error.message : "Unable to send project message.",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send project message." },
      { status: 500 },
    );
  }
}
