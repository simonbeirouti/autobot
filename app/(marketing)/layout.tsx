import { Suspense } from "react";

import { MarketingFooter } from "@/components/layout/marketing-footer";
import Nav from "@/components/layout/nav";

function NavFallback() {
  return (
    <nav className="flex h-16 w-full justify-center">
      <div className="flex w-full items-center justify-between px-5 py-3 text-sm">
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
    <div className="flex h-screen flex-col overflow-hidden">
      <Suspense fallback={<NavFallback />}>
        <Nav />
      </Suspense>
      <div id="marketing-scroll-root" className="min-h-0 flex-1 overflow-y-auto">
        {children}
        <MarketingFooter />
      </div>
    </div>
  );
}
