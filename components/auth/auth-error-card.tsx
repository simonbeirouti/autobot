"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

import { getAuthErrorDisplay } from "@/components/auth/auth-error";

export function AuthErrorCard({
  className,
  code,
  message,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  code?: string | null;
  message?: string | null;
}) {
  const errorDisplay = getAuthErrorDisplay(code ?? null, message ?? null);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{errorDisplay.title}</CardTitle>
          <CardDescription>{errorDisplay.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You can head back into the auth flow below.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href={errorDisplay.primaryAction.href}>
              {errorDisplay.primaryAction.label}
            </Link>
          </Button>
          {errorDisplay.secondaryAction ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={errorDisplay.secondaryAction.href}>
                {errorDisplay.secondaryAction.label}
              </Link>
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}
