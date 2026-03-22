import { Suspense } from "react";

import Nav from "@/components/nav";

function NavFallback() {
  return (
    <nav className="flex h-16 w-full justify-center border-b border-b-foreground/10">
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
    <div>
      <Suspense fallback={<NavFallback />}>
        <Nav />
      </Suspense>
      {children}
    </div>
  );
}
