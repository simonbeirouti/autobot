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

const sitemapRobotsAuditInputSchema = z.object({
  siteUrl: z.string().url(),
  includeChildSitemaps: z.boolean().optional().default(true),
  sitemapLimit: z.number().int().min(1).max(20).optional().default(8),
});

const tableQueryInputSchema = z
  .object({
    assetId: z.string().min(1).optional(),
    csvContent: z.string().min(1).optional(),
    jsonRows: z.array(z.record(z.string(), z.unknown())).optional(),
    operation: z.enum(["inspect", "filter", "group_count", "summary"]).optional().default("inspect"),
    filterColumn: z.string().min(1).optional(),
    filterValue: z.string().optional(),
    groupBy: z.string().min(1).optional(),
    metricColumn: z.string().min(1).optional(),
    rowLimit: z.number().int().min(1).max(100).optional().default(20),
  })
  .refine((value) => Boolean(value.assetId || value.csvContent || value.jsonRows?.length), {
    message: "Provide assetId, csvContent, or jsonRows.",
  });

const serpSnapshotInputSchema = z.object({
  query: z.string().min(2),
  domainFilters: z.array(z.string().min(1)).max(10).optional().default([]),
  resultLimit: z.number().int().min(1).max(10).optional().default(5),
});

const competitorCompareInputSchema = z
  .object({
    urls: z.array(z.string().url()).max(8).optional().default([]),
    query: z.string().min(2).optional(),
    resultLimit: z.number().int().min(1).max(8).optional().default(4),
    comparisonFocus: z.string().max(240).optional().default(""),
  })
  .refine((value) => value.urls.length > 0 || Boolean(value.query?.trim()), {
    message: "Provide urls or a discovery query.",
  });

const contentInventoryInputSchema = z.object({
  rootUrl: z.string().url(),
  pageLimit: z.number().int().min(1).max(20).optional().default(8),
  depthLimit: z.number().int().min(0).max(3).optional().default(1),
  stayWithinPath: z.boolean().optional().default(true),
  thinContentThreshold: z.number().int().min(50).max(5000).optional().default(250),
});

const reportWriterInputSchema = z.object({
  title: z.string().min(1).max(160),
  reportType: z.string().min(1).max(80).optional().default("report"),
  summary: z.string().max(1200).optional().default(""),
  findings: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1).max(120),
        body: z.string().min(1),
      }),
    )
    .optional()
    .default([]),
  writeMemorySummary: z.boolean().optional().default(false),
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

function extractSchemaHints(html: string) {
  const rawBlocks = Array.from(
    html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  )
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  const schemaTypes = new Set<string>();
  for (const block of rawBlocks.slice(0, 10)) {
    try {
      const parsed = JSON.parse(block) as unknown;
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== "object") {
          continue;
        }
        const record = current as Record<string, unknown>;
        const atType = record["@type"];
        if (typeof atType === "string") {
          schemaTypes.add(atType);
        } else if (Array.isArray(atType)) {
          atType
            .filter((value): value is string => typeof value === "string")
            .forEach((value) => schemaTypes.add(value));
        }
        Object.values(record).forEach((value) => {
          if (value && typeof value === "object") {
            queue.push(value);
          }
        });
      }
    } catch {
      continue;
    }
  }

  return {
    rawCount: rawBlocks.length,
    schemaTypes: Array.from(schemaTypes).slice(0, 20),
  };
}

function htmlToText(html: string) {
  const body = extractTagContent(html, "body") ?? stripTags(html);
  return normalizeWhitespace(decodeHtml(body));
}

function textToMarkdown(params: {
  title: string | null;
  description: string | null;
  h1: string[];
  h2: string[];
  textContent: string;
}) {
  const parts: string[] = [];
  if (params.title) {
    parts.push(`# ${params.title}`);
  }
  if (params.description) {
    parts.push(params.description);
  }
  if (params.h1.length > 0) {
    parts.push(`## Primary headings\n${params.h1.map((value) => `- ${value}`).join("\n")}`);
  }
  if (params.h2.length > 0) {
    parts.push(`## Secondary headings\n${params.h2.map((value) => `- ${value}`).join("\n")}`);
  }
  if (params.textContent) {
    parts.push(`## Body\n${params.textContent}`);
  }

  return parts.join("\n\n");
}

function createContentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function safeJsonSummary(value: unknown, maxLength = 600) {
  try {
    const text = JSON.stringify(value);
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
  } catch {
    return null;
  }
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
  const schemaHints = extractSchemaHints(response.text);
  const textContent =
    extractionMode === "metadata_only" ? "" : htmlToText(response.text).slice(0, 12_000);
  const markdown = textToMarkdown({
    title,
    description,
    h1,
    h2,
    textContent,
  });
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
    schemaHints,
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

type CrawlPageRecord = {
  url: string;
  status: number;
  title: string | null;
  canonical: string | null;
  h1: string[];
  contentHash: string | null;
  links?: string[];
};

async function crawlSite(params: {
  rootUrl: string;
  pageLimit: number;
  depthLimit: number;
  stayWithinPath: boolean;
}) {
  const rootUrl = new URL(params.rootUrl);
  const queue: Array<{ url: string; depth: number }> = [{ url: rootUrl.toString(), depth: 0 }];
  const seen = new Set<string>();
  const pages: CrawlPageRecord[] = [];

  while (queue.length > 0 && pages.length < params.pageLimit) {
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
        links: extracted.links,
      });

      if (current.depth < params.depthLimit) {
        for (const link of extracted.links) {
          try {
            const linkUrl = new URL(link);
            if (linkUrl.hostname !== rootUrl.hostname) {
              continue;
            }
            if (params.stayWithinPath && !linkUrl.pathname.startsWith(rootUrl.pathname)) {
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
        links: [],
      });
    }
  }

  return {
    rootUrl: rootUrl.toString(),
    hostname: rootUrl.hostname,
    pages,
  };
}

async function fetchOptionalText(url: string) {
  try {
    const response = await fetchTextContent(url);
    return response.ok ? response.text : "";
  } catch {
    return "";
  }
}

function parseRobotsDirectives(content: string) {
  const blockedPaths = new Set<string>();
  const sitemapUrls = new Set<string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const [directive, ...valueParts] = line.split(":");
    const value = valueParts.join(":").trim();
    if (!directive || !value) {
      continue;
    }
    const normalizedDirective = directive.trim().toLowerCase();
    if (normalizedDirective === "disallow") {
      blockedPaths.add(value);
    }
    if (normalizedDirective === "sitemap") {
      sitemapUrls.add(value);
    }
  }

  return {
    blockedPaths: Array.from(blockedPaths),
    sitemapUrls: Array.from(sitemapUrls),
  };
}

function extractXmlTags(xml: string, tag: string) {
  return Array.from(xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")))
    .map((match) => normalizeWhitespace(decodeHtml(stripTags(match[1] ?? ""))))
    .filter(Boolean);
}

function parseSitemapXml(xml: string) {
  const sitemapUrls = extractXmlTags(xml, "loc").filter((value) => /^https?:\/\//i.test(value));
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  return {
    kind: isIndex ? ("index" as const) : ("urlset" as const),
    urls: sitemapUrls,
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvContent(csvContent: string) {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function normalizeTableRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value === null || value === undefined ? "" : String(value),
      ]),
    ),
  );
}

function inferPageType(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    if (path === "/" || /pricing|plans/.test(path)) {
      return /pricing|plans/.test(path) ? "pricing" : "homepage";
    }
    if (/blog|article|news/.test(path)) return "blog";
    if (/docs|guide|help/.test(path)) return "docs";
    if (/case-study|customers|stories/.test(path)) return "proof";
    if (/about|company|team/.test(path)) return "company";
    if (/contact|demo|get-started|signup|book/.test(path)) return "conversion";
    return "page";
  } catch {
    return "page";
  }
}

function extractCallsToAction(text: string) {
  const matches = text.match(
    /\b(book a demo|request a demo|get started|start free|talk to sales|contact us|sign up|try for free)\b/gi,
  );
  return Array.from(new Set((matches ?? []).map((value) => value.toLowerCase()))).slice(0, 8);
}

