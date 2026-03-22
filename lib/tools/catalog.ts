import { unstable_cache } from "next/cache";

import type {
  ComposioToolCatalog,
  ComposioToolCategoryRecord,
  ComposioToolDetailRecord,
  ProviderConnection,
  ToolkitConnectionStatus,
} from "@/lib/tools/types";

const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3";
const COMPOSIO_PAGE_SIZE = 250;

type ComposioToolkitApiRecord = {
  slug: string;
  name: string;
  no_auth: boolean;
  auth_schemes?: string[];
  meta?: {
    description?: string;
    logo?: string;
    app_url?: string;
    tools_count?: number;
    categories?: Array<{
      id?: string;
      name?: string;
    }>;
  };
};

type ComposioToolApiRecord = {
  slug: string;
  name: string;
  description: string | null;
  no_auth: boolean;
  scopes?: string[];
  tags?: string[];
  toolkit?: {
    slug?: string;
    name?: string;
    logo?: string;
  };
};

type ComposioListResponse<T> = {
  items: T[];
  next_cursor?: string | null;
};

function readComposioApiKey() {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : null;
}

function ensureComposioApiKey() {
  const apiKey = readComposioApiKey();

  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY is required to load the Composio catalog.");
  }

  return apiKey;
}

function getConnectionStatusByToolkit(
  connections: ProviderConnection[],
) {
  return new Map<string, ToolkitConnectionStatus>(
    connections.map((connection) => [connection.toolkitSlug, connection.status]),
  );
}

function getConnectionByToolkit(connections: ProviderConnection[]) {
  return new Map<string, ProviderConnection>(
    connections.map((connection) => [connection.toolkitSlug, connection]),
  );
}

function normalizeCategoryName(value: string) {
  return value
    .split(/[\s-&]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getFallbackCategoryTag() {
  return {
    id: "other",
    name: "Other",
  };
}

async function fetchComposioApi<T>(
  pathname: string,
  searchParams: URLSearchParams,
) {
  const apiKey = ensureComposioApiKey();
  const response = await fetch(`${COMPOSIO_API_BASE}${pathname}?${searchParams.toString()}`, {
    headers: {
      "x-api-key": apiKey,
    },
    next: {
      revalidate: 60 * 60,
    },
  });

  if (!response.ok) {
    throw new Error(`Composio API request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

async function fetchAllToolkits(): Promise<ComposioToolkitApiRecord[]> {
  const items: ComposioToolkitApiRecord[] = [];
  let cursor: string | null = null;

  do {
    const searchParams = new URLSearchParams({
      limit: String(COMPOSIO_PAGE_SIZE),
    });

    if (cursor) {
      searchParams.set("cursor", cursor);
    }

    const payload = await fetchComposioApi<ComposioListResponse<ComposioToolkitApiRecord>>(
      "/toolkits",
      searchParams,
    );

    items.push(...payload.items);
    cursor = payload.next_cursor ?? null;
  } while (cursor);

  return items;
}

async function fetchAllToolsForToolkit(toolkitSlug: string): Promise<ComposioToolDetailRecord[]> {
  const items: ComposioToolDetailRecord[] = [];
  let cursor: string | null = null;

  do {
    const searchParams = new URLSearchParams({
      limit: String(COMPOSIO_PAGE_SIZE),
      toolkit_slug: toolkitSlug,
    });

    if (cursor) {
      searchParams.set("cursor", cursor);
    }

    const payload = await fetchComposioApi<ComposioListResponse<ComposioToolApiRecord>>(
      "/tools",
      searchParams,
    );

    items.push(
      ...payload.items.map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        description: tool.description ?? "",
        noAuth: tool.no_auth,
        scopes: tool.scopes ?? [],
        tags: tool.tags ?? [],
        toolkitSlug: tool.toolkit?.slug ?? toolkitSlug,
      })),
    );
    cursor = payload.next_cursor ?? null;
  } while (cursor);

  return items.toSorted((left, right) => left.name.localeCompare(right.name));
}

const getCachedToolkits = unstable_cache(
  async () => fetchAllToolkits(),
  ["composio-toolkits"],
  {
    revalidate: 60 * 60,
  },
);

const getCachedToolsForToolkit = unstable_cache(
  async (toolkitSlug: string) => fetchAllToolsForToolkit(toolkitSlug),
  ["composio-tools-by-toolkit"],
  {
    revalidate: 60 * 60,
  },
);

export async function getComposioToolCatalog(connections: ProviderConnection[]) {
  const toolkitApiRecords = await getCachedToolkits();
  const connectionStatusByToolkit = getConnectionStatusByToolkit(connections);
  const connectionsByToolkit = getConnectionByToolkit(connections);
  const categoryCounts = new Map<string, ComposioToolCategoryRecord>();

  const toolkits = toolkitApiRecords
    .map((toolkit) => {
      const categories =
        toolkit.meta?.categories?.length
          ? toolkit.meta.categories
              .filter(
                (category): category is { id: string; name: string } =>
                  Boolean(category.id && category.name),
              )
              .map((category) => ({
                id: category.id,
                name: normalizeCategoryName(category.name),
              }))
          : [getFallbackCategoryTag()];

      for (const category of categories) {
        const current = categoryCounts.get(category.id);
        categoryCounts.set(category.id, {
          id: category.id,
          name: category.name,
          toolkitCount: (current?.toolkitCount ?? 0) + 1,
        });
      }

      return {
        slug: toolkit.slug,
        name: toolkit.name,
        description: toolkit.meta?.description ?? null,
        logoUrl: toolkit.meta?.logo ?? null,
        appUrl: toolkit.meta?.app_url ?? null,
        toolCount: toolkit.meta?.tools_count ?? 0,
        noAuth: toolkit.no_auth,
        authSchemes: toolkit.auth_schemes ?? [],
        supportsOAuth: (toolkit.auth_schemes ?? []).includes("OAUTH2"),
        supportsApiKey: (toolkit.auth_schemes ?? []).includes("API_KEY"),
        categories,
        connectionStatus: connectionStatusByToolkit.get(toolkit.slug) ?? "not_connected",
        connectionAuthScheme: connectionsByToolkit.get(toolkit.slug)?.authScheme ?? null,
        apiKeyLastFour: connectionsByToolkit.get(toolkit.slug)?.apiKeyLastFour ?? null,
        apiKeyUpdatedAt: connectionsByToolkit.get(toolkit.slug)?.apiKeyUpdatedAt ?? null,
      };
    })
    .toSorted((left, right) => left.name.localeCompare(right.name));

  return {
    generatedAt: new Date().toISOString(),
    toolkitCount: toolkits.length,
    categories: Array.from(categoryCounts.values()).toSorted((left, right) => {
      if (right.toolkitCount !== left.toolkitCount) {
        return right.toolkitCount - left.toolkitCount;
      }

      return left.name.localeCompare(right.name);
    }),
    toolkits,
  } satisfies ComposioToolCatalog;
}

export async function getComposioToolsForToolkit(toolkitSlug: string) {
  return getCachedToolsForToolkit(toolkitSlug);
}
