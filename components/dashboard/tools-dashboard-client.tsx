"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BotIcon,
  BlocksIcon,
  CheckCircle2Icon,
  FileJsonIcon,
  ExternalLinkIcon,
  FlaskConicalIcon,
  KeyRoundIcon,
  Link2Icon,
  LoaderCircleIcon,
  PanelLeftIcon,
  SearchIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { notFound, usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useProject } from "@/components/providers/project-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceSidebarPanel } from "@/components/layout/workspace-layout";
import { dashboardQueryKeys, dashboardQueryTimings, fetchJson } from "@/lib/query/dashboard";
import { ensureRouteData, isNotFoundError } from "@/lib/query/http-error";
import type {
  ComposioToolCatalog,
  ComposioToolDetailRecord,
  ComposioToolkitRecord,
  InternalToolCatalog,
  InternalToolCatalogRecord,
  InternalToolDetailPayload,
  ProviderConnection,
  ToolExecutionResult,
  ToolkitConnectionStatus,
} from "@/lib/tools/types";
import { cn } from "@/lib/utils";

const TOOLS_CATALOG_STORAGE_KEY = "autobot-tools-catalog";

function ToolsSplitLayout({
  sidebar,
  content,
}: {
  sidebar: React.ReactNode;
  content: React.ReactNode;
}) {
  return (
    <section className="flex h-full min-h-0 min-w-full flex-1 flex-col gap-2 overflow-hidden lg:grid lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
      {sidebar}
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">{content}</div>
    </section>
  );
}

type ToolkitToolsPayload = {
  toolkitSlug: string;
  generatedAt: string;
  toolCount: number;
  tools: ComposioToolDetailRecord[];
};

type StartConnectionResponse = {
  redirectUrl: string | null;
};

type SaveApiKeyResponse = {
  connection: ProviderConnection;
  verified: boolean;
};

type InvokeInternalToolResponse = ToolExecutionResult;

async function fetchComposioToolCatalog() {
  return fetchJson<ComposioToolCatalog>("/api/tools", {
    cache: "no-store",
  });
}

async function fetchInternalToolCatalog(projectId?: string | null) {
  const search = projectId ? `?projectId=${projectId}` : "";
  return fetchJson<InternalToolCatalog>(`/api/tools/internal${search}`, {
    cache: "no-store",
  });
}

async function fetchInternalToolDetail(toolSlug: string, projectId?: string | null) {
  const search = projectId ? `?projectId=${projectId}` : "";
  return fetchJson<InternalToolDetailPayload>(`/api/tools/internal/${toolSlug}${search}`, {
    cache: "no-store",
  });
}

async function updateInternalToolEnablement({
  toolSlug,
  projectId,
  isEnabled,
}: {
  toolSlug: string;
  projectId: string;
  isEnabled: boolean;
}) {
  return fetchJson<InternalToolDetailPayload>(`/api/tools/internal/${toolSlug}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      isEnabled,
    }),
  });
}

async function invokeInternalTool({
  toolSlug,
  projectId,
  input,
  confirmedWriteActions,
}: {
  toolSlug: string;
  projectId?: string | null;
  input: Record<string, unknown>;
  confirmedWriteActions: boolean;
}) {
  return fetchJson<InvokeInternalToolResponse>(`/api/tools/internal/${toolSlug}/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      input,
      confirmedWriteActions,
    }),
  });
}

async function fetchToolkitTools(toolkitSlug: string) {
  return fetchJson<ToolkitToolsPayload>(`/api/tools/${toolkitSlug}`);
}

