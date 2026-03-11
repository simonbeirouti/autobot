"use client";

import { useParams } from "next/navigation";

import { RunWorkspace } from "@/components/run-workspace";

export function RunPageClient() {
  const params = useParams<{ runId: string }>();

  if (!params?.runId) {
    return (
      <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-6 text-sm text-rose-900">
        Unable to determine the run id for this workspace.
      </div>
    );
  }

  return <RunWorkspace runId={params.runId} />;
}

