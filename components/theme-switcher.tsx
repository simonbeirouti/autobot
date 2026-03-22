"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeSwitcher() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? resolvedTheme ?? theme ?? "light" : "light";
  const isDark = activeTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = isDark ? "Dark" : "Light";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch theme. Current preference: ${label}`}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}
