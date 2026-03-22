import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type RouteStateCardProps = {
  title: string;
  description: string;
  primaryAction?: {
    href: string;
    label: string;
  };
  secondaryAction?: React.ReactNode;
};

export function RouteStateCard({
  title,
  description,
  primaryAction,
  secondaryAction,
}: RouteStateCardProps) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-sm leading-6">{description}</CardDescription>
        </CardHeader>
        {primaryAction || secondaryAction ? (
          <CardFooter className="flex flex-wrap gap-3">
            {primaryAction ? (
              <Button asChild>
                <Link href={primaryAction.href}>{primaryAction.label}</Link>
              </Button>
            ) : null}
            {secondaryAction}
          </CardFooter>
        ) : (
          <CardContent />
        )}
      </Card>
    </div>
  );
}
