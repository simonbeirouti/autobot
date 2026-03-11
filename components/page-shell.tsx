import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <main className={cn("flex-1 min-h-0 w-full overflow-hidden", className)}>
      <div className="h-full overflow-y-auto">
        <div className={cn("mx-auto flex min-h-full w-full flex-col p-5", contentClassName)}>
          {children}
        </div>
      </div>
    </main>
  );
}
