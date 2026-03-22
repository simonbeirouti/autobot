import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "About",
  description: "Learn how AutoBot helps teams move from product idea to working application with less friction.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <PageShell contentClassName="max-w-4xl justify-center gap-6 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          About AutoBot
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          AutoBot helps product teams turn ambitious ideas into working software.
        </h1>
      </div>
      <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
        We combine guided planning, implementation support, and practical workflows so teams can
        go from concept to shipped experience with less overhead and more momentum.
      </p>
    </PageShell>
  );
}
