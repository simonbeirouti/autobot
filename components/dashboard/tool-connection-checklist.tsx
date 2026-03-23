"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  KeyRoundIcon,
  Link2Icon,
  LoaderCircleIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { dashboardQueryKeys, dashboardQueryTimings, fetchJson } from "@/lib/query/dashboard";
import type {
  ComposioToolCatalog,
  ProviderConnection,
  ToolOnboardingPayload,
  ToolkitReadinessItem,
  ToolkitReadinessStatus,
} from "@/lib/tools/types";
import { cn } from "@/lib/utils";

async function fetchToolOnboarding() {
  return fetchJson<ToolOnboardingPayload & { defaultToolkitSlugs: string[] }>("/api/tool-onboarding", {
    cache: "no-store",
  });
}

async function fetchToolsCatalog() {
  return fetchJson<ComposioToolCatalog>("/api/tools", {
    cache: "no-store",
  });
}

async function saveToolkitApiKey({
  toolkitSlug,
  apiKey,
}: {
  toolkitSlug: string;
  apiKey: string;
}) {
  return fetchJson<{ connection: ProviderConnection; verified: boolean }>(
    "/api/composio/connections/api-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolkitSlug,
        apiKey,
        authScheme: "API_KEY",
      }),
    },
  );
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

function mergeConnectionIntoOnboarding(
  payload: (ToolOnboardingPayload & { defaultToolkitSlugs: string[] }) | undefined,
  connection: ProviderConnection,
) {
  if (!payload) {
    return payload;
  }

  const nextConnections = payload.connections.some(
    (item) => item.toolkitSlug === connection.toolkitSlug,
  )
    ? payload.connections.map((item) =>
        item.toolkitSlug === connection.toolkitSlug ? connection : item,
      )
    : [connection, ...payload.connections];

  return {
    ...payload,
    connections: nextConnections,
  };
}

function getReadinessFromConnection(
  toolkitSlug: string,
  connections: ToolOnboardingPayload["connections"],
): ToolkitReadinessItem {
  const connection = connections.find((item) => item.toolkitSlug === toolkitSlug);

  if (!connection) {
    return {
      toolkitSlug,
      status: "not_connected",
      message: `${toolkitSlug} is not connected yet.`,
    };
  }

  if (connection.status === "initiated") {
    return {
      toolkitSlug,
      status: "auth_in_progress",
      message: `${toolkitSlug} is waiting for authentication to finish.`,
    };
  }

  if (connection.status !== "active") {
    return {
      toolkitSlug,
      status: "not_connected",
      message: `${toolkitSlug} is not connected yet.`,
    };
  }

  if (!connection.composioSessionId) {
    return {
      toolkitSlug,
      status: "missing_session",
      message: `${toolkitSlug} is connected but missing a usable session.`,
    };
  }

  return {
    toolkitSlug,
    status: "ready",
    message: `${toolkitSlug} is ready to use.`,
  };
}

function getStatusIcon(status: ToolkitReadinessStatus, noAuth: boolean) {
  if (noAuth) {
    return <ShieldCheckIcon className="size-3.5" />;
  }

  if (status === "ready") {
    return <CheckCircle2Icon className="size-3.5" />;
  }

  if (status === "missing_session" || status === "confirmation_required") {
    return <XCircleIcon className="size-3.5" />;
  }

  return <Link2Icon className="size-3.5" />;
}

