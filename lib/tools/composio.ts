import { Composio } from "@composio/core";

import { DEFAULT_ONBOARDING_TOOLKITS, RECOMMENDED_TOOLKITS } from "@/lib/tools/config";
import type { ToolkitConnectionStatus } from "@/lib/tools/types";

type SessionToolkitItem = {
  slug: string;
  connection?: {
    isActive: boolean;
    connectedAccount?: {
      id: string;
      status: string;
    };
  };
};

function readComposioApiKey() {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : null;
}

export function isComposioConfigured() {
  return Boolean(readComposioApiKey());
}

export function getRecommendedToolkitSlugs() {
  return DEFAULT_ONBOARDING_TOOLKITS;
}

export function getRecommendedToolkitOptions() {
  return RECOMMENDED_TOOLKITS;
}

export function createComposioClient() {
  const apiKey = readComposioApiKey();

  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY is required to use provider connections.");
  }

  return new Composio({
    apiKey,
    allowTracking: false,
  });
}

export async function createComposioSession(userId: string, toolkitSlugs?: string[]) {
  const composio = createComposioClient();
  return composio.toolRouter.create(userId, {
    ...(toolkitSlugs && toolkitSlugs.length > 0 ? { toolkits: toolkitSlugs } : {}),
  });
}

export async function getComposioSession(sessionId: string) {
  const composio = createComposioClient();
  return composio.toolRouter.use(sessionId);
}

export async function beginToolkitAuthorization(params: {
  userId: string;
  toolkitSlug: string;
  callbackUrl: string;
  sessionId?: string | null;
  toolkitSlugs?: string[];
}) {
  const session = params.sessionId
    ? await getComposioSession(params.sessionId)
    : await createComposioSession(params.userId, params.toolkitSlugs);
  const request = await session.authorize(params.toolkitSlug, {
    callbackUrl: params.callbackUrl,
  });

  return {
    sessionId: session.sessionId,
    connectedAccountId:
      "connectedAccountId" in request && typeof request.connectedAccountId === "string"
        ? request.connectedAccountId
        : null,
    redirectUrl:
      "redirectUrl" in request && typeof request.redirectUrl === "string"
        ? request.redirectUrl
        : null,
  };
}

function mapComposioConnectionStatus(
  isActive: boolean,
  connectedAccountStatus?: string | null,
): ToolkitConnectionStatus {
  if (isActive) {
    return "active";
  }

  const normalized = connectedAccountStatus?.toLowerCase() ?? "";
  if (normalized.includes("expired")) return "expired";
  if (normalized.includes("fail")) return "failed";
  if (normalized.includes("disable")) return "disabled";
  if (normalized.includes("init")) return "initiated";
  return "not_connected";
}

export async function inspectToolkitConnection(params: {
  sessionId: string;
  toolkitSlug: string;
}) {
  const session = await getComposioSession(params.sessionId);
  const response = await session.toolkits({ toolkits: [params.toolkitSlug] });
  const item = response.items.find(
    (toolkit: SessionToolkitItem) => toolkit.slug === params.toolkitSlug,
  );

  return {
    connectedAccountId: item?.connection?.connectedAccount?.id ?? null,
    status: mapComposioConnectionStatus(
      item?.connection?.isActive ?? false,
      item?.connection?.connectedAccount?.status ?? null,
    ),
  };
}
