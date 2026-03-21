import { createHash } from "crypto";
import { readFile } from "fs/promises";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { writeLongTermMemory, fetchLongTermMemoryByProject } from "@/lib/memory/repository";
import { createProjectAsset, fetchProjectAssets } from "@/lib/projects/repository";
import { resolveCompanyKey } from "@/lib/projects/context";
import { getInternalExecutorConfig } from "@/lib/tools/internal-registry";
import type {
  InternalToolHttpConfig,
  ResolvedToolCandidate,
  ToolExecutionResult,
  ToolRuntimeContext,
} from "@/lib/tools/types";

const pageExtractorInputSchema = z.object({
  url: z.string().url(),
  extractionMode: z.enum(["standard", "metadata_only"]).optional().default("standard"),
});

const webSearchInputSchema = z.object({
  query: z.string().min(2),
  domainFilters: z.array(z.string().min(1)).max(10).optional().default([]),
  resultLimit: z.number().int().min(1).max(10).optional().default(5),
});

const artifactStoreInputSchema = z.object({
  label: z.string().min(1).max(160),
  assetType: z.string().min(1).max(80),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  writeMemorySummary: z.boolean().optional().default(false),
  summary: z.string().max(400).optional().default(""),
});

const siteCrawlerInputSchema = z.object({
  rootUrl: z.string().url(),
  pageLimit: z.number().int().min(1).max(20).optional().default(5),
  depthLimit: z.number().int().min(0).max(4).optional().default(1),
  stayWithinPath: z.boolean().optional().default(true),
});

const documentSearchInputSchema = z.object({
  query: z.string().min(2),
  resultLimit: z.number().int().min(1).max(10).optional().default(5),
  includeMemory: z.boolean().optional().default(true),
});

type InternalExecutorParams = {
  supabase: SupabaseClient;
  context: ToolRuntimeContext;
  candidate: ResolvedToolCandidate;
  input: Record<string, unknown>;
};

function withTimeout(signalTimeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), signalTimeoutMs);

  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timer),
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTagContent(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ? normalizeWhitespace(decodeHtml(stripTags(match[1]))) : null;
}

function extractMeta(html: string, name: string) {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return normalizeWhitespace(decodeHtml(match[1]));
    }
  }
  return null;
}

function extractCanonical(html: string) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return match?.[1] ? match[1].trim() : null;
}

function extractHeadings(html: string, tag: "h1" | "h2") {
  return Array.from(html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")))
    .map((match) => normalizeWhitespace(decodeHtml(stripTags(match[1] ?? ""))))
    .filter(Boolean)
    .slice(0, tag === "h1" ? 5 : 12);
}

function extractLinks(html: string, baseUrl: string) {
  return Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
    .map((match) => {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 200);
}

function htmlToText(html: string) {
  const body = extractTagContent(html, "body") ?? stripTags(html);
  return normalizeWhitespace(decodeHtml(body));
}

function createContentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function fetchTextContent(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "AutoBot/1.0 (+https://autobot.local)",
    },
    redirect: "follow",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url,
    contentType,
    text,
  };
}

async function extractPage(url: string, extractionMode: "standard" | "metadata_only") {
  const response = await fetchTextContent(url);
  const title = extractTagContent(response.text, "title");
  const description = extractMeta(response.text, "description") ?? extractMeta(response.text, "og:description");
  const canonical = extractCanonical(response.text);
  const h1 = extractHeadings(response.text, "h1");
  const h2 = extractHeadings(response.text, "h2");
  const textContent =
    extractionMode === "metadata_only" ? "" : htmlToText(response.text).slice(0, 12_000);
  const markdown = textContent;
  const links = extractLinks(response.text, response.finalUrl);
  const hash = createContentHash([title, description, textContent].filter(Boolean).join("\n"));

  return {
    url,
    finalUrl: response.finalUrl,
    status: response.status,
    ok: response.ok,
    contentType: response.contentType,
    title,
    description,
    canonical,
    h1,
    h2,
    links,
    textContent,
    markdown,
    contentHash: hash,
  };
}

