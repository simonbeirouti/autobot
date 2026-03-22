"use client";

import { ToolConnectionChecklist } from "@/components/tool-connection-checklist";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ToolkitReadinessItem } from "@/lib/tools/types";

export function ToolConnectModal({
  open,
  onOpenChange,
  requiredToolkitSlugs,
  readiness,
  nextPath,
  title = "Connect tools",
  description = "Finish the required connections so execution can continue.",
  onResolved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredToolkitSlugs: string[];
  readiness: ToolkitReadinessItem[];
  nextPath: string;
  title?: string;
  description?: string;
  onResolved?: (() => void) | undefined;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ToolConnectionChecklist
          requiredToolkitSlugs={requiredToolkitSlugs}
          readiness={readiness}
          nextPath={nextPath}
          onResolved={onResolved}
        />

        <DialogFooter className="items-center justify-end sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
