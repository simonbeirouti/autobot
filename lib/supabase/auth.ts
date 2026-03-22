import { redirect } from "next/navigation";
import { cache } from "react";

import { buildAuthHref } from "@/components/auth/auth-route";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    return null;
  }

  return data?.claims ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(buildAuthHref("login"));
  }

  return user;
}
