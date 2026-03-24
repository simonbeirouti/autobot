"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition, Variants } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { buildAuthHref } from "@/components/auth/auth-route";
import { openMarketingContact } from "@/components/marketing/marketing-contact-sheet";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { DASHBOARD_HOME_ROUTE, PUBLIC_MARKETING_ROUTES } from "@/lib/routes";

function MobileNavMenuLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <Button asChild className="flex text-base h-14 w-full items-center" size="lg" variant="outline">
      <Link
        href={href}
        onClick={(event) => {
          event.preventDefault();
          onNavigate(href);
        }}
      >
        {label}
      </Link>
    </Button>
  );
}

export function MobileNavMenu({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);

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
    setIsOpen(false);
  }, [pathname]);

  function openMenu() {
    setIsOpen(true);
  }

  function closeMenu() {
    setIsOpen(false);
  }

  function handleMenuToggle() {
    if (isOpen) {
      closeMenu();
      return;
    }

    openMenu();
  }

  function handleNavigation(href: string) {
    closeMenu();

    if (pathname !== href) {
      router.push(href);
    }
  }

  function handleContactNavigation() {
    closeMenu();
    openMarketingContact();
  }

  const panelTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.34, ease: [0.16, 1, 0.3, 1] as const };
  const panelExitTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.32, 0, 0.67, 0] as const };
  const itemTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };
  const itemExitTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.42, ease: [0.24, 0.95, 0.32, 1] as const };

  const panelVariants: Variants = {
    closed: {
      opacity: 0,
      y: -10,
      scale: 0.985,
      transition: shouldReduceMotion
        ? panelExitTransition
        : {
            ...panelExitTransition,
            when: "afterChildren",
          },
    },
    open: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: panelTransition,
    },
  };

  const listVariants: Variants = {
    closed: {
      transition: shouldReduceMotion
        ? { duration: 0 }
        : {
            staggerChildren: 0.09,
            staggerDirection: -1,
          },
    },
    open: {
      transition: shouldReduceMotion
        ? { duration: 0 }
        : {
            when: "beforeChildren",
            delayChildren: 0.04,
            staggerChildren: 0.06,
          },
    },
  };

  const itemVariants: Variants = {
    closed: {
      opacity: 0,
      y: 10,
      transition: itemExitTransition,
    },
    open: {
      opacity: 1,
      y: 0,
      transition: itemTransition,
    },
  };

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

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            animate="open"
            className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-40 origin-top"
            exit="closed"
            initial="closed"
            variants={panelVariants}
          >
            <motion.div
              className="flex max-h-[calc(100svh-7rem)] min-h-0 flex-col overflow-y-auto border border-border/70 bg-background/95 px-5 py-5 text-foreground shadow-[0_24px_55px_-32px_rgba(15,23,42,0.32)] backdrop-blur-md supports-[backdrop-filter]:bg-background/92"
              variants={listVariants}
            >
              <div className="flex flex-col gap-2">
                {PUBLIC_MARKETING_ROUTES.map((route) => (
                  <motion.div key={route.href} variants={itemVariants}>
                    <MobileNavMenuLink
                      href={route.href}
                      label={route.label}
                      onNavigate={handleNavigation}
                    />
                  </motion.div>
                ))}
              </div>

              <motion.div className="mt-auto pt-2" variants={itemVariants}>
                <Button
                  variant="outline"
                  className="h-14 w-full text-base"
                  onClick={handleContactNavigation}
                >
                  Contact
                </Button>

                {isAuthenticated ? (
                  <div className="mt-2 flex w-full gap-2">
                    <Button
                      className="h-14 text-base flex-1"
                      onClick={() => handleNavigation(DASHBOARD_HOME_ROUTE)}
                    >
                      Dashboard
                    </Button>
                    <LogoutButton
                      className="h-14 px-6 text-base"
                      onLogout={closeMenu}
                      variant="outline"
                    />
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-14 w-full text-base"
                      onClick={() => handleNavigation(buildAuthHref("login"))}
                    >
                      Sign in
                    </Button>
                    <Button
                      className="h-14 w-full text-base"
                      onClick={() => handleNavigation(buildAuthHref("sign-up"))}
                    >
                      Sign up
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