function renderReportMarkdown(params: {
  title: string;
  reportType: string;
  summary: string;
  findings: Array<Record<string, unknown>>;
  sections: Array<{ heading: string; body: string }>;
}) {
  const lines = [`# ${params.title}`, "", `Type: ${params.reportType}`];

  if (params.summary.trim()) {
    lines.push("", "## Summary", "", params.summary.trim());
  }

  if (params.findings.length > 0) {
    lines.push("", "## Findings", "");
    params.findings.forEach((finding, index) => {
      const title =
        typeof finding.title === "string" && finding.title.trim()
          ? finding.title.trim()
          : `Finding ${index + 1}`;
      const detail =
        typeof finding.detail === "string"
          ? finding.detail
          : typeof finding.summary === "string"
            ? finding.summary
            : safeJsonSummary(finding, 600) ?? "";
      lines.push(`### ${title}`, "", detail || "No detail provided.", "");
    });
  }

  params.sections.forEach((section) => {
    lines.push(`## ${section.heading}`, "", section.body, "");
  });

  return lines.join("\n").trim();
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

  const crawled = await crawlSite({
    rootUrl: input.rootUrl,
    pageLimit: input.pageLimit,
    depthLimit: input.depthLimit,
    stayWithinPath: input.stayWithinPath,
  });

  const asset = await createProjectAsset(params.supabase, {
    projectId: params.context.projectId,
    userId: params.context.userId,
    label: `crawl:${crawled.hostname}`,
    assetType: "crawl_snapshot",
    metadata: {
      rootUrl: crawled.rootUrl,
      pageLimit: input.pageLimit,
      depthLimit: input.depthLimit,
      pages: crawled.pages,
      toolSlug: params.candidate.toolSlug,
    },
  });

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Crawled ${crawled.pages.length} page${crawled.pages.length === 1 ? "" : "s"} from ${crawled.hostname}.`,
    data: {
      rootUrl: crawled.rootUrl,
      pages: crawled.pages,
      asset,
    },
    logId: null,
  };
}

async function executeSitemapRobotsAudit(
  params: InternalExecutorParams,
): Promise<ToolExecutionResult> {
  const input = sitemapRobotsAuditInputSchema.parse(params.input);
  const siteUrl = new URL(input.siteUrl);
  const robotsUrl = new URL("/robots.txt", siteUrl).toString();
  const robotsText = await fetchOptionalText(robotsUrl);
  const robots = parseRobotsDirectives(robotsText);
  const discoveredSitemaps = robots.sitemapUrls.length > 0
    ? robots.sitemapUrls
    : [new URL("/sitemap.xml", siteUrl).toString()];

  const queue = [...discoveredSitemaps];
  const visited = new Set<string>();
  const sitemapRecords: Array<Record<string, unknown>> = [];
  const pageUrls = new Set<string>();
  const malformedEntries: string[] = [];

  while (queue.length > 0 && sitemapRecords.length < input.sitemapLimit) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) {
      continue;
    }

    visited.add(sitemapUrl);
    const xml = await fetchOptionalText(sitemapUrl);
    if (!xml) {
      malformedEntries.push(sitemapUrl);
      continue;
    }

    const parsed = parseSitemapXml(xml);
    sitemapRecords.push({
      url: sitemapUrl,
      kind: parsed.kind,
      discoveredCount: parsed.urls.length,
    });

    if (parsed.kind === "index") {
      const childUrls = parsed.urls.slice(0, input.includeChildSitemaps ? input.sitemapLimit : 0);
      childUrls.forEach((url) => queue.push(url));
      continue;
    }

    parsed.urls.forEach((url) => pageUrls.add(url));
  }

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Audited robots.txt and ${sitemapRecords.length} sitemap file${sitemapRecords.length === 1 ? "" : "s"}.`,
    data: {
      siteUrl: siteUrl.origin,
      robotsUrl,
      robotsFound: Boolean(robotsText),
      blockedPaths: robots.blockedPaths,
      sitemapUrls: discoveredSitemaps,
      sitemapFiles: sitemapRecords,
      malformedEntries,
      coverageSummary: {
        sitemapFileCount: sitemapRecords.length,
        uniquePageUrlCount: pageUrls.size,
        blockedPathCount: robots.blockedPaths.length,
      },
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

async function resolveTableQueryRows(params: InternalExecutorParams, input: z.infer<typeof tableQueryInputSchema>) {
  if (input.csvContent) {
    return parseCsvContent(input.csvContent);
  }

  if (input.jsonRows?.length) {
    return normalizeTableRows(input.jsonRows);
  }

  if (!input.assetId) {
    return [];
  }

  if (!params.context.projectId) {
    throw new Error("table_query requires a project context when using assetId.");
  }

  const assets = await fetchProjectAssets(params.supabase, {
    projectId: params.context.projectId,
    userId: params.context.userId,
  });
  const asset = assets.find((candidate) => candidate.id === input.assetId);
  if (!asset) {
    throw new Error("Unable to find the requested asset for table_query.");
  }

  const content = await readAssetText(asset);
  return asset.assetType.toLowerCase().includes("json")
    ? normalizeTableRows(JSON.parse(content) as Array<Record<string, unknown>>)
    : parseCsvContent(content);
}

async function executeTableQuery(params: InternalExecutorParams): Promise<ToolExecutionResult> {
  const input = tableQueryInputSchema.parse(params.input);
  const rows = await resolveTableQueryRows(params, input);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const limitedRows = rows.slice(0, input.rowLimit);
  const filterColumn = input.filterColumn;
  const filteredRows =
    filterColumn && input.filterValue !== undefined
      ? rows.filter((row) => String(row[filterColumn] ?? "") === input.filterValue)
      : rows;

  let result: Record<string, unknown>;
  switch (input.operation) {
    case "filter":
      result = {
        rows: filteredRows.slice(0, input.rowLimit),
        rowCount: filteredRows.length,
      };
      break;
    case "group_count": {
      const key = input.groupBy ?? columns[0] ?? "value";
      const grouped = Object.entries(
        filteredRows.reduce<Record<string, number>>((accumulator, row) => {
          const value = String(row[key] ?? "");
          accumulator[value] = (accumulator[value] ?? 0) + 1;
          return accumulator;
        }, {}),
      ).map(([group, count]) => ({ group, count }));
      result = {
        groupBy: key,
        groups: grouped.slice(0, input.rowLimit),
      };
      break;
    }
    case "summary": {
      const metricColumn = input.metricColumn ?? columns[0] ?? "";
      const numericValues = filteredRows
        .map((row) => Number(row[metricColumn] ?? NaN))
        .filter((value) => Number.isFinite(value));
      result = {
        metricColumn,
        rowCount: filteredRows.length,
        numericRowCount: numericValues.length,
        min: numericValues.length > 0 ? Math.min(...numericValues) : null,
        max: numericValues.length > 0 ? Math.max(...numericValues) : null,
        average:
          numericValues.length > 0
            ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
            : null,
      };
      break;
    }
    case "inspect":
    default:
      result = {
        rowCount: rows.length,
        columns,
        previewRows: limitedRows,
      };
      break;
  }

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Queried ${rows.length} table row${rows.length === 1 ? "" : "s"}.`,
    data: {
      operation: input.operation,
      columns,
      result,
    },
    logId: null,
  };
}

async function executeSerpSnapshot(params: InternalExecutorParams): Promise<ToolExecutionResult> {
  const input = serpSnapshotInputSchema.parse(params.input);
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

  const extractedPages = await Promise.all(
    results.slice(0, input.resultLimit).map(async (result) => {
      try {
        return await extractPage(result.url, "metadata_only");
      } catch {
        return null;
      }
    }),
  );
  const validPages = extractedPages.filter((page): page is NonNullable<typeof page> => Boolean(page));
  const intents = {
    pricing: validPages.filter((page) => /pricing|plan|cost/i.test(`${page.title} ${page.finalUrl}`)).length,
    blog: validPages.filter((page) => /blog|article|news/i.test(page.finalUrl)).length,
    docs: validPages.filter((page) => /docs|guide|help/i.test(page.finalUrl)).length,
    homepage: validPages.filter((page) => new URL(page.finalUrl).pathname === "/").length,
  };

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Captured a SERP snapshot for ${results.length} result${results.length === 1 ? "" : "s"}.`,
    data: {
      query: input.query,
      results,
      pageDetails: validPages.map((page) => ({
        url: page.finalUrl,
        title: page.title,
        h1: page.h1,
        h2: page.h2.slice(0, 5),
      })),
      summary: {
        titlePatterns: validPages.map((page) => page.title).filter(Boolean).slice(0, input.resultLimit),
        commonHeadings: validPages.flatMap((page) => page.h1).slice(0, 12),
        intents,
      },
    },
    logId: null,
  };
}

async function executeCompetitorCompare(
  params: InternalExecutorParams,
): Promise<ToolExecutionResult> {
  const input = competitorCompareInputSchema.parse(params.input);
  const discoveredUrls =
    input.urls.length > 0
      ? input.urls
      : await searchWithTavily({
          query: input.query ?? "",
          domainFilters: [],
          resultLimit: input.resultLimit,
        }).then((results) => results?.map((result) => result.url) ?? []);

  if (discoveredUrls.length === 0) {
    return {
      status: "failed",
      toolSlug: params.candidate.toolSlug,
      toolkitSlug: params.candidate.toolkitSlug,
      message: "No competitor URLs were available to compare.",
      data: null,
      logId: null,
    };
  }

  const pages = await Promise.all(
    discoveredUrls.slice(0, input.resultLimit).map(async (url) => {
      try {
        return await extractPage(url, "standard");
      } catch {
        return null;
      }
    }),
  );
  const validPages = pages.filter((page): page is NonNullable<typeof page> => Boolean(page));

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Compared ${validPages.length} competitor page${validPages.length === 1 ? "" : "s"}.`,
    data: {
      comparisonFocus: input.comparisonFocus,
      pages: validPages.map((page) => ({
        url: page.finalUrl,
        title: page.title,
        description: page.description,
        h1: page.h1,
        primaryCtas: extractCallsToAction(page.textContent),
        pageType: inferPageType(page.finalUrl),
      })),
      summary: {
        focus: input.comparisonFocus || "general messaging and structure",
        commonThemes: validPages.flatMap((page) => page.h1).slice(0, 12),
        ctaPatterns: Array.from(
          new Set(validPages.flatMap((page) => extractCallsToAction(page.textContent))),
        ),
      },
    },
    logId: null,
  };
}

async function executeContentInventory(
  params: InternalExecutorParams,
): Promise<ToolExecutionResult> {
  const input = contentInventoryInputSchema.parse(params.input);
  const crawled = await crawlSite({
    rootUrl: input.rootUrl,
    pageLimit: input.pageLimit,
    depthLimit: input.depthLimit,
    stayWithinPath: input.stayWithinPath,
  });

  const enriched = await Promise.all(
    crawled.pages.map(async (page) => {
      try {
        const extracted = await extractPage(page.url, "standard");
        return {
          ...page,
          textLength: extracted.textContent.length,
          pageType: inferPageType(page.url),
        };
      } catch {
        return {
          ...page,
          textLength: 0,
          pageType: inferPageType(page.url),
        };
      }
    }),
  );

  const thinPages = enriched.filter((page) => page.textLength < input.thinContentThreshold);
  const duplicateHashes = Object.entries(
    enriched.reduce<Record<string, string[]>>((accumulator, page) => {
      if (!page.contentHash) {
        return accumulator;
      }
      accumulator[page.contentHash] = [...(accumulator[page.contentHash] ?? []), page.url];
      return accumulator;
    }, {}),
  )
    .filter(([, urls]) => urls.length > 1)
    .map(([contentHash, urls]) => ({ contentHash, urls }));

  const pageTypeCounts = Object.entries(
    enriched.reduce<Record<string, number>>((accumulator, page) => {
      accumulator[page.pageType] = (accumulator[page.pageType] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).map(([pageType, count]) => ({ pageType, count }));

  return {
    status: "succeeded",
    toolSlug: params.candidate.toolSlug,
    toolkitSlug: params.candidate.toolkitSlug,
    message: `Inventoried ${enriched.length} page${enriched.length === 1 ? "" : "s"}.`,
    data: {
      rootUrl: crawled.rootUrl,
      pages: enriched,
      summary: {
        pageTypeCounts,
        thinPages: thinPages.map((page) => ({ url: page.url, textLength: page.textLength })),
        duplicateGroups: duplicateHashes,
      },
    },
    logId: null,
  };
}

async function executeReportWriter(params: InternalExecutorParams): Promise<ToolExecutionResult> {
  const input = reportWriterInputSchema.parse(params.input);
  if (!params.context.projectId) {
    throw new Error("report_writer requires a project context.");
  }

  const content = renderReportMarkdown({
    title: input.title,
    reportType: input.reportType,
    summary: input.summary,
    findings: input.findings,
    sections: input.sections,
  });

  const asset = await createProjectAsset(params.supabase, {
    projectId: params.context.projectId,
    userId: params.context.userId,
    label: input.title,
    assetType: input.reportType,
    metadata: {
      content,
      summary: input.summary,
      contentHash: createContentHash(content),
      source: "internal_builtin",
      toolSlug: params.candidate.toolSlug,
    },
  });

  let memoryId: string | null = null;
  if (input.writeMemorySummary && input.summary.trim()) {
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
      content: content.slice(0, 4000),
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
    message: `Wrote report "${input.title}".`,
    data: {
      asset,
      memoryId,
      preview: content.slice(0, 1200),
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
  sitemap_robots_audit: executeSitemapRobotsAudit,
  table_query: executeTableQuery,
  serp_snapshot: executeSerpSnapshot,
  competitor_compare: executeCompetitorCompare,
  content_inventory: executeContentInventory,
  report_writer: executeReportWriter,
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
