import { PageShell } from "@/components/page-shell";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageShell contentClassName="max-w-5xl gap-20">
      {children}
    </PageShell>
  );
}
