"use client";

import { AuthProvider } from "@/components/providers/auth-provider";
import { ProjectProvider } from "@/components/providers/project-provider";
import { QueryProvider } from "@/components/providers/query-provider";

export function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <QueryProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