export function ToolConnectionChecklist({
  requiredToolkitSlugs,
  readiness,
  nextPath,
  onResolved,
}: {
  requiredToolkitSlugs: string[];
  readiness: ToolkitReadinessItem[];
  nextPath: string;
  onResolved?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const [apiKeyDialogToolkitSlug, setApiKeyDialogToolkitSlug] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const onboardingQuery = useQuery({
    queryKey: dashboardQueryKeys.tools.onboarding,
    queryFn: fetchToolOnboarding,
    staleTime: dashboardQueryTimings.toolOnboarding.staleTime,
  });
  const catalogQuery = useQuery({
    queryKey: dashboardQueryKeys.tools.catalog,
    queryFn: fetchToolsCatalog,
    staleTime: dashboardQueryTimings.tools.staleTime,
  });

  const startConnectionMutation = useMutation({
    mutationFn: async (toolkitSlug: string) =>
      fetchJson<{ redirectUrl: string | null }>("/api/composio/connections/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolkitSlug,
          nextPath,
        }),
      }),
    onSuccess: (result, toolkitSlug) => {
      if (result.redirectUrl) {
        toast.success(`Redirecting to ${toolkitSlug} to finish connecting.`);
        window.location.href = result.redirectUrl;
      }
    },
    onError: (error, toolkitSlug) => {
      toast.error(
        error instanceof Error ? error.message : `Unable to start ${toolkitSlug} connection.`,
      );
    },
  });

  const syncConnectionMutation = useMutation({
    mutationFn: async (toolkitSlug: string) =>
      fetchJson("/api/composio/connections/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkitSlug }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.tools.onboarding }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.tools.catalog }),
      ]);
      onResolved?.();
      toast.success("Connection status refreshed.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to refresh provider connection.",
      );
    },
  });
  const saveApiKeyMutation = useMutation({
    mutationFn: saveToolkitApiKey,
    onSuccess: async (result, variables) => {
      queryClient.setQueryData<ToolOnboardingPayload & { defaultToolkitSlugs: string[] } | undefined>(
        dashboardQueryKeys.tools.onboarding,
        (current) => mergeConnectionIntoOnboarding(current, result.connection),
      );
      queryClient.setQueryData<ComposioToolCatalog | undefined>(
        dashboardQueryKeys.tools.catalog,
        (current) => mergeConnectionIntoCatalog(current, result.connection),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.tools.onboarding }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.tools.catalog }),
      ]);
      setApiKeyDialogToolkitSlug("");
      setApiKeyValue("");
      onResolved?.();
      toast.success(
        result.verified
          ? `${variables.toolkitSlug} API key saved and verified.`
          : `${variables.toolkitSlug} API key saved.`,
      );
    },
    onError: (error, variables) => {
      toast.error(
        error instanceof Error ? error.message : `Unable to save API key for ${variables.toolkitSlug}.`,
      );
    },
  });

  const toolkitCards = useMemo(() => {
    const payload = onboardingQuery.data;
    const catalog = catalogQuery.data;

    return requiredToolkitSlugs.map((toolkitSlug) => {
      const meta = payload?.recommendedToolkits.find((item) => item.slug === toolkitSlug);
      const toolkit = catalog?.toolkits.find((item) => item.slug === toolkitSlug);
      const liveReadiness =
        payload ? getReadinessFromConnection(toolkitSlug, payload.connections) : null;
      const fallbackReadiness =
        readiness.find((item) => item.toolkitSlug === toolkitSlug) ?? {
          toolkitSlug,
          status: "not_connected" as const,
          message: `${toolkitSlug} is not connected yet.`,
        };
      const effectiveReadiness = liveReadiness ?? fallbackReadiness;

      return {
        slug: toolkitSlug,
        title: toolkit?.name ?? meta?.title ?? toolkitSlug,
        description:
          toolkit?.description ??
          meta?.description ??
          "No description available for this toolkit yet.",
        logoUrl: toolkit?.logoUrl ?? null,
        appUrl: toolkit?.appUrl ?? null,
        toolCount: toolkit?.toolCount ?? null,
        noAuth: toolkit?.noAuth ?? false,
        supportsOAuth: toolkit?.supportsOAuth ?? false,
        supportsApiKey: toolkit?.supportsApiKey ?? false,
        authSchemes: toolkit?.authSchemes ?? [],
        apiKeyLastFour: toolkit?.apiKeyLastFour ?? null,
        apiKeyUpdatedAt: toolkit?.apiKeyUpdatedAt ?? null,
        readiness: effectiveReadiness,
      };
    });
  }, [catalogQuery.data, onboardingQuery.data, readiness, requiredToolkitSlugs]);

  const allReady =
    toolkitCards.length > 0 && toolkitCards.every((item) => item.readiness.status === "ready");
  const hasAutoResolvedRef = useRef(false);

  useEffect(() => {
    if (!allReady || hasAutoResolvedRef.current) {
      return;
    }

    hasAutoResolvedRef.current = true;
    onResolved?.();
  }, [allReady, onResolved]);

  useEffect(() => {
    if (!allReady) {
      hasAutoResolvedRef.current = false;
    }
  }, [allReady]);

  const apiKeyDialogToolkit =
    toolkitCards.find((toolkit) => toolkit.slug === apiKeyDialogToolkitSlug) ?? null;

  return (
    <>
      <Dialog
        open={Boolean(apiKeyDialogToolkit)}
        onOpenChange={(open) => {
          if (!open) {
            setApiKeyDialogToolkitSlug("");
            setApiKeyValue("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{apiKeyDialogToolkit?.title ?? "API Key"}</DialogTitle>
            <DialogDescription>
              Save an API key for this toolkit. The key will be encrypted before it is stored and will not be shown again after save.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="draft-tool-api-key">
              API key
            </label>
            <Input
              autoComplete="off"
              id="draft-tool-api-key"
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
            {saveApiKeyMutation.error instanceof Error ? (
              <p className="text-xs text-destructive">{saveApiKeyMutation.error.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              disabled={
                saveApiKeyMutation.isPending ||
                apiKeyValue.trim().length === 0 ||
                !apiKeyDialogToolkit
              }
              onClick={() => {
                if (!apiKeyDialogToolkit) {
                  return;
                }

                saveApiKeyMutation.mutate({
                  toolkitSlug: apiKeyDialogToolkit.slug,
                  apiKey: apiKeyValue.trim(),
                });
              }}
            >
              {saveApiKeyMutation.isPending ? (
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

      <div
        className={cn(
          "grid gap-2",
          toolkitCards.length === 2 ? "md:grid-cols-2" : "grid-cols-1",
        )}
      >
        {toolkitCards.map((toolkit) => {
          const showOAuth = toolkit.supportsOAuth && !toolkit.noAuth;
          const showApiKey = toolkit.supportsApiKey && !toolkit.noAuth;
          const buttonLabel = showOAuth
            ? toolkit.readiness.status === "ready"
              ? "Reconnect"
              : "Connect"
            : toolkit.apiKeyUpdatedAt
              ? "Update API Key"
              : "API Key";
          const authLabel = toolkit.noAuth
            ? "No auth required"
            : showOAuth && showApiKey
              ? "OAuth or API key"
              : showOAuth
                ? "OAuth"
                : showApiKey
                  ? "API key"
                  : toolkit.authSchemes.length
                    ? toolkit.authSchemes.join(", ")
                    : "Connection required";

          return (
            <div className="border bg-background p-4" key={toolkit.slug}>
              <div className="flex min-h-[112px] flex-col justify-between gap-4">
                <div className="flex items-start gap-4 text-left">
                  {toolkit.logoUrl ? (
                    <img
                      alt={`${toolkit.title} logo`}
                      className="size-12 shrink-0 border object-contain p-2"
                      height={48}
                      src={toolkit.logoUrl}
                      width={48}
                    />
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center border bg-muted text-lg font-semibold text-foreground">
                      <span aria-hidden="true">{toolkit.title.trim().charAt(0).toUpperCase() || "?"}</span>
                      <span className="sr-only">{toolkit.title}</span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-base font-semibold">{toolkit.title}</h3>
                        {toolkit.appUrl ? (
                          <a href={toolkit.appUrl}>
                            <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          </a>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {toolkit.toolCount !== null ? `${toolkit.toolCount} tools` : null}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">{toolkit.description}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Auth: {authLabel}
                    </p>
                    {showApiKey && toolkit.apiKeyUpdatedAt ? (
                      <p className="text-xs text-muted-foreground">
                        API key saved
                        {toolkit.apiKeyLastFour ? ` ending in ${toolkit.apiKeyLastFour}` : ""}.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {getStatusIcon(toolkit.readiness.status, toolkit.noAuth)}
                    <span className="truncate">{toolkit.readiness.message}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {showOAuth ? (
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => startConnectionMutation.mutate(toolkit.slug)}
                        disabled={startConnectionMutation.isPending}
                      >
                        {startConnectionMutation.isPending &&
                        startConnectionMutation.variables === toolkit.slug ? (
                          <>
                            <LoaderCircleIcon className="size-3.5 animate-spin" />
                            Connecting
                          </>
                        ) : (
                          buttonLabel
                        )}
                      </Button>
                    ) : null}
                    {showApiKey ? (
                      <Button
                        size="sm"
                        type="button"
                        variant={showOAuth ? "outline" : "default"}
                        onClick={() => setApiKeyDialogToolkitSlug(toolkit.slug)}
                      >
                        <KeyRoundIcon className="size-3.5" />
                        {showOAuth ? "API Key" : buttonLabel}
                      </Button>
                    ) : null}
                    {!showOAuth && !showApiKey && !toolkit.noAuth ? (
                      <Button size="sm" type="button" disabled>
                        Connection unavailable
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => syncConnectionMutation.mutate(toolkit.slug)}
                      disabled={syncConnectionMutation.isPending}
                    >
                      <RefreshCcwIcon className="size-3.5" />
                      Resync
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
