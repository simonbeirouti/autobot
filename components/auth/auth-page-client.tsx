"use client";

import { ArrowLeftToLine, Bot } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";

import {
  AuthMode,
  buildAuthHref,
  DEFAULT_AUTH_MODE,
  getAuthMode,
} from "@/components/auth/auth-route";
import { Button } from "@/components/ui/button";
import { AuthErrorCard } from "@/components/auth/auth-error-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LoginForm } from "@/components/auth/login-form";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { SignUpSuccessCard } from "@/components/auth/sign-up-success-card";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AuthPageClient({
  errorCode,
  errorMessage,
  mode,
}: {
  errorCode?: string | null;
  errorMessage?: string | null;
  mode: AuthMode;
}) {
  const router = useRouter();
  const activeTab = mode === "sign-up" ? "sign-up" : "login";
  const showTabs = mode === "login" || mode === "sign-up";

  const handleTabChange = (value: string) => {
    const nextMode = value === "sign-up" ? "sign-up" : "login";
    const nextHref =
      nextMode === DEFAULT_AUTH_MODE ? "/auth" : buildAuthHref(nextMode);

    startTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center bg-primary text-primary-foreground">
              <Bot className="size-4" />
            </div>
            AutoBot
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-sm flex-col gap-4">
            <div className="flex justify-start">
              <Button
                variant="ghost"
                asChild
                className="h-auto px-0 text-sm"
              >
                <Link href="/" className="inline-flex items-center gap-2">
                  <ArrowLeftToLine className="size-4" />
                  <span>Back home</span>
                </Link>
              </Button>
            </div>
            <div className="w-full">
              {showTabs ? (
                <div className="flex flex-col gap-6">
                  <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="login">Login</TabsTrigger>
                      <TabsTrigger value="sign-up">Sign up</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {mode === "sign-up" ? <SignUpForm /> : <LoginForm />}
                </div>
              ) : null}
              {mode === "forgot-password" ? <ForgotPasswordForm /> : null}
              {mode === "update-password" ? <UpdatePasswordForm /> : null}
              {mode === "sign-up-success" ? <SignUpSuccessCard /> : null}
              {mode === "error" ? (
                <AuthErrorCard code={errorCode} message={errorMessage} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <Image
          src="/bear.png"
          alt="Image"
          fill
          sizes="50vw"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}

export function AuthPageContent() {
  const searchParams = useSearchParams();

  return (
    <AuthPageClient
      mode={getAuthMode(searchParams.get("mode"))}
      errorCode={searchParams.get("code")}
      errorMessage={searchParams.get("message")}
    />
  );
}
