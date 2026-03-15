import { NextResponse } from "next/server";
import { z } from "zod";

import { invokeProjectChat, promoteDurableFactsFromTurn } from "@/lib/agents/project-chat";
import { resolveCompanyKey } from "@/lib/projects/context";
import {
  appendProjectChatMessage,
  createProjectChatThread,
  fetchObjective,
  fetchProject,
  fetchProjectThread,
  touchProjectChatThread,
} from "@/lib/projects/repository";
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

    const response = await invokeProjectChat(supabase, {
      userId: user.sub,
      companyKey,
      project,
      objective,
      objectiveId: thread.objectiveId,
      threadId: thread.id,
      message: body.message,
    });

    await appendProjectChatMessage(supabase, {
      threadId: thread.id,
      projectId,
      userId: user.sub,
      role: "assistant",
      content: response.answer,
      agentId: response.routedAgentId,
      citedMemoryIds: response.citedMemoryIds,
      objectiveId: thread.objectiveId,
    });

    await promoteDurableFactsFromTurn(supabase, {
      userId: user.sub,
      companyKey,
      project,
      objectiveId: thread.objectiveId,
      threadId: thread.id,
      userMessage: body.message,
      assistantMessage: response.answer,
      agentId: response.routedAgentId as "orchestrator" | "researcher" | "operator" | "analyst",
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send project message." },
      { status: 500 },
    );
  }
}
