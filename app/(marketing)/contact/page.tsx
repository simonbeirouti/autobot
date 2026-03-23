import type { Metadata } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Contact",
  description: "Get in touch with the AutoBot team to talk about product workflows, demos, or partnerships.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <PageShell scrollable={false} contentClassName="max-w-4xl justify-center gap-6 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Contact
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Talk with the AutoBot team about your next build.
        </h1>
      </div>
      <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
        Reach out for a demo, partnership conversation, or help figuring out how AutoBot fits into
        your product workflow.
      </p>
      <p className="text-base text-muted-foreground">hello@autobot.dev</p>
    </PageShell>
  );
}
