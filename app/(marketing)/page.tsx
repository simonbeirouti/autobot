import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Home",
  description: "Meet AutoBot and launch product ideas faster with an AI-guided app building workflow.",
  path: "/",
});

export default function Home() {
  return (
    <PageShell contentClassName="max-w-6xl gap-20">
      Signup form
    </PageShell>
  );
}
