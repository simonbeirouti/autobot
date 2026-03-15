import { Suspense } from "react";

import { ProtectedLayoutClient } from "@/components/protected-layout-client";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-svh flex-1 bg-background" />}>
      <ProtectedLayoutClient>{children}</ProtectedLayoutClient>
    </Suspense>
  );
}
