"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buildAuthErrorHref, getAuthFlowError } from "@/components/auth/auth-error";
import { buildAuthHref } from "@/components/auth/auth-route";
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
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== repeatPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
    } catch (error: unknown) {
      const authError = getAuthFlowError(error, "forgot-password");
      router.push(buildAuthErrorHref(authError.code, authError.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {isSuccess ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Password updated</CardTitle>
            <CardDescription>You can sign in with your new password now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your password has been reset successfully.
            </p>
            <Button asChild className="w-full">
              <Link href={buildAuthHref("login")}>Back to login</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create a new password</CardTitle>
            <CardDescription>
              Enter a new password for your account using the secure link from your email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="repeat-password">Repeat new password</Label>
                  <Input
                    id="repeat-password"
                    type="password"
                    required
                    value={repeatPassword}
                    onChange={(event) => setRepeatPassword(event.target.value)}
                  />
                </div>
                {error ? <p className="text-sm text-red-500">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Updating password..." : "Update password"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Need a new reset link?{" "}
                <Link
                  href={buildAuthHref("forgot-password")}
                  className="underline underline-offset-4"
                >
                  Reset password
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
