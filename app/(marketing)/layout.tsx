import { Suspense } from "react";

import { MarketingContactSheet } from "@/components/marketing/marketing-contact-sheet";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import Nav from "@/components/layout/nav";

function NavFallback() {
  return (
    <nav className="w-full px-4 pt-4 sm:px-6">
      <div className="mx-auto flex h-16 w-full items-center justify-between border border-border/70 bg-background/45 px-5 py-3 text-sm shadow-[0_20px_45px_-32px_rgba(15,23,42,0.35)] backdrop-blur-md supports-[backdrop-filter]:bg-background/25">
        <div className="flex items-center gap-5 font-semibold">AutoBot</div>
      </div>
    </nav>
  );
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50">
        <div className="pointer-events-auto">
          <Suspense fallback={<NavFallback />}>
            <Nav />
          </Suspense>
        </div>
      </div>
      <div id="marketing-scroll-root" className="min-h-0 flex-1 overflow-y-auto">
        {children}
        <MarketingFooter />
      </div>
      <Suspense fallback={null}>
        <MarketingContactSheet />
      </Suspense>
    </div>
  );
}
