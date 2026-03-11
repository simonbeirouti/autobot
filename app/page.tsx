import { PageShell } from "@/components/page-shell";
import { Hero } from "@/components/hero";

export default function Home() {
  return (
    <PageShell contentClassName="max-w-5xl gap-20">
      <Hero />
    </PageShell>
  );
}
