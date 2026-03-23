"use client";

import { useEffect } from "react";

import { RouteStateCard } from "@/components/dashboard/route-state-card";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteStateCard
      title="Something went wrong"
      description="We hit an unexpected issue while loading this page. Try again, or head back home if the problem keeps happening."
      primaryAction={{ href: "/", label: "Go home" }}
      secondaryAction={
        <Button onClick={reset} type="button" variant="outline">
          Try again
        </Button>
      }
    />
  );
}
