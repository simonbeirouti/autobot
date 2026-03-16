"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, CheckCircle2Icon, Link2Icon, RefreshCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useProject } from "@/components/providers/project-provider";
import { dashboardQueryKeys, dashboardQueryTimings, fetchJson } from "@/lib/query/dashboard";
import { DASHBOARD_HOME_ROUTE, PROJECT_ONBOARDING_ROUTE } from "@/lib/routes";
import type { ToolOnboardingPayload } from "@/lib/tools/types";
import { cn } from "@/lib/utils";

type OnboardingUpdateResponse = ToolOnboardingPayload["onboarding"];

async function fetchToolOnboarding() {
  return fetchJson<ToolOnboardingPayload & { defaultToolkitSlugs: string[] }>("/api/tool-onboarding");
}

export function ProviderOnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { projects } = useProject();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [selectedToolkitSlugs, setSelectedToolkitSlugs] = useState<string[] | null>(null);
  const [filterValue, setFilterValue] = useState("");

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const onboardingQuery = useQuery({
    queryKey: dashboardQueryKeys.tools.onboarding,
    queryFn: fetchToolOnboarding,
    staleTime: dashboardQueryTimings.toolOnboarding.staleTime,
  });

  const connectionStatus = searchParams.get("connection");
  const connectionToolkit = searchParams.get("toolkit");
  const payload = onboardingQuery.data;
  const effectiveSelectedToolkitSlugs = selectedToolkitSlugs ?? payload?.onboarding?.selectedToolkitSlugs ?? payload?.defaultToolkitSlugs ?? [];

  const startConnectionMutation = useMutation({
    mutationFn: async (toolkitSlug: string) =>
      fetchJson<{ redirectUrl: string | null }>("/api/composio/connections/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolkitSlug,
          nextPath: "/onboarding/providers",
        }),
      }),
    onSuccess: (result) => {
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
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
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async (completed: boolean) =>
      fetchJson<OnboardingUpdateResponse>("/api/tool-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedToolkitSlugs: effectiveSelectedToolkitSlugs,
          completed,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.tools.onboarding });
      startTransition(() => {
        router.replace(projects.length === 0 ? PROJECT_ONBOARDING_ROUTE : DASHBOARD_HOME_ROUTE);
      });
    },
  });

  const activeConnectionsByToolkit = useMemo(() => {
    return new Map(payload?.connections.map((connection) => [connection.toolkitSlug, connection]) ?? []);
  }, [payload?.connections]);
  const filteredToolkits = useMemo(() => {
    const normalizedFilter = filterValue.trim().toLowerCase();
    const toolkits = payload?.recommendedToolkits ?? [];
    if (!normalizedFilter) {
      return toolkits;
    }

    return toolkits.filter((toolkit) => {
      return (
        toolkit.title.toLowerCase().includes(normalizedFilter) ||
        toolkit.slug.toLowerCase().includes(normalizedFilter) ||
        toolkit.description.toLowerCase().includes(normalizedFilter)
      );
    });
  }, [filterValue, payload?.recommendedToolkits]);

  if (!hasHydrated || onboardingQuery.isLoading) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">Loading provider onboarding...</div>;
  }

  return (
    <section className="relative flex min-h-svh flex-1 overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_30%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4 border bg-background/95 p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Provider onboarding
            </p>
            <h1 className="text-4xl font-semibold tracking-tight">
              Connect the tools AutoBot can use
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Choose the providers that matter most, connect the accounts you want available, and
              then continue into project setup. You can always add more later.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => completeOnboardingMutation.mutate(true)}
              disabled={completeOnboardingMutation.isPending}
              type="button"
            >
              Continue to project setup
              <ArrowRightIcon className="size-4" />
            </Button>
            <Button asChild variant="outline">
              <Link href={DASHBOARD_HOME_ROUTE}>Back to dashboard</Link>
            </Button>
          </div>
        </div>

        {connectionStatus && connectionToolkit ? (
          <div
            className={cn(
              "border px-4 py-3 text-sm",
              connectionStatus === "active"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700",
            )}
          >
            {connectionStatus === "active"
              ? `${connectionToolkit} connected successfully.`
              : `${connectionToolkit} returned with status "${connectionStatus}". You can resync the connection below if needed.`}
          </div>
        ) : null}

        <div className="relative">
          <Input
            className="max-w-md"
            onChange={(event) => setFilterValue(event.target.value)}
            placeholder="Filter providers"
            value={filterValue}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredToolkits.map((toolkit) => {
            const connection = activeConnectionsByToolkit.get(toolkit.slug);
            const isSelected = effectiveSelectedToolkitSlugs.includes(toolkit.slug);
            const isConnected = connection?.status === "active";

            return (
              <article
                className={cn(
                  "border bg-background/95 p-5 shadow-sm transition-colors",
                  isSelected ? "border-foreground/30" : "border-border/70",
                )}
                key={toolkit.slug}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {toolkit.category}
                    </p>
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold">{toolkit.title}</h2>
                      <p className="text-sm text-muted-foreground">{toolkit.description}</p>
                    </div>
                  </div>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      setSelectedToolkitSlugs((current) => {
                        const base = current ?? effectiveSelectedToolkitSlugs;
                        if (checked) {
                          return Array.from(new Set([...base, toolkit.slug]));
                        }
                        return base.filter((slug) => slug !== toolkit.slug);
                      });
                    }}
                  />
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {isConnected ? (
                      <CheckCircle2Icon className="size-4 text-emerald-600" />
                    ) : (
                      <Link2Icon className="size-4" />
                    )}
                    <span>{connection?.status ?? "not_connected"}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => syncConnectionMutation.mutate(toolkit.slug)}
                      disabled={syncConnectionMutation.isPending || !connection?.composioSessionId}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <RefreshCcwIcon className="size-4" />
                    </Button>
                    <Button
                      onClick={() => startConnectionMutation.mutate(toolkit.slug)}
                      disabled={startConnectionMutation.isPending}
                      size="sm"
                      type="button"
                      variant={isConnected ? "outline" : "default"}
                    >
                      {isConnected ? "Reconnect" : "Connect"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
