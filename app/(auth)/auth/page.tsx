import { Suspense } from "react";

import { AuthPageClient, AuthPageContent } from "@/components/auth/auth-page-client";

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageClient mode="login" />}>
      <AuthPageContent />
    </Suspense>
  );
}
