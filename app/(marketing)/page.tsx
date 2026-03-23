import type { Metadata } from "next";

import { MarketingHomepage } from "@/components/marketing/homepage";
import { PageShell } from "@/components/layout/page-shell";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Home",
  description: "Meet AutoBot and launch product ideas faster with an AI-guided app building workflow.",
  path: "/",
});

export default function Home() {
  return (
    <PageShell scrollable={false} contentClassName="max-w-none p-0">
      <MarketingHomepage />
    </PageShell>
  );
}