async function startToolkitConnection(toolkitSlug: string) {
  return fetchJson<StartConnectionResponse>("/api/composio/connections/start", {
    body: JSON.stringify({
      toolkitSlug,
      nextPath: `/dashboard/tools?toolkit=${toolkitSlug}`,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

async function saveToolkitApiKey({
  toolkitSlug,
  apiKey,
}: {
  toolkitSlug: string;
  apiKey: string;
}) {
  return fetchJson<SaveApiKeyResponse>("/api/composio/connections/api-key", {
    body: JSON.stringify({
      toolkitSlug,
      apiKey,
      authScheme: "API_KEY",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

function mergeConnectionIntoCatalog(
  catalog: ComposioToolCatalog | undefined,
  connection: ProviderConnection,
) {
  if (!catalog) {
    return catalog;
  }

  return {
    ...catalog,
    toolkits: catalog.toolkits.map((toolkit) =>
      toolkit.slug === connection.toolkitSlug
        ? {
            ...toolkit,
            connectionStatus: connection.status,
            connectionAuthScheme: connection.authScheme,
            apiKeyLastFour: connection.apiKeyLastFour,
            apiKeyUpdatedAt: connection.apiKeyUpdatedAt,
          }
        : toolkit,
    ),
  };
}

function readStoredCatalogSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(TOOLS_CATALOG_STORAGE_KEY);
    if (!value) {
      return null;
    }

    return normalizeCatalog(JSON.parse(value) as ComposioToolCatalog);
  } catch {
    return null;
  }
}

function ToolkitToolsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="border bg-card p-4" key={index}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function persistCatalogSnapshot(catalog: ComposioToolCatalog | null) {
  if (typeof window === "undefined" || !catalog) {
    return;
  }

  try {
    window.localStorage.setItem(TOOLS_CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch {}
}

function normalizeCatalog(catalog: ComposioToolCatalog | undefined): ComposioToolCatalog | null {
  if (!catalog) {
    return null;
  }

  const toolkits = Array.isArray(catalog.toolkits)
    ? catalog.toolkits.map((toolkit) => ({
        ...toolkit,
        authSchemes: Array.isArray(toolkit.authSchemes)
          ? Array.from(new Set(toolkit.authSchemes))
          : [],
        categories: Array.isArray(toolkit.categories)
          ? Array.from(
              new Map(
                toolkit.categories.map((category) => [
                  `${category.id}:${category.name}`,
                  category,
                ]),
              ).values(),
            )
          : [],
      }))
    : [];

  const categories = Array.isArray(catalog.categories) ? catalog.categories : [];

  return {
    ...catalog,
    categories,
    toolkits,
  };
}

function normalizeInternalCatalog(catalog: InternalToolCatalog | undefined) {
  if (!catalog) {
    return null;
  }

  return {
    ...catalog,
    tools: Array.isArray(catalog.tools) ? catalog.tools : [],
  } satisfies InternalToolCatalog;
}

function matchesInternalToolSearch(tool: InternalToolCatalogRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    tool.title,
    tool.slug,
    tool.description,
    tool.executorKey,
    tool.source,
    ...tool.tags,
    ...tool.capabilities,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getInternalToolStatusMeta(tool: InternalToolCatalogRecord) {
  return {
    label: tool.projectEnabled ? "Enabled" : "Disabled",
    tone: tool.projectEnabled ? "text-foreground" : "text-muted-foreground",
    variant: tool.projectEnabled ? ("secondary" as const) : ("outline" as const),
  };
}

function getInternalToolScopeLabel(tool: InternalToolCatalogRecord) {
  const companyKey =
    typeof tool.metadata.companyKey === "string" && tool.metadata.companyKey.trim().length > 0
      ? tool.metadata.companyKey
      : null;
  const projectIds = Array.isArray(tool.metadata.projectIds)
    ? tool.metadata.projectIds.filter((value): value is string => typeof value === "string")
    : [];

  if (tool.source === "internal_builtin") {
    return "First-party";
  }

  if (projectIds.length > 0) {
    return "Project scoped";
  }

  if (companyKey) {
    return "Company scoped";
  }

  return "Custom";
}

function getInternalToolSampleInput(toolSlug: string) {
  switch (toolSlug) {
    case "page_extractor":
      return {
        url: "https://example.com",
        extractionMode: "standard",
      };
    case "web_search":
      return {
        query: "best llm observability platforms",
        domainFilters: [],
        resultLimit: 5,
      };
    case "artifact_store":
      return {
        label: "Internal tool smoke test",
        assetType: "test_note",
        content: "This is a stored artifact created from the internal tools dashboard.",
        metadata: {
          source: "tools-dashboard",
        },
        writeMemorySummary: false,
        summary: "",
      };
    case "site_crawler":
      return {
        rootUrl: "https://example.com",
        pageLimit: 5,
        depthLimit: 1,
        stayWithinPath: true,
      };
    case "document_search":
      return {
        query: "project brief",
        resultLimit: 5,
        includeMemory: true,
      };
    case "sitemap_robots_audit":
      return {
        siteUrl: "https://example.com",
        includeChildSitemaps: true,
        sitemapLimit: 5,
      };
    case "table_query":
      return {
        csvContent: "company,visits,region\nAcme,42,APAC\nBeta,17,EMEA\nAcme,30,APAC",
        operation: "group_count",
        groupBy: "company",
        rowLimit: 10,
      };
    case "serp_snapshot":
      return {
        query: "best llm observability platforms",
        domainFilters: [],
        resultLimit: 5,
      };
    case "competitor_compare":
      return {
        urls: ["https://example.com", "https://example.org"],
        comparisonFocus: "homepage messaging and calls to action",
        resultLimit: 2,
      };
    case "content_inventory":
      return {
        rootUrl: "https://example.com",
        pageLimit: 5,
        depthLimit: 1,
        stayWithinPath: true,
        thinContentThreshold: 250,
      };
    case "report_writer":
      return {
        title: "Internal tool smoke test report",
        reportType: "analysis_report",
        summary: "A short summary created from the tools dashboard.",
        findings: [
          {
            title: "Example finding",
            detail: "This is a sample finding included in the generated report.",
          },
        ],
        sections: [
          {
            heading: "Recommendation",
            body: "Turn this into a reusable report artifact for the project.",
          },
        ],
        writeMemorySummary: false,
      };
    default:
      return {};
  }
}

function toolNeedsProjectContext(toolSlug: string) {
  return ["artifact_store", "site_crawler", "document_search", "report_writer"].includes(toolSlug);
}

export function ToolsDashboardSkeleton() {
  return (
    <ToolsSplitLayout
      sidebar={
        <WorkspaceSidebarPanel
          className="min-h-[260px] max-h-[40vh] sm:min-h-[320px] sm:max-h-[45vh] lg:min-h-0 lg:max-h-none"
          description="Search and browse toolkit categories."
          headerAction={
            <div className="relative">
              <Skeleton className="h-10 w-full" />
            </div>
          }
          headerActionFullWidth
          title="Categories"
        >
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton className="h-12 w-full" key={index} />
            ))}
          </div>
        </WorkspaceSidebarPanel>
      }
      content={
        <div className="flex h-full min-h-0 flex-col overflow-hidden border bg-background">
          <div className="border-b px-4 py-4">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-3 h-4 w-3/4" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="border bg-card p-4" key={index}>
                    <Skeleton className="size-12" />
                    <Skeleton className="mt-3 h-5 w-32" />
                    <Skeleton className="mt-3 h-4 w-full" />
                    <Skeleton className="mt-2 h-4 w-3/4" />
                  </div>
                ))}
              </div>
              <div className="border bg-card p-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </div>
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="border bg-card p-4" key={`tool-${index}`}>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
}

function getConnectionPresentation(toolkit: ComposioToolkitRecord) {
  if (toolkit.noAuth) {
    return {
      badgeVariant: "secondary" as const,
      ctaLabel: null,
      label: "No auth required",
      tone: "text-muted-foreground",
    };
  }

  if (toolkit.supportsApiKey && toolkit.apiKeyUpdatedAt && toolkit.connectionStatus !== "active") {
    return {
      badgeVariant: "outline" as const,
      ctaLabel: toolkit.supportsOAuth ? "Connect" : "Update API Key",
      label: "API key saved",
      tone: "text-muted-foreground",
    };
  }

  if (toolkit.supportsApiKey && !toolkit.supportsOAuth) {
    return {
      badgeVariant: toolkit.connectionStatus === "active" ? "secondary" as const : "outline" as const,
      ctaLabel: toolkit.connectionStatus === "active" ? "Update API Key" : "API Key",
      label:
        toolkit.connectionStatus === "active"
          ? "Connected"
          : toolkit.apiKeyUpdatedAt
            ? "API key saved"
            : "Not connected",
      tone: toolkit.connectionStatus === "active" ? "text-foreground" : "text-muted-foreground",
    };
  }

  switch (toolkit.connectionStatus) {
    case "active":
      return {
        badgeVariant: "secondary" as const,
        ctaLabel: "Reconnect",
        label: "Connected",
        tone: "text-foreground",
      };
    case "initiated":
      return {
        badgeVariant: "outline" as const,
        ctaLabel: "Continue",
        label: "Connection started",
        tone: "text-muted-foreground",
      };
    case "expired":
      return {
        badgeVariant: "destructive" as const,
        ctaLabel: "Reconnect",
        label: "Expired",
        tone: "text-destructive",
      };
    case "failed":
      return {
        badgeVariant: "destructive" as const,
        ctaLabel: "Retry",
        label: "Needs attention",
        tone: "text-destructive",
      };
    case "disabled":
      return {
        badgeVariant: "destructive" as const,
        ctaLabel: "Reconnect",
        label: "Disabled",
        tone: "text-destructive",
      };
    default:
      return {
        badgeVariant: "outline" as const,
        ctaLabel: "Connect",
        label: "Not connected",
        tone: "text-muted-foreground",
      };
  }
}

function getStatusIcon(status: ToolkitConnectionStatus, noAuth: boolean) {
  if (noAuth) {
    return <ShieldCheckIcon className="size-3.5" />;
  }

  if (status === "active") {
    return <CheckCircle2Icon className="size-3.5" />;
  }

  if (status === "failed" || status === "expired" || status === "disabled") {
    return <XCircleIcon className="size-3.5" />;
  }

  return <Link2Icon className="size-3.5" />;
}

function matchesToolkitSearch(toolkit: ComposioToolkitRecord, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    toolkit.name,
    toolkit.slug,
    toolkit.description ?? "",
    ...toolkit.categories.map((category) => category.name),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function ToolkitLogo({
  toolkit,
}: {
  toolkit: ComposioToolkitRecord;
}) {
  if (toolkit.logoUrl) {
    return (
      <img
        alt={`${toolkit.name} logo`}
        className="size-12 shrink-0 border object-contain p-2"
        height={48}
        src={toolkit.logoUrl}
        width={48}
      />
    );
  }

  const fallbackCharacter = toolkit.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex size-12 shrink-0 items-center justify-center border bg-muted text-lg font-semibold text-foreground">
      <span aria-hidden="true">{fallbackCharacter}</span>
      <span className="sr-only">{toolkit.name}</span>
    </div>
  );
}

function buildToolsHref(
  pathname: string,
  options: {
    toolkitSlug?: string | null;
    internalToolSlug?: string | null;
    connection?: string | null;
    source?: "internal" | "composio" | null;
  } = {},
) {
  const params = new URLSearchParams();

  if (options.toolkitSlug) {
    params.set("toolkit", options.toolkitSlug);
  }

  if (options.internalToolSlug) {
    params.set("internalTool", options.internalToolSlug);
  }

  if (options.connection) {
    params.set("connection", options.connection);
  }

  if (options.source) {
    params.set("source", options.source);
  }

  return params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
}

function ToolkitConnectionControls({
  toolkit,
  connectMutation,
  onApiKey,
  onOAuth,
  layout = "inline",
}: {
  toolkit: ComposioToolkitRecord;
  connectMutation: ReturnType<typeof useMutation<StartConnectionResponse, Error, string>>;
  onApiKey: () => void;
  onOAuth: () => void;
  layout?: "inline" | "footer";
}) {
  function handleApiKeyClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onApiKey();
  }

  function handleOAuthClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onOAuth();
  }

  const connection = getConnectionPresentation(toolkit);
  const isConnected = toolkit.connectionStatus === "active" && !toolkit.noAuth;
  const canConnect = toolkit.supportsOAuth && !isConnected;
  const canSaveApiKey = toolkit.supportsApiKey && !isConnected;
  const apiKeyLabel =
    toolkit.apiKeyUpdatedAt || connection.ctaLabel === "Update API Key"
      ? "Update API Key"
      : "API Key";
  const statusCopy = toolkit.noAuth ? null : (
    <div className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      {getStatusIcon(toolkit.connectionStatus, toolkit.noAuth)}
      <span className="truncate">{connection.label}</span>
    </div>
  );

  if (layout === "footer") {
    return (
      <div className="flex flex-col items-stretch gap-2">
        {statusCopy}
        {canSaveApiKey ? (
          <Button onClick={handleApiKeyClick} size="sm" type="button" variant="outline">
            <KeyRoundIcon className="size-3.5" />
            {apiKeyLabel}
          </Button>
        ) : null}
        {canConnect ? (
          <Button onClick={handleOAuthClick} size="sm" type="button">
            {connectMutation.isPending && connectMutation.variables === toolkit.slug ? (
              <>
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Connecting
              </>
            ) : (
              "Connect"
            )}
          </Button>
        ) : null}
        {isConnected ? (
          <Button disabled size="sm" type="button" variant="secondary">
            <CheckCircle2Icon className="size-3.5" />
            Connected
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
      {statusCopy}
      {(canConnect || canSaveApiKey) ? (
        <div className="flex shrink-0 items-center gap-2">
          {canConnect ? (
            <Button onClick={handleOAuthClick} size="sm" type="button">
              {connectMutation.isPending && connectMutation.variables === toolkit.slug ? (
                <>
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  Connecting
                </>
              ) : (
                connection.ctaLabel && toolkit.supportsApiKey ? "Connect" : connection.ctaLabel
              )}
            </Button>
          ) : null}
          {canSaveApiKey ? (
            <Button onClick={handleApiKeyClick} size="sm" type="button" variant="outline">
              <KeyRoundIcon className="size-3.5" />
              {apiKeyLabel}
            </Button>
          ) : null}
        </div>
      ) : isConnected ? (
        <Button disabled size="sm" type="button" variant="secondary">
          <CheckCircle2Icon className="size-3.5" />
          Connected
        </Button>
      ) : null}
    </div>
  );
}

export function ToolsDashboardClient({
  initialCatalog,
}: {
  initialCatalog?: ComposioToolCatalog;
}) {
  const { activeProjectDisplay, activeProjectId, isLoading: isProjectLoading } = useProject();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [storedCatalog] = useState<ComposioToolCatalog | null>(() => readStoredCatalogSnapshot());
  const [toolSourceTab, setToolSourceTab] = useState<"internal" | "composio">(
    (searchParams.get("source") as "internal" | "composio" | null) ?? "internal",
  );
  const [internalSearch, setInternalSearch] = useState("");
  const [composioSearch, setComposioSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [openToolkitSlug, setOpenToolkitSlug] = useState<string>(
    searchParams.get("toolkit") ?? "",
  );
  const [openInternalToolSlug, setOpenInternalToolSlug] = useState<string>(
    searchParams.get("internalTool") ?? "",
  );
  const [apiKeyDialogToolkitSlug, setApiKeyDialogToolkitSlug] = useState<string>("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [internalInputValue, setInternalInputValue] = useState("{}");
  const [allowWriteExecution, setAllowWriteExecution] = useState(false);
  const [internalExecutionResult, setInternalExecutionResult] = useState<string>("");
  const deferredInternalSearch = useDeferredValue(internalSearch.trim().toLowerCase());
  const deferredComposioSearch = useDeferredValue(composioSearch.trim().toLowerCase());
  const connectionResult = searchParams.get("connection");

  const catalogQuery = useQuery({
    queryKey: dashboardQueryKeys.tools.catalog,
    queryFn: fetchComposioToolCatalog,
    ...((initialCatalog ?? storedCatalog)
      ? {
          initialData: initialCatalog ?? storedCatalog ?? undefined,
          initialDataUpdatedAt: new Date((initialCatalog ?? storedCatalog)!.generatedAt).getTime(),
        }
      : {}),
    staleTime: dashboardQueryTimings.tools.staleTime,
  });

  const catalog = normalizeCatalog(catalogQuery.data);
  const internalCatalogQuery = useQuery({
    queryKey: dashboardQueryKeys.tools.internalCatalog(activeProjectId),
    queryFn: () => fetchInternalToolCatalog(activeProjectId),
    staleTime: dashboardQueryTimings.tools.staleTime,
  });
  const internalCatalog = normalizeInternalCatalog(internalCatalogQuery.data);

  useEffect(() => {
    persistCatalogSnapshot(catalog);
  }, [catalog]);

  const filteredToolkits = useMemo(() => {
    if (!catalog) {
      return [];
    }

    return catalog.toolkits.filter((toolkit) => matchesToolkitSearch(toolkit, deferredComposioSearch));
  }, [catalog, deferredComposioSearch]);

  const visibleCategories = useMemo(() => {
    if (!catalog) {
      return [];
    }

    return catalog.categories
      .map((category) => {
        const toolkitCount = filteredToolkits.filter((toolkit) =>
          toolkit.categories.some((toolkitCategory) => toolkitCategory.id === category.id),
        ).length;

        return {
          ...category,
          toolkitCount,
        };
      })
      .filter((category) => category.toolkitCount > 0);
  }, [catalog, filteredToolkits]);

  useEffect(() => {
    if (visibleCategories.length === 0) {
      if (selectedCategoryId !== "") {
        setSelectedCategoryId("");
      }
      return;
    }

    if (!visibleCategories.some((category) => category.id === selectedCategoryId)) {
      startTransition(() => {
        setSelectedCategoryId(visibleCategories[0]?.id ?? "");
      });
    }
  }, [selectedCategoryId, visibleCategories]);

  const toolkitOptions = useMemo(() => {
    const matchingToolkits = !selectedCategoryId
      ? filteredToolkits
      : filteredToolkits.filter((toolkit) =>
          toolkit.categories.some((category) => category.id === selectedCategoryId),
        );

    return matchingToolkits.toSorted(
      (left, right) => right.toolCount - left.toolCount || left.name.localeCompare(right.name),
    );
  }, [filteredToolkits, selectedCategoryId]);

  const internalToolOptions = useMemo(() => {
    if (!internalCatalog) {
      return [];
    }

    return internalCatalog.tools
      .filter((tool) => matchesInternalToolSearch(tool, deferredInternalSearch))
      .toSorted((left, right) => left.title.localeCompare(right.title));
  }, [deferredInternalSearch, internalCatalog]);

  const selectedToolkit =
    catalog?.toolkits.find((toolkit) => toolkit.slug === openToolkitSlug) ?? null;
  const selectedInternalTool =
    internalCatalog?.tools.find((tool) => tool.slug === openInternalToolSlug) ?? null;

  const apiKeyDialogToolkit =
    catalog?.toolkits.find((toolkit) => toolkit.slug === apiKeyDialogToolkitSlug) ?? null;

  const toolsQuery = useQuery({
    queryKey: dashboardQueryKeys.tools.toolkit(openToolkitSlug),
    queryFn: () => fetchToolkitTools(openToolkitSlug),
    enabled: Boolean(openToolkitSlug),
    staleTime: dashboardQueryTimings.tools.staleTime,
  });
  const internalToolQuery = useQuery({
    queryKey: dashboardQueryKeys.tools.internalTool(openInternalToolSlug, activeProjectId),
    queryFn: () => fetchInternalToolDetail(openInternalToolSlug, activeProjectId),
    enabled: Boolean(openInternalToolSlug),
    staleTime: dashboardQueryTimings.tools.staleTime,
  });

  const connectMutation = useMutation({
    mutationFn: startToolkitConnection,
    onSuccess: (payload, toolkitSlug) => {
      const toolkitName =
        catalog?.toolkits.find((toolkit) => toolkit.slug === toolkitSlug)?.name ?? toolkitSlug;

      if (payload.redirectUrl) {
        toast.success(`Redirecting to ${toolkitName} to finish connecting.`);
        window.location.href = payload.redirectUrl;
        return;
      }

      toast.success(`${toolkitName} connection updated.`);
      void queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.tools.catalog,
      });
    },
    onError: (error, toolkitSlug) => {
      const toolkitName =
        catalog?.toolkits.find((toolkit) => toolkit.slug === toolkitSlug)?.name ?? toolkitSlug;
      toast.error(
        error instanceof Error ? error.message : `Unable to connect ${toolkitName}.`,
      );
    },
  });

  const apiKeyMutation = useMutation({
    mutationFn: saveToolkitApiKey,
    onSuccess: async (result, variables) => {
      queryClient.setQueryData<ComposioToolCatalog | undefined>(
        dashboardQueryKeys.tools.catalog,
        (current) => mergeConnectionIntoCatalog(current, result.connection),
      );
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.tools.catalog,
      });
      setApiKeyValue("");
      setApiKeyDialogToolkitSlug("");
      const toolkitName =
        catalog?.toolkits.find((toolkit) => toolkit.slug === variables.toolkitSlug)?.name ??
        variables.toolkitSlug;
      toast.success(`${toolkitName} API key saved.`);
    },
    onError: (error, variables) => {
      const toolkitName =
        catalog?.toolkits.find((toolkit) => toolkit.slug === variables.toolkitSlug)?.name ??
        variables.toolkitSlug;
      toast.error(
        error instanceof Error ? error.message : `Unable to save API key for ${toolkitName}.`,
      );
    },
  });
  const internalEnablementMutation = useMutation({
    mutationFn: updateInternalToolEnablement,
    onMutate: async (variables) => {
      const catalogKey = dashboardQueryKeys.tools.internalCatalog(activeProjectId);
      const detailKey = dashboardQueryKeys.tools.internalTool(variables.toolSlug, activeProjectId);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: catalogKey }),
        queryClient.cancelQueries({ queryKey: detailKey }),
      ]);

      const previousCatalog = queryClient.getQueryData<InternalToolCatalog>(catalogKey);
      const previousDetail = queryClient.getQueryData<InternalToolDetailPayload>(detailKey);

      queryClient.setQueryData<InternalToolCatalog | undefined>(catalogKey, (current) =>
        current
          ? {
              ...current,
              tools: current.tools.map((tool) =>
                tool.slug === variables.toolSlug
                  ? {
                      ...tool,
                      projectEnabled: variables.isEnabled,
                    }
                  : tool,
              ),
            }
          : current,
      );
      queryClient.setQueryData<InternalToolDetailPayload | undefined>(detailKey, (current) =>
        current
          ? {
              ...current,
              tool: {
                ...current.tool,
                projectEnabled: variables.isEnabled,
              },
            }
          : current,
      );

      return {
        previousCatalog,
        previousDetail,
      };
    },
    onSuccess: async (payload) => {
      queryClient.setQueryData<InternalToolCatalog | undefined>(
        dashboardQueryKeys.tools.internalCatalog(activeProjectId),
        (current) =>
          current
            ? {
                ...current,
                tools: current.tools.map((tool) =>
                  tool.slug === payload.tool.slug ? payload.tool : tool,
                ),
              }
            : current,
      );
      queryClient.setQueryData<InternalToolDetailPayload | undefined>(
        dashboardQueryKeys.tools.internalTool(payload.tool.slug, activeProjectId),
        payload,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.tools.internalCatalog(activeProjectId),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.tools.internalTool(payload.tool.slug, activeProjectId),
        }),
      ]);
      toast.success(`${payload.tool.title} ${payload.tool.projectEnabled ? "enabled" : "disabled"} for ${activeProjectDisplay?.name ?? "this project"}.`);
    },
    onError: (error, variables, context) => {
      if (context?.previousCatalog) {
        queryClient.setQueryData(
          dashboardQueryKeys.tools.internalCatalog(activeProjectId),
          context.previousCatalog,
        );
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          dashboardQueryKeys.tools.internalTool(variables.toolSlug, activeProjectId),
          context.previousDetail,
        );
      }
      toast.error(error instanceof Error ? error.message : "Unable to update tool settings.");
    },
  });
  const internalInvokeMutation = useMutation({
    mutationFn: invokeInternalTool,
    onSuccess: (result) => {
      setInternalExecutionResult(JSON.stringify(result, null, 2));
      toast.success("Internal tool executed.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to execute internal tool.");
    },
  });

  function handleToolkitAction(toolkit: ComposioToolkitRecord, mode: "oauth" | "api_key") {
    if (mode === "api_key") {
      setApiKeyValue("");
      setApiKeyDialogToolkitSlug(toolkit.slug);
      return;
    }

    connectMutation.mutate(toolkit.slug);
  }

  useEffect(() => {
    if (!selectedInternalTool) {
      return;
    }

    setInternalInputValue(JSON.stringify(getInternalToolSampleInput(selectedInternalTool.slug), null, 2));
    setAllowWriteExecution(false);
    setInternalExecutionResult("");
  }, [selectedInternalTool]);

  useEffect(() => {
    if (!connectionResult) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: dashboardQueryKeys.tools.catalog,
    });

    if (openToolkitSlug) {
      void queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.tools.toolkit(openToolkitSlug),
      });
    }

    startTransition(() => {
      router.replace(
        buildToolsHref(pathname, {
          toolkitSlug: openToolkitSlug,
          internalToolSlug: openInternalToolSlug,
          source: toolSourceTab,
        }),
        { scroll: false },
      );
    });
  }, [connectionResult, openInternalToolSlug, openToolkitSlug, pathname, queryClient, router, toolSourceTab]);

  if (catalogQuery.error && !catalogQuery.isLoading && !catalogQuery.isFetching && !catalog) {
    throw catalogQuery.error;
  }

  if (
    internalCatalogQuery.error &&
    !internalCatalogQuery.isLoading &&
    !internalCatalogQuery.isFetching &&
    !internalCatalog
  ) {
    if (isNotFoundError(internalCatalogQuery.error)) {
      notFound();
    }

    throw internalCatalogQuery.error;
  }

  if (openToolkitSlug && catalog && !selectedToolkit) {
    notFound();
  }

  if (openInternalToolSlug && internalCatalog && !selectedInternalTool) {
    notFound();
  }

  if (
    toolsQuery.error &&
    !toolsQuery.isLoading &&
    !toolsQuery.isFetching &&
    !toolsQuery.data
  ) {
    if (isNotFoundError(toolsQuery.error)) {
      notFound();
    }

    throw toolsQuery.error;
  }

  if (
    internalToolQuery.error &&
    !internalToolQuery.isLoading &&
    !internalToolQuery.isFetching &&
    !internalToolQuery.data
  ) {
    if (isNotFoundError(internalToolQuery.error)) {
      notFound();
    }

    throw internalToolQuery.error;
  }

  if (openToolkitSlug && !toolsQuery.isLoading && !toolsQuery.isFetching) {
    ensureRouteData(toolsQuery.data, "Tool details are unavailable.");
  }

  if (openInternalToolSlug && !internalToolQuery.isLoading && !internalToolQuery.isFetching) {
    ensureRouteData(internalToolQuery.data, "Internal tool details are unavailable.");
  }

  if (catalogQuery.isLoading) {
    return <ToolsDashboardSkeleton />;
  }

  const selectedCategoryName =
    visibleCategories.find((category) => category.id === selectedCategoryId)?.name ?? "Toolkits";

  const categorySearchField = (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        onChange={(event) => setComposioSearch(event.target.value)}
        placeholder="Search integrations"
        value={composioSearch}
      />
    </div>
  );

  const internalSearchField = (
    <div className="relative w-full max-w-sm">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        onChange={(event) => setInternalSearch(event.target.value)}
        placeholder="Search internal tools"
        value={internalSearch}
      />
    </div>
  );

  const categoryList = (
    <>
      {catalogQuery.error instanceof Error ? (
        <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {catalogQuery.error.message}
        </div>
      ) : null}

      {visibleCategories.length > 0 ? (
        <div className="space-y-2 pb-1">
          {visibleCategories.map((category) => (
            <Button
              className={cn(
                "h-auto w-full cursor-pointer justify-between border px-4 py-3 text-left text-sm transition-colors",
                selectedCategoryId === category.id
                  ? "border-primary bg-muted text-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
              key={category.id}
              onClick={() => {
                setSelectedCategoryId(category.id);
                setIsCategoryDrawerOpen(false);
              }}
              type="button"
              variant="ghost"
            >
              <span className="truncate">{category.name}</span>
              <span className="ml-3 shrink-0 text-xs text-muted-foreground">{category.toolkitCount}</span>
            </Button>
          ))}
        </div>
      ) : null}
    </>
  );

  const internalSheetTool = internalToolQuery.data?.tool ?? selectedInternalTool;
  const internalMetaBadgeClassName =
    "h-5 rounded-sm border-border/70 px-2 text-[11px] font-normal tracking-normal text-muted-foreground";
  const internalCapabilityBadgeClassName =
    "h-6 rounded-sm border-border/70 bg-muted/40 px-2.5 text-[11px] font-medium text-foreground";

  return (
    <>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setApiKeyDialogToolkitSlug("");
            setApiKeyValue("");
          }
        }}
        open={Boolean(apiKeyDialogToolkit)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{apiKeyDialogToolkit?.name ?? "API Key"}</DialogTitle>
            <DialogDescription>
              Save an API key for this toolkit. The key will be encrypted before it is stored and will not be shown again after save.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="tool-api-key">
              API key
            </label>
            <Input
              autoComplete="off"
              id="tool-api-key"
              onChange={(event) => setApiKeyValue(event.target.value)}
              placeholder="Paste your API key"
              type="password"
              value={apiKeyValue}
            />
            {apiKeyDialogToolkit?.authSchemes.length ? (
              <p className="text-xs text-muted-foreground">
                Supported auth schemes: {apiKeyDialogToolkit.authSchemes.join(", ")}
              </p>
            ) : null}
            {apiKeyMutation.error instanceof Error ? (
              <p className="text-xs text-destructive">{apiKeyMutation.error.message}</p>
            ) : null}
          </div>

          <DialogFooter showCloseButton>
            <Button
              disabled={apiKeyMutation.isPending || apiKeyValue.trim().length === 0 || !apiKeyDialogToolkit}
              onClick={() => {
                if (!apiKeyDialogToolkit) {
                  return;
                }

                apiKeyMutation.mutate({
                  toolkitSlug: apiKeyDialogToolkit.slug,
                  apiKey: apiKeyValue.trim(),
                });
              }}
            >
              {apiKeyMutation.isPending ? (
                <>
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  Saving
                </>
              ) : (
                "Save API Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs
        className="min-h-0 flex-1"
        onValueChange={(value) => {
          const next = value as "internal" | "composio";
          setToolSourceTab(next);
          startTransition(() => {
            router.replace(
              buildToolsHref(pathname, {
                toolkitSlug: openToolkitSlug,
                internalToolSlug: openInternalToolSlug,
                source: next,
              }),
              { scroll: false },
            );
          });
        }}
        value={toolSourceTab}
      >
        <div className="flex items-center justify-between gap-3 border bg-background px-4 py-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tools</p>
            <h1 className="text-lg font-semibold">Tool sources</h1>
          </div>
          <TabsList>
            <TabsTrigger value="internal">
              <BotIcon className="size-3.5" />
              Internal
            </TabsTrigger>
            <TabsTrigger value="composio">
              <BlocksIcon className="size-3.5" />
              Composio
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent className="min-h-0 flex-1" value="internal">
          <div className="flex h-full min-h-0 flex-col overflow-hidden border bg-background">
            <div className="shrink-0 border-b px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold">First-party internal tools</h1>
                  <p className="text-sm text-muted-foreground">
                    Built-in AutoBot tools that work without external integrations.
                  </p>
                </div>
                {internalSearchField}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {internalCatalogQuery.isLoading || isProjectLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div className="border bg-card p-4" key={index}>
                      <Skeleton className="h-5 w-36" />
                      <Skeleton className="mt-3 h-4 w-full" />
                      <Skeleton className="mt-2 h-4 w-4/5" />
                    </div>
                  ))}
                </div>
              ) : internalCatalogQuery.error instanceof Error ? (
                <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {internalCatalogQuery.error.message}
                </div>
              ) : internalToolOptions.length === 0 ? (
                <div className="flex min-h-[240px] items-center justify-center border bg-background px-6 text-center">
                  <div className="space-y-3">
                    <BotIcon className="mx-auto size-10 text-muted-foreground" />
                      <div className="space-y-1">
                        <p className="font-medium">No matching internal tools</p>
                        <p className="text-sm text-muted-foreground">Try a different internal-tools search term.</p>
                      </div>
                    </div>
                  </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {internalToolOptions.map((tool) => {
                    const statusMeta = getInternalToolStatusMeta(tool);

                    return (
                      <Card
                        className="cursor-pointer border-border py-0 transition-colors hover:bg-muted"
                        key={tool.slug}
                        onClick={() => setOpenInternalToolSlug(tool.slug)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setOpenInternalToolSlug(tool.slug);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <CardContent className="flex h-[220px] flex-col p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex size-12 shrink-0 items-center justify-center border bg-muted">
                              <BotIcon className="size-5 text-foreground" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h2 className="truncate text-base font-semibold">{tool.title}</h2>
                                  <p className="mt-1 break-all text-xs text-muted-foreground">{tool.slug}</p>
                                </div>
                                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                              </div>
                              <p className="line-clamp-2 text-sm text-muted-foreground">{tool.description}</p>
                              <div className="flex flex-wrap gap-2">
                                <Badge className={internalMetaBadgeClassName} variant="outline">
                                  {tool.executionMode}
                                </Badge>
                                <Badge className={internalMetaBadgeClassName} variant="outline">
                                  {tool.source}
                                </Badge>
                                <Badge className={internalMetaBadgeClassName} variant="outline">
                                  {getInternalToolScopeLabel(tool)}
                                </Badge>
                                {tool.approvalPolicy === "confirm_writes" ? (
                                  <Badge className={internalMetaBadgeClassName} variant="outline">
                                    Approval required
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                            <div className="flex min-w-0 flex-wrap gap-1.5">
                              {tool.capabilities.slice(0, 2).map((capability) => (
                                <Badge
                                  className={internalCapabilityBadgeClassName}
                                  key={`${tool.slug}:${capability}`}
                                  variant="outline"
                                >
                                  {capability}
                                </Badge>
                              ))}
                            </div>
                            <Button
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenInternalToolSlug(tool.slug);
                              }}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              View
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent className="min-h-0 flex-1" value="composio">
          <>
            <ToolsSplitLayout
              sidebar={
                <WorkspaceSidebarPanel
                  className="hidden min-h-[260px] max-h-[40vh] sm:min-h-[320px] sm:max-h-[45vh] lg:flex lg:min-h-0 lg:max-h-none"
                  description="Choose a category to browse its toolkits."
                  headerAction={categorySearchField}
                  headerActionFullWidth
                  title="Categories"
                >
                  {categoryList}
                </WorkspaceSidebarPanel>
              }
              content={
                <div className="flex h-full min-h-0 flex-col overflow-hidden border bg-background">
                  <div className="shrink-0 border-b px-4 py-3 lg:hidden">
                    <Button
                      className="h-auto w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      onClick={() => setIsCategoryDrawerOpen(true)}
                      type="button"
                      variant="outline"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <PanelLeftIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            Categories
                          </span>
                          <span className="block truncate text-sm font-medium">{selectedCategoryName}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {visibleCategories.length}
                      </span>
                    </Button>
                  </div>

                  {selectedCategoryId ? (
                    <>
                      <div className="shrink-0 border-b px-4 py-4">
                        <div className="space-y-1">
                          <h1 className="text-lg font-semibold">{selectedCategoryName}</h1>
                          <p className="text-sm text-muted-foreground">
                            Browse external integrations and open a card to inspect the tools Composio exposes.
                          </p>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        {toolkitOptions.length === 0 ? (
                          <div className="flex min-h-[240px] items-center justify-center border bg-background px-6 text-center">
                            <div className="space-y-3">
                              <BlocksIcon className="mx-auto size-10 text-muted-foreground" />
                              <div className="space-y-1">
                                <p className="font-medium">No matching toolkits</p>
                                <p className="text-sm text-muted-foreground">
                                  Try a broader search or choose a different category.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                            {toolkitOptions.map((toolkit) => (
                              <Card
                                className="cursor-pointer border-border py-0 transition-colors hover:bg-muted focus-within:border-primary focus-within:bg-muted"
                                key={toolkit.slug}
                                onClick={() => setOpenToolkitSlug(toolkit.slug)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setOpenToolkitSlug(toolkit.slug);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                <CardContent className="flex min-h-[112px] flex-col p-4">
                                  <div className="flex w-full items-start gap-4 text-left">
                                    <ToolkitLogo toolkit={toolkit} />

                                    <div className="flex min-h-full min-w-0 flex-1 flex-col">
                                      <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex min-w-0 items-center gap-2">
                                            <h2 className="truncate text-base font-semibold">{toolkit.name}</h2>
                                            <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                          </div>
                                          <p className="shrink-0 text-xs text-muted-foreground">
                                            {toolkit.toolCount} tools
                                          </p>
                                        </div>
                                        <p className="line-clamp-2 text-sm text-muted-foreground">
                                          {toolkit.description ?? "No description available for this toolkit yet."}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <ToolkitConnectionControls
                                    connectMutation={connectMutation}
                                    layout="inline"
                                    onApiKey={() => handleToolkitAction(toolkit, "api_key")}
                                    onOAuth={() => handleToolkitAction(toolkit, "oauth")}
                                    toolkit={toolkit}
                                  />
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-full items-center justify-center px-6 text-center">
                      <div className="space-y-3">
                        <BlocksIcon className="mx-auto size-10 text-muted-foreground" />
                        <div className="space-y-1">
                          <p className="font-medium">Select a category</p>
                          <p className="text-sm text-muted-foreground">
                            Choose a category from the sidebar to browse external integrations.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              }
            />

            <Drawer onOpenChange={setIsCategoryDrawerOpen} open={isCategoryDrawerOpen}>
              <DrawerContent className="lg:hidden">
                <DrawerHeader className="text-left">
                  <DrawerTitle>Categories</DrawerTitle>
                  <DrawerDescription>Choose a category to browse its toolkits.</DrawerDescription>
                </DrawerHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-4">
                  {categorySearchField}
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {categoryList}
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          </>
        </TabsContent>
      </Tabs>

      <Sheet onOpenChange={(open) => !open && setOpenToolkitSlug("")} open={Boolean(selectedToolkit)}>
        <SheetContent className="flex w-[94vw] flex-col sm:max-w-2xl" side="right">
          {selectedToolkit ? (
            <>
              <SheetHeader className="space-y-3 border-b pr-14">
                <SheetTitle>{selectedToolkit.name}</SheetTitle>
                <SheetDescription>
                  {selectedToolkit.description ?? "Inspect this toolkit and review the tools available to the agent."}
                </SheetDescription>
                {selectedToolkit.appUrl ? (
                  <Button asChild className="w-fit" size="sm" variant="outline">
                    <a href={selectedToolkit.appUrl} rel="noreferrer" target="_blank">
                      Open app
                      <ExternalLinkIcon className="size-3.5" />
                    </a>
                  </Button>
                ) : null}
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <article className="border bg-card p-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{selectedToolkit.toolCount} tools</Badge>
                        {selectedToolkit.noAuth ? <Badge variant="secondary">Open access</Badge> : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedToolkit.categories.map((category) => (
                          <Badge key={`${selectedToolkit.slug}:${category.id}`} variant="outline">
                            {category.name}
                          </Badge>
                        ))}
                      </div>

                      {selectedToolkit.supportsApiKey && !selectedToolkit.supportsOAuth && selectedToolkit.connectionStatus === "active" ? (
                        <p className="text-xs text-muted-foreground">
                          API key saved
                          {selectedToolkit.apiKeyLastFour ? ` ending in ${selectedToolkit.apiKeyLastFour}` : ""}.
                          {selectedToolkit.apiKeyUpdatedAt ? ` Updated ${new Date(selectedToolkit.apiKeyUpdatedAt).toLocaleString()}.` : ""}
                        </p>
                      ) : null}
                    </div>
                  </article>

                  {toolsQuery.isLoading ? (
                    <ToolkitToolsSkeleton />
                  ) : toolsQuery.error instanceof Error ? (
                    <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {toolsQuery.error.message}
                    </div>
                  ) : toolsQuery.data?.tools.length ? (
                    <Accordion className="border bg-card" type="multiple">
                      {toolsQuery.data.tools.map((tool) => (
                        <AccordionItem key={`${tool.toolkitSlug}:${tool.slug}`} value={tool.slug}>
                          <AccordionTrigger className="px-4 py-4 text-left hover:no-underline">
                            <span className="text-sm font-semibold">{tool.name}</span>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-3 border-t pt-4">
                              <p className="text-sm text-muted-foreground">
                                {tool.description || "No description available for this tool yet."}
                              </p>
                              <p className="break-all text-xs text-muted-foreground">{tool.slug}</p>
                              <div className="flex flex-wrap gap-2">
                                {tool.noAuth ? <Badge variant="secondary">No auth</Badge> : null}
                                {tool.tags.slice(0, 8).map((tag) => (
                                  <Badge key={`${tool.slug}:${tag}`} variant="outline">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              {tool.scopes.length > 0 ? (
                                <div className="space-y-1">
                                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                    Scopes
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {tool.scopes.map((scope) => (
                                      <Badge key={`${tool.slug}:${scope}`} variant="outline">
                                        {scope}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    <div className="flex min-h-[280px] items-center justify-center border bg-background px-6 text-center">
                      <div className="space-y-3">
                        <BlocksIcon className="mx-auto size-10 text-muted-foreground" />
                        <div className="space-y-1">
                          <p className="font-medium">No tools found</p>
                          <p className="text-sm text-muted-foreground">
                            This toolkit did not return any tools from Composio.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t p-4">
                <ToolkitConnectionControls
                  connectMutation={connectMutation}
                  layout="footer"
                  onApiKey={() => handleToolkitAction(selectedToolkit, "api_key")}
                  onOAuth={() => handleToolkitAction(selectedToolkit, "oauth")}
                  toolkit={selectedToolkit}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet
        onOpenChange={(open) => !open && setOpenInternalToolSlug("")}
        open={Boolean(internalSheetTool)}
      >
        <SheetContent className="flex w-[94vw] flex-col sm:max-w-2xl" side="right">
          {internalSheetTool ? (
            <>
              <SheetHeader className="space-y-3 border-b pr-14">
                <SheetTitle>{internalSheetTool.title}</SheetTitle>
                <SheetDescription>{internalSheetTool.description}</SheetDescription>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{internalSheetTool.source}</Badge>
                  <Badge variant="outline">{internalSheetTool.executionMode}</Badge>
                  <Badge variant="outline">{getInternalToolScopeLabel(internalSheetTool)}</Badge>
                  <Badge variant={getInternalToolStatusMeta(internalSheetTool).variant}>
                    {getInternalToolStatusMeta(internalSheetTool).label}
                  </Badge>
                  {internalSheetTool.approvalPolicy === "confirm_writes" ? (
                    <Badge variant="outline">Approval required</Badge>
                  ) : null}
                </div>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <article className="border bg-card p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Metadata</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">{internalSheetTool.slug}</p>
                        </div>
                        {activeProjectId ? (
                          <Button
                            disabled={internalEnablementMutation.isPending}
                            onClick={() =>
                              internalEnablementMutation.mutate({
                                toolSlug: internalSheetTool.slug,
                                projectId: activeProjectId,
                                isEnabled: !internalSheetTool.projectEnabled,
                              })
                            }
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {internalSheetTool.projectEnabled ? "Disable" : "Enable"}
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {internalSheetTool.tags.map((tag) => (
                          <Badge key={`${internalSheetTool.slug}:${tag}`} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {internalSheetTool.capabilities.map((capability) => (
                          <Badge key={`${internalSheetTool.slug}:${capability}`} variant="outline">
                            {capability}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </article>

                  <article className="border bg-card p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Test input</p>
                          <p className="text-xs text-muted-foreground">
                            Edit the JSON payload and run the tool directly.
                          </p>
                        </div>
                        <Button
                          onClick={() =>
                            setInternalInputValue(
                              JSON.stringify(getInternalToolSampleInput(internalSheetTool.slug), null, 2),
                            )
                          }
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <FileJsonIcon className="size-3.5" />
                          Reset
                        </Button>
                      </div>

                      <Textarea
                        className="min-h-52 font-mono text-[11px]"
                        onChange={(event) => setInternalInputValue(event.target.value)}
                        value={internalInputValue}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={allowWriteExecution}
                            disabled={internalSheetTool.executionMode === "read"}
                            onCheckedChange={setAllowWriteExecution}
                            size="sm"
                          />
                          <span className="text-xs text-muted-foreground">
                            Allow write execution
                          </span>
                        </div>
                        <Button
                          disabled={
                            internalInvokeMutation.isPending ||
                            (toolNeedsProjectContext(internalSheetTool.slug) && !activeProjectId)
                          }
                          onClick={() => {
                            try {
                              const input = JSON.parse(internalInputValue) as Record<string, unknown>;
                              setInternalExecutionResult("");
                              internalInvokeMutation.mutate({
                                toolSlug: internalSheetTool.slug,
                                projectId: activeProjectId,
                                input,
                                confirmedWriteActions: allowWriteExecution,
                              });
                            } catch {
                              toast.error("Input must be valid JSON.");
                            }
                          }}
                          size="sm"
                          type="button"
                        >
                          {internalInvokeMutation.isPending ? (
                            <>
                              <LoaderCircleIcon className="size-3.5 animate-spin" />
                              Running
                            </>
                          ) : (
                            <>
                              <FlaskConicalIcon className="size-3.5" />
                              Run test
                            </>
                          )}
                        </Button>
                      </div>

                      {toolNeedsProjectContext(internalSheetTool.slug) && !activeProjectId ? (
                        <p className="text-xs text-muted-foreground">
                          Select an active project to test this tool.
                        </p>
                      ) : null}
                    </div>
                  </article>

                  <article className="border bg-card p-4">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Input schema</p>
                      <Textarea
                        className="min-h-40 font-mono text-[11px]"
                        readOnly
                        value={JSON.stringify(internalSheetTool.inputSchema ?? {}, null, 2)}
                      />
                    </div>
                  </article>

                  <article className="border bg-card p-4">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Execution output</p>
                      <Textarea
                        className="min-h-48 font-mono text-[11px]"
                        readOnly
                        value={internalExecutionResult || "Run a test to inspect the tool output."}
                      />
                    </div>
                  </article>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