async function executePageExtractor(params: InternalExecutorParams): Promise<ToolExecutionResult> {
  const input = pageExtractorInputSchema.parse(params.input);
  const extracted = await extractPage(input.url, input.extractionMode);

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Extracted ${extracted.title ?? extracted.finalUrl}.`,
    data: extracted as Record<string, unknown>,
    logId: null,
  };
}

async function searchWithTavily(params: z.infer<typeof webSearchInputSchema>) {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: params.query,
      max_results: params.resultLimit,
      include_answer: false,
      include_raw_content: false,
      ...(params.domainFilters.length > 0
        ? {
            include_domains: params.domainFilters,
          }
        : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Search provider failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
  };

  return (payload.results ?? []).map((item, index) => ({
    title: item.title ?? item.url ?? `Result ${index + 1}`,
    url: item.url ?? "",
    snippet: normalizeWhitespace(item.content ?? ""),
    source: "tavily",
    rank: index + 1,
    score: item.score ?? null,
    fetchedAt: new Date().toISOString(),
  }));
}

async function executeWebSearch(params: InternalExecutorParams): Promise<ToolExecutionResult> {
  const input = webSearchInputSchema.parse(params.input);
  const results = await searchWithTavily(input);

  if (!results) {
    return {
      status: "failed",
      toolSlug: params.candidate.toolSlug,
      toolkitSlug: params.candidate.toolkitSlug,
      message: "No internal web search provider is configured.",
      data: null,
      logId: null,
    };
  }

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Found ${results.length} search result${results.length === 1 ? "" : "s"}.`,
    data: {
      query: input.query,
      results,
    },
    logId: null,
  };
}

async function executeArtifactStore(params: InternalExecutorParams): Promise<ToolExecutionResult> {
  const input = artifactStoreInputSchema.parse(params.input);
  if (!params.context.projectId) {
    throw new Error("artifact_store requires a project context.");
  }

  const contentHash = createContentHash(input.content);
  const asset = await createProjectAsset(params.supabase, {
    projectId: params.context.projectId,
    userId: params.context.userId,
    label: input.label,
    assetType: input.assetType,
    storagePath: null,
    metadata: {
      ...input.metadata,
      content: input.content,
      contentHash,
      source: "internal_builtin",
      toolSlug: params.candidate.toolSlug,
    },
  });

  let memoryId: string | null = null;
  if (input.writeMemorySummary && input.summary.trim().length > 0) {
    const companyKey = resolveCompanyKey({
      sub: params.context.userId,
      email: null,
    });
    const memory = await writeLongTermMemory(params.supabase, {
      userId: params.context.userId,
      companyKey,
      projectId: params.context.projectId,
      objectiveId: params.context.objectiveId,
      scope: params.context.objectiveId ? "objective" : "project",
      kind: "artifact",
      sourceType: "internal_tool",
      sourceId: asset.id,
      summary: input.summary,
      content: input.content.slice(0, 4000),
      metadata: {
        assetId: asset.id,
        toolSlug: params.candidate.toolSlug,
      },
    });
    memoryId = memory.id;
  }

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Stored artifact "${asset.label}".`,
    data: {
      asset,
      memoryId,
    },
    logId: null,
  };
}

async function executeSiteCrawler(params: InternalExecutorParams): Promise<ToolExecutionResult> {
  const input = siteCrawlerInputSchema.parse(params.input);
  if (!params.context.projectId) {
    throw new Error("site_crawler requires a project context.");
  }

  const rootUrl = new URL(input.rootUrl);
  const queue: Array<{ url: string; depth: number }> = [{ url: rootUrl.toString(), depth: 0 }];
  const seen = new Set<string>();
  const pages: Array<Record<string, unknown>> = [];

  while (queue.length > 0 && pages.length < input.pageLimit) {
    const current = queue.shift();
    if (!current || seen.has(current.url)) {
      continue;
    }

    seen.add(current.url);

    try {
      const extracted = await extractPage(current.url, "metadata_only");
      pages.push({
        url: extracted.finalUrl,
        status: extracted.status,
        title: extracted.title,
        canonical: extracted.canonical,
        h1: extracted.h1,
        contentHash: extracted.contentHash,
      });

      if (current.depth < input.depthLimit) {
        for (const link of extracted.links) {
          try {
            const linkUrl = new URL(link);
            if (linkUrl.hostname !== rootUrl.hostname) {
              continue;
            }
            if (input.stayWithinPath && !linkUrl.pathname.startsWith(rootUrl.pathname)) {
              continue;
            }
            if (!seen.has(linkUrl.toString())) {
              queue.push({ url: linkUrl.toString(), depth: current.depth + 1 });
            }
          } catch {
            continue;
          }
        }
      }
    } catch {
      pages.push({
        url: current.url,
        status: 0,
        title: null,
        canonical: null,
        h1: [],
        contentHash: null,
      });
    }
  }

  const asset = await createProjectAsset(params.supabase, {
    projectId: params.context.projectId,
    userId: params.context.userId,
    label: `crawl:${rootUrl.hostname}`,
    assetType: "crawl_snapshot",
    metadata: {
      rootUrl: rootUrl.toString(),
      pageLimit: input.pageLimit,
      depthLimit: input.depthLimit,
      pages,
      toolSlug: params.candidate.toolSlug,
    },
  });

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Crawled ${pages.length} page${pages.length === 1 ? "" : "s"} from ${rootUrl.hostname}.`,
    data: {
      rootUrl: rootUrl.toString(),
      pages,
      asset,
    },
    logId: null,
  };
}

