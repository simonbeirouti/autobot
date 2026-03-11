import { PageShell } from "@/components/page-shell";

export default function RunsPage() {
  return (
    <PageShell contentClassName="max-w-6xl gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
        <p className="text-sm text-muted-foreground">
          Open a run from the objective flow to continue working in its workspace.
        </p>
      </div>
    </PageShell>
  );
}
