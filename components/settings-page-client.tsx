"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import {
  DashboardPageHeader,
  DashboardPageHeaderSkeleton,
} from "@/components/dashboard-page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from "@/lib/query/notifications";
import { ensureRouteData } from "@/lib/query/http-error";
import { createClient } from "@/lib/supabase/client";
import { buildAuthHref } from "@/components/auth/auth-route";

const SETTINGS_PAGE_SECTION_CLASSNAME = "flex min-h-0 flex-col p-0.5";
const SETTINGS_PAGE_STACK_CLASSNAME = "space-y-4";

function PreferenceRow({
  checked,
  description,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onCheckedChange: (nextChecked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border border-border/70 bg-background/80 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

function SettingsCardSkeleton() {
  return (
    <Card className="border-border/70 bg-background/95">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-32" />
      </CardContent>
    </Card>
  );
}

export function SettingsPageSkeleton() {
  return (
    <section className={SETTINGS_PAGE_SECTION_CLASSNAME}>
      <div className={SETTINGS_PAGE_STACK_CLASSNAME}>
        <DashboardPageHeaderSkeleton />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SettingsCardSkeleton />
          <SettingsCardSkeleton />
        </div>

        <Card className="border-border/70 bg-background/95">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-52" />
                <Skeleton className="h-4 w-80" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="space-y-3" key={index}>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-72" />
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="flex items-start justify-between gap-4 border border-border/70 bg-background/80 p-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-52" />
                    </div>
                    <Skeleton className="h-6 w-11" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function SettingsPageClient() {
  const router = useRouter();
  const { user } = useAuth();
  const preferencesQuery = useNotificationPreferencesQuery();
  const updatePreferencesMutation = useUpdateNotificationPreferencesMutation();
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const preferences = preferencesQuery.data;

  useEffect(() => {
    setEmail(user?.email ?? "");
  }, [user?.email]);

  async function handleEmailUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      toast.error("Enter an email address first.");
      return;
    }

    setIsUpdatingEmail(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: trimmedEmail });

      if (error) {
        throw error;
      }

      toast.success("Email update started. Check both inboxes if confirmation is required.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update email.");
    } finally {
      setIsUpdatingEmail(false);
    }
  }

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password.trim()) {
      toast.error("Enter a new password first.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      await supabase.auth.signOut({ scope: "global" });
      setPassword("");
      toast.success("Password updated. Please sign in again.");
      router.replace(buildAuthHref("login"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  function updatePreference<K extends keyof NonNullable<typeof preferences>>(
    key: K,
    value: NonNullable<typeof preferences>[K],
  ) {
    if (!preferences) {
      return;
    }

    const nextPreferences = { ...preferences, [key]: value };

    updatePreferencesMutation.mutate(
      {
        marketingEmail: nextPreferences.marketingEmail,
        platformUpdatesEmail: nextPreferences.platformUpdatesEmail,
        platformUpdatesInApp: nextPreferences.platformUpdatesInApp,
      },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to update notification preferences.",
          );
        },
        onSuccess: () => {
          toast.success("Notification preferences updated.");
        },
      },
    );
  }

  if (preferencesQuery.isLoading && !preferences) {
    return <SettingsPageSkeleton />;
  }

  if (
    preferencesQuery.error &&
    !preferencesQuery.isLoading &&
    !preferencesQuery.isFetching &&
    !preferences
  ) {
    throw preferencesQuery.error;
  }

  ensureRouteData(preferences, "Notification preferences are unavailable.");

  return (
    <section className={SETTINGS_PAGE_SECTION_CLASSNAME}>
      <div className={SETTINGS_PAGE_STACK_CLASSNAME}>
        <DashboardPageHeader
          badge="Settings"
          description="Update your login credentials, decide how Autobot reaches you, and keep run updates flowing to the inboxes you actually want to monitor."
          heading="Manage your account and notification flow"
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="border-border/70 bg-background/95">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center border border-border/70 bg-muted/40">
                  <MailIcon className="size-4" />
                </div>
                <div>
                  <CardTitle>Email address</CardTitle>
                  <CardDescription>
                    Supabase handles the email change and may require confirmation.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEmailUpdate} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="settings-email">Email</Label>
                  <Input
                    id="settings-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Your profile display updates from the authenticated session, so the new
                  address appears after the auth provider confirms it.
                </p>
                <Button type="submit" disabled={isUpdatingEmail}>
                  {isUpdatingEmail ? "Saving..." : "Update email"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/95">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center border border-border/70 bg-muted/40">
                  <ShieldCheckIcon className="size-4" />
                </div>
                <div>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>
                    Rotate your password without leaving the authenticated workspace.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="settings-password">New password</Label>
                  <Input
                    id="settings-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create a new password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Password updates apply to the current account immediately and keep your
                  protected routes intact.
                </p>
                <Button type="submit" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? "Saving..." : "Update password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-background/95">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center border border-border/70 bg-muted/40">
                <BellIcon className="size-4" />
              </div>
              <div>
                <CardTitle>Notification preferences</CardTitle>
                <CardDescription>
                  Control which updates land in your inbox or inside the product.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Marketing
                </h2>
                <p className="text-sm text-muted-foreground">
                  Optional product education, launches, and customer-facing announcements by email.
                </p>
              </div>
              <div className="grid gap-3">
                <PreferenceRow
                  checked={preferences?.marketingEmail ?? true}
                  disabled={!preferences || updatePreferencesMutation.isPending}
                  label="Email marketing"
                  description="Receive launch notes and campaign updates by email."
                  onCheckedChange={(nextChecked) =>
                    updatePreference("marketingEmail", nextChecked)
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Platform updates
                </h2>
                <p className="text-sm text-muted-foreground">
                  AI run lifecycle notifications, blocked steps, and action-required task updates.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <PreferenceRow
                  checked={preferences?.platformUpdatesEmail ?? true}
                  disabled={!preferences || updatePreferencesMutation.isPending}
                  label="Email run updates"
                  description="Get sent summaries when a run blocks, fails, or completes."
                  onCheckedChange={(nextChecked) =>
                    updatePreference("platformUpdatesEmail", nextChecked)
                  }
                />
                <PreferenceRow
                  checked={preferences?.platformUpdatesInApp ?? true}
                  disabled={!preferences || updatePreferencesMutation.isPending}
                  label="In-app run updates"
                  description="Show actionable run alerts in the top-right inbox."
                  onCheckedChange={(nextChecked) =>
                    updatePreference("platformUpdatesInApp", nextChecked)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