async function readAssetText(asset: Awaited<ReturnType<typeof fetchProjectAssets>>[number]) {
  const metadataContentCandidates = [
    typeof asset.metadata.content === "string" ? asset.metadata.content : null,
    typeof asset.metadata.textContent === "string" ? asset.metadata.textContent : null,
    typeof asset.metadata.summary === "string" ? asset.metadata.summary : null,
  ].filter((value): value is string => Boolean(value));

  if (metadataContentCandidates.length > 0) {
    return metadataContentCandidates.join("\n");
  }

  if (asset.storagePath && asset.storagePath.startsWith("/")) {
    try {
      const content = await readFile(asset.storagePath, "utf8");
      return content;
    } catch {
      return "";
    }
  }

  return JSON.stringify(asset.metadata);
}

function chunkText(content: string, chunkSize = 500) {
  const normalized = normalizeWhitespace(content);
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }
  return chunks.slice(0, 12);
}

async function executeDocumentSearch(params: InternalExecutorParams): Promise<ToolExecutionResult> {
  const input = documentSearchInputSchema.parse(params.input);
  if (!params.context.projectId) {
    throw new Error("document_search requires a project context.");
  }

  const assets = await fetchProjectAssets(params.supabase, {
    projectId: params.context.projectId,
    userId: params.context.userId,
  });
  const queryTerms = input.query.toLowerCase().split(/\s+/).filter((term) => term.length >= 2);
  const results: Array<Record<string, unknown>> = [];

  for (const asset of assets) {
    const content = await readAssetText(asset);
    const chunks = chunkText(content);

    chunks.forEach((chunk, index) => {
      const haystack = chunk.toLowerCase();
      const score = queryTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      if (score > 0) {
        results.push({
          kind: "asset",
          assetId: asset.id,
          assetLabel: asset.label,
          assetType: asset.assetType,
          chunkIndex: index,
          score,
          excerpt: chunk,
        });
      }
    });
  }

  if (input.includeMemory) {
    const memories = await fetchLongTermMemoryByProject(params.supabase, {
      userId: params.context.userId,
      projectId: params.context.projectId,
      objectiveId: params.context.objectiveId ?? undefined,
      limit: 50,
    });

    memories.forEach((memory) => {
      const haystack = `${memory.summary}\n${memory.content}`.toLowerCase();
      const score = queryTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      if (score > 0) {
        results.push({
          kind: "memory",
          memoryId: memory.id,
          summary: memory.summary,
          score,
          excerpt: memory.content.slice(0, 400),
        });
      }
    });
  }

  const ranked = results
    .sort((left, right) => Number(right.score) - Number(left.score))
    .slice(0, input.resultLimit);

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Found ${ranked.length} matching passage${ranked.length === 1 ? "" : "s"}.`,
    data: {
      query: input.query,
      results: ranked,
    },
    logId: null,
  };
}

async function executeHttpInternalTool(
  params: InternalExecutorParams,
  config: InternalToolHttpConfig,
): Promise<ToolExecutionResult> {
  const timeout = withTimeout(config.timeoutMs);
  const url = new URL(config.endpointUrl);
  if (config.method === "GET") {
    const payload = config.includeContext
      ? {
          input: params.input,
          context: {
            userId: params.context.userId,
            projectId: params.context.projectId,
            objectiveId: params.context.objectiveId,
            threadId: params.context.threadId,
            runId: params.context.runId,
          },
        }
      : { input: params.input };

    url.searchParams.set("payload", JSON.stringify(payload));
  }

  try {
    const response = await fetch(url.toString(), {
      method: config.method,
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body:
        config.method === "GET"
          ? undefined
          : JSON.stringify({
              input: params.input,
              ...(config.includeContext
                ? {
                    context: {
                      userId: params.context.userId,
                      projectId: params.context.projectId,
                      objectiveId: params.context.objectiveId,
                      threadId: params.context.threadId,
                      runId: params.context.runId,
                    },
                  }
                : {}),
            }),
      signal: timeout.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : `Custom tool endpoint failed with status ${response.status}.`;

      return {
        status: "failed",
        toolSlug: params.candidate.toolSlug,
        toolkitSlug: params.candidate.toolkitSlug,
        message,
        data:
          typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)
            : { responseText: String(payload) },
        logId: null,
      };
    }

    return {
      status: "succeeded",
      toolSlug: params.candidate.toolSlug,
      toolkitSlug: params.candidate.toolkitSlug,
      message: `Executed ${params.candidate.title}.`,
      data:
        typeof payload === "object" && payload !== null
          ? (payload as Record<string, unknown>)
          : { responseText: String(payload) },
      logId: null,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Custom tool request timed out after ${config.timeoutMs}ms.`
        : error instanceof Error
          ? error.message
          : "Custom tool execution failed.";

    return {
      status: "failed",
      toolSlug: params.candidate.toolSlug,
      toolkitSlug: params.candidate.toolkitSlug,
      message,
      data: null,
      logId: null,
    };
  } finally {
    timeout.dispose();
  }
}

