import type { Metadata } from "next";

import { AboutPage as AboutMarketingPage } from "@/components/marketing/about-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "About",
  description: "Learn how AutoBot helps teams move from product idea to working application with less friction.",
  path: "/about",
});

export default function AboutPage() {
  return <AboutMarketingPage />;
}
