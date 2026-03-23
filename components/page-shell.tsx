import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
  contentClassName,
  scrollable = true,
  scrollableClassName,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  scrollable?: boolean;
  scrollableClassName?: string;
}) {
  return (
    <main className={cn("flex-1 w-full", scrollable ? "min-h-0 overflow-hidden" : "min-h-fit", className)}>
      <div className={cn(scrollable ? "h-full overflow-y-auto" : "h-auto", scrollableClassName)}>
        <div className={cn("mx-auto flex w-full flex-col p-3", scrollable && "min-h-full", contentClassName)}>
          {children}
        </div>
      </div>
    </main>
  );
}
