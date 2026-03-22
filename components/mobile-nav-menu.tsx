"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { buildAuthHref } from "@/components/auth/auth-route";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { DASHBOARD_HOME_ROUTE, PUBLIC_MARKETING_ROUTES } from "@/lib/routes";

const menuLinkClassName =
  "w-full text-left text-[clamp(3rem,14vw,5.5rem)] font-medium leading-[0.92] tracking-tight";

export function MobileNavMenu({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuState, setMenuState] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const isOpen = menuState === "opening" || menuState === "open";
  const isVisible = menuState !== "closed";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (menuState !== "opening") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setMenuState("open");
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [menuState]);

  function openMenu() {
    setPendingHref(null);
    setMenuState("opening");
  }

  function closeMenu() {
    setMenuState((current) => {
      if (current === "closed" || current === "closing") {
        return current;
      }

      return "closing";
    });
  }

  function handleMenuToggle() {
    if (isOpen) {
      closeMenu();
      return;
    }

    openMenu();
  }

  function handleNavigation(href: string) {
    setPendingHref(pathname === href ? null : href);
    closeMenu();
  }

  function handlePanelTransitionEnd() {
    if (menuState === "closing") {
      setMenuState("closed");

      if (pendingHref) {
        router.push(pendingHref);
        setPendingHref(null);
      }
    }
  }

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={handleMenuToggle}
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      {isVisible ? (
        <div
          className={[
            "fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col bg-background text-foreground",
            "transition-transform duration-1000 ease-linear motion-reduce:transition-none",
            menuState === "closing" ? "origin-top scale-y-0" : "origin-top scale-y-100",
          ].join(" ")}
          onTransitionEnd={handlePanelTransitionEnd}
        >
          <div
            className={[
              "mt-auto flex flex-col gap-1 px-5 pb-8 transition-opacity duration-50 motion-reduce:transition-none",
              menuState === "closing" ? "pointer-events-none opacity-0" : "opacity-100",
            ].join(" ")}
          >
            {PUBLIC_MARKETING_ROUTES.map((route) => (
              <button
                key={route.href}
                type="button"
                className={menuLinkClassName}
                onClick={() => handleNavigation(route.href)}
              >
                {route.label}
              </button>
            ))}
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  className={menuLinkClassName}
                  onClick={() => handleNavigation(DASHBOARD_HOME_ROUTE)}
                >
                  Dashboard
                </button>
                <LogoutButton
                  className="h-auto justify-start px-0 text-[clamp(3rem,14vw,5.5rem)] font-medium leading-[0.92] tracking-tight text-inherit hover:bg-transparent hover:text-inherit"
                  onLogout={closeMenu}
                  size="default"
                  variant="ghost"
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={menuLinkClassName}
                  onClick={() => handleNavigation(buildAuthHref("login"))}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={menuLinkClassName}
                  onClick={() => handleNavigation(buildAuthHref("sign-up"))}
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
