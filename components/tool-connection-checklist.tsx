"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, Link2Icon, RefreshCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dashboardQueryKeys, dashboardQueryTimings, fetchJson } from "@/lib/query/dashboard";
import type { ToolOnboardingPayload, ToolkitReadinessItem } from "@/lib/tools/types";

async function fetchToolOnboarding() {
  return fetchJson<ToolOnboardingPayload & { defaultToolkitSlugs: string[] }>("/api/tool-onboarding", {
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

const statusLabelMap = {
  ready: "Ready",
  not_connected: "Not connected",
  auth_in_progress: "Auth in progress",
  missing_session: "Needs resync",
  confirmation_required: "Confirmation required",
  not_selected: "Not selected",
} as const;

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

    return requiredToolkitSlugs.map((toolkitSlug) => {
      const meta = payload?.recommendedToolkits.find((item) => item.slug === toolkitSlug);
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
        title: meta?.title ?? toolkitSlug,
        description: meta?.description ?? null,
        readiness: effectiveReadiness,
      };
    });
  }, [onboardingQuery.data, readiness, requiredToolkitSlugs]);

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
    <div className="space-y-3">
      {toolkitCards.map((toolkit) => (
        <div className="space-y-3 border p-4" key={toolkit.slug}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{toolkit.title}</p>
                <Badge variant={toolkit.readiness.status === "ready" ? "default" : "outline"}>
                  {statusLabelMap[toolkit.readiness.status]}
                </Badge>
              </div>
              {toolkit.description ? (
                <p className="text-sm text-muted-foreground">{toolkit.description}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">{toolkit.readiness.message}</p>
            </div>

            {toolkit.readiness.status === "ready" ? (
              <CheckCircle2Icon className="mt-0.5 size-4 text-emerald-600" />
            ) : (
              <Link2Icon className="mt-0.5 size-4 text-muted-foreground" />
            )}
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
      ))}
    </div>
  );
}