const executorMap = {
  page_extractor: executePageExtractor,
  web_search: executeWebSearch,
  artifact_store: executeArtifactStore,
  site_crawler: executeSiteCrawler,
  document_search: executeDocumentSearch,
} as const;

export function isInternalExecutorKey(value: string): value is keyof typeof executorMap {
  return value in executorMap;
}

export async function executeInternalTool(params: InternalExecutorParams) {
  if (params.candidate.source === "internal_custom") {
    const config = getInternalExecutorConfig({
      id: params.candidate.id,
      slug: params.candidate.toolSlug,
      toolkitSlug: params.candidate.toolkitSlug,
      source: "internal_custom",
      title: params.candidate.title,
      description: params.candidate.description,
      executionMode: params.candidate.executionMode,
      riskLevel: params.candidate.riskLevel,
      executorKey: params.candidate.executorKey,
      inputSchema: params.candidate.inputSchema,
      outputSchema: params.candidate.outputSchema,
      tags: params.candidate.tags,
      capabilities: params.candidate.capabilities,
      approvalPolicy: params.candidate.approvalPolicy,
      requiresConnection: params.candidate.requiresConnection,
      enabledByDefault: true,
      metadata: params.candidate.config,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });

    if (config.handlerType === "http_request") {
      return executeHttpInternalTool(params, config);
    }

    throw new Error(`No internal custom executor registered for ${params.candidate.toolSlug}.`);
  }

  if (!isInternalExecutorKey(params.candidate.executorKey)) {
    throw new Error(`No internal executor registered for ${params.candidate.executorKey}.`);
  }

  return executorMap[params.candidate.executorKey](params);
}

export function isWebSearchConfigured() {
  return Boolean(process.env.TAVILY_API_KEY?.trim());
}
