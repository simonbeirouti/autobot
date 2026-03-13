"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function WorkspaceSplitLayout({
  sidebar,
  content,
}: {
  sidebar: ReactNode;
  content: ReactNode;
}) {
  return (
    <section className="flex min-h-0 min-w-full -mx-4 -my-4 flex-1 flex-col gap-2 xl:grid xl:h-full xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:overflow-hidden">
      {sidebar}
      <div className="min-h-0 xl:h-full xl:overflow-hidden">{content}</div>
    </section>
  );
}

export function WorkspaceSidebarPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-h-[320px] mx-0.5 mt-0.5 overflow-hidden xl:h-[calc(100%-0.2rem)]">
      <CardHeader className="shrink-0 border-b">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 px-0">
        <ScrollArea className="h-full">
          <div className="px-4">{children}</div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function WorkspaceSidebarItemSkeleton({
  lineCount = 2,
}: {
  lineCount?: number;
}) {
  return (
    <div className="w-full rounded-md border p-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-11/12" />
          {Array.from({ length: lineCount - 1 }).map((_, index) => (
            <Skeleton className={cn("h-4", index === lineCount - 2 ? "w-3/4" : "w-full")} key={index} />
          ))}
        </div>
        <Skeleton className="h-5 w-20" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSidebarSkeleton({
  titleWidth = "w-40",
  descriptionWidth = "w-4/5",
  itemCount = 3,
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  itemCount?: number;
}) {
  return (
    <Card className="min-h-[320px] overflow-hidden xl:h-full">
      <CardHeader className="shrink-0 border-b">
        <div className="space-y-2">
          <Skeleton className={cn("h-7", titleWidth)} />
          <Skeleton className={cn("h-4", descriptionWidth)} />
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 px-0 pt-0">
        <ScrollArea className="h-full">
          <div className="space-y-2 px-4 py-4">
            {Array.from({ length: itemCount }).map((_, index) => (
              <WorkspaceSidebarItemSkeleton key={index} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
