"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BlocksIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  KeyRoundIcon,
  Link2Icon,
  LoaderCircleIcon,
  SearchIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceSidebarPanel } from "@/components/workspace-layout";
import { dashboardQueryKeys, dashboardQueryTimings, fetchJson } from "@/lib/query/dashboard";
import type {
  ComposioToolCatalog,
  ComposioToolDetailRecord,
  ComposioToolkitRecord,
  ProviderConnection,
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

async function fetchComposioToolCatalog() {
  return fetchJson<ComposioToolCatalog>("/api/tools");
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

function buildToolsHref(pathname: string, toolkitSlug?: string | null, connection?: string | null) {
  const params = new URLSearchParams();

  if (toolkitSlug) {
    params.set("toolkit", toolkitSlug);
  }

  if (connection) {
    params.set("connection", connection);
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
  const connection = getConnectionPresentation(toolkit);
  const isConnected = toolkit.connectionStatus === "active" && !toolkit.noAuth;
  const canConnect = toolkit.supportsOAuth && !isConnected;
  const canSaveApiKey = toolkit.supportsApiKey && !isConnected;
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
          <Button onClick={onApiKey} size="sm" type="button" variant="outline">
            <KeyRoundIcon className="size-3.5" />
            API Key
          </Button>
        ) : null}
        {canConnect ? (
          <Button onClick={onOAuth} size="sm" type="button">
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
            <Button onClick={onOAuth} size="sm" type="button">
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
            <Button onClick={onApiKey} size="sm" type="button" variant="outline">
              <KeyRoundIcon className="size-3.5" />
              API Key
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [storedCatalog] = useState<ComposioToolCatalog | null>(() => readStoredCatalogSnapshot());
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [openToolkitSlug, setOpenToolkitSlug] = useState<string>(
    searchParams.get("toolkit") ?? "",
  );
  const [apiKeyDialogToolkitSlug, setApiKeyDialogToolkitSlug] = useState<string>("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
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

  useEffect(() => {
    persistCatalogSnapshot(catalog);
  }, [catalog]);

  const filteredToolkits = useMemo(() => {
    if (!catalog) {
      return [];
    }

    return catalog.toolkits.filter((toolkit) => matchesToolkitSearch(toolkit, deferredSearch));
  }, [catalog, deferredSearch]);

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

  const selectedToolkit =
    catalog?.toolkits.find((toolkit) => toolkit.slug === openToolkitSlug) ?? null;

  const apiKeyDialogToolkit =
    catalog?.toolkits.find((toolkit) => toolkit.slug === apiKeyDialogToolkitSlug) ?? null;

  const toolsQuery = useQuery({
    queryKey: dashboardQueryKeys.tools.toolkit(openToolkitSlug),
    queryFn: () => fetchToolkitTools(openToolkitSlug),
    enabled: Boolean(openToolkitSlug),
    staleTime: dashboardQueryTimings.tools.staleTime,
  });

  const connectMutation = useMutation({
    mutationFn: startToolkitConnection,
    onSuccess: (payload) => {
      if (payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.tools.catalog,
      });
    },
  });

  const apiKeyMutation = useMutation({
    mutationFn: saveToolkitApiKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardQueryKeys.tools.catalog,
      });
      setApiKeyValue("");
      setApiKeyDialogToolkitSlug("");
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
    if (openToolkitSlug && !toolkitOptions.some((toolkit) => toolkit.slug === openToolkitSlug)) {
      setOpenToolkitSlug("");
    }
  }, [openToolkitSlug, toolkitOptions]);

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
      router.replace(buildToolsHref(pathname, openToolkitSlug), { scroll: false });
    });
  }, [connectionResult, openToolkitSlug, pathname, queryClient, router]);

  if (catalogQuery.isLoading) {
    return <ToolsDashboardSkeleton />;
  }

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

      <ToolsSplitLayout
        sidebar={
          <WorkspaceSidebarPanel
            className="min-h-[260px] max-h-[40vh] sm:min-h-[320px] sm:max-h-[45vh] lg:min-h-0 lg:max-h-none"
            description="Choose a category to browse its toolkits."
            headerAction={
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search toolkits"
                  value={search}
                />
              </div>
            }
            headerActionFullWidth
            title="Categories"
          >
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
                    onClick={() => setSelectedCategoryId(category.id)}
                    type="button"
                    variant="ghost"
                  >
                    <span className="truncate">{category.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-muted-foreground">{category.toolkitCount}</span>
                  </Button>
                ))}
              </div>
            ) : null}
          </WorkspaceSidebarPanel>
        }
        content={
          <div className="flex h-full min-h-0 flex-col overflow-hidden border bg-background">
            {selectedCategoryId ? (
              <>
                <div className="shrink-0 border-b px-4 py-4">
                  <div className="space-y-1">
                    <h1 className="text-lg font-semibold">
                      {visibleCategories.find((category) => category.id === selectedCategoryId)?.name ?? "Toolkits"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Browse matching toolkits and open a card to inspect its tools.
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
                      Choose a category from the sidebar to browse toolkits.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        }
      />

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
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div className="border bg-card p-4" key={index}>
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="mt-3 h-4 w-full" />
                          <Skeleton className="mt-2 h-4 w-3/4" />
                        </div>
                      ))}
                    </div>
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
    </>
  );
}
