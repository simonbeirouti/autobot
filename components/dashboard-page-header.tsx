import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function DashboardPageHeader({
  actions,
  badge,
  className,
  description,
  heading,
}: {
  actions?: ReactNode;
  badge: string;
  className?: string;
  description: ReactNode;
  heading: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border border-border/70 p-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl space-y-3">
        <Badge variant="outline" className="px-3 py-1 uppercase tracking-[0.2em]">
          {badge}
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function DashboardPageHeaderSkeleton({
  showActions = false,
}: {
  showActions?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 border border-border/70 p-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl space-y-3">
        <Skeleton className="h-7 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-11/12 max-w-2xl" />
        </div>
      </div>
      {showActions ? (
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
      ) : null}
    </div>
  );
}
