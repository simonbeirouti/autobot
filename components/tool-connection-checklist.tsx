"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, ExternalLinkIcon, Link2Icon, RefreshCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { dashboardQueryKeys, dashboardQueryTimings, fetchJson } from "@/lib/query/dashboard";
import type {
  ComposioToolCatalog,
  ToolOnboardingPayload,
  ToolkitReadinessItem,
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
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.tools.onboarding });
      onResolved?.();
      toast.success("Connection status refreshed.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to refresh provider connection.",
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

  return (
    <div
      className={cn(
        "grid gap-2",
        toolkitCards.length === 2 ? "md:grid-cols-2" : "grid-cols-1",
      )}
    >
      {toolkitCards.map((toolkit) => (
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
                <p className="text-sm text-muted-foreground">
                  {toolkit.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                {toolkit.readiness.status === "ready" ? (
                  <CheckCircle2Icon className="size-3.5" />
                ) : (
                  <Link2Icon className="size-3.5" />
                )}
                <span className="truncate">{toolkit.readiness.message}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  type="button"
                  onClick={() => startConnectionMutation.mutate(toolkit.slug)}
                  disabled={startConnectionMutation.isPending}
                >
                  {toolkit.readiness.status === "ready" ? "Reconnect" : "Connect"}
                </Button>
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
      ))}
    </div>
  );
}
