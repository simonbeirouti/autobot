"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PUBLIC_MARKETING_ROUTES } from "@/lib/routes";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const currentYear = new Date().getFullYear();
const wordmarkLetters = ["A", "U", "T", "O", "B", "O", "T"] as const;

export function MarketingFooter() {
  const footerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const footer = footerRef.current;
      const scroller = document.getElementById("marketing-scroll-root");

      if (!footer || !scroller) {
        return;
      }

      const panel = footer.querySelector<HTMLElement>("[data-footer-panel]");

      if (!panel) {
        return;
      }

      gsap.set(panel, {
        yPercent: 16,
        autoAlpha: 0,
        clipPath: "inset(100% 0 0 0)",
      });

      ScrollTrigger.create({
        trigger: footer,
        scroller,
        start: "top bottom",
        end: "top 10%",
        scrub: 1,
        onUpdate: (self) => {
          const progress = self.progress;

          gsap.set(panel, {
            yPercent: 16 * (1 - progress),
            autoAlpha: progress,
            clipPath: `inset(${(1 - progress) * 100}% 0 0 0)`,
          });
        },
        onLeaveBack: () => {
          gsap.set(panel, {
            yPercent: 16,
            autoAlpha: 0,
            clipPath: "inset(100% 0 0 0)",
          });
        },
        onEnter: () => {
          gsap.set(panel, {
            yPercent: 0,
            autoAlpha: 1,
            clipPath: "inset(0% 0 0 0)",
          });
        },
      });
    },
    { scope: footerRef },
  );

  return (
    <footer ref={footerRef} className="min-h-[calc(100svh-4rem)] bg-primary text-foreground">
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-12 lg:py-12">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.34em] font-semibold sm:text-sm">
              Sign up for updates
            </p>
            <div className="max-w-4xl">
              <Input
                type="email"
                placeholder="Enter your email address"
                aria-label="Email address"
                className="h-auto w-full border-x-0 border-t-0 border-b border-foreground/30 bg-transparent px-0 py-2 text-[clamp(2.2rem,5vw,4.4rem)] font-semibold leading-[0.96] tracking-[-0.07em] text-foreground shadow-none placeholder:text-foreground/80 focus-visible:border-foreground/55 focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
          </div>

          <Button
            size="lg"
            className="h-12 min-w-40 rounded-none bg-background text-background-foreground px-6 font-medium uppercase tracking-[0.16em]"
          >
            Subscribe
          </Button>
        </div>

        <div
          data-footer-panel
          className="mt-6 flex flex-1 flex-col bg-background px-5 py-6"
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:gap-12">
            <div className="flex flex-col">
              <div className="space-y-4">
                <nav aria-label="Footer" className="flex flex-col items-start gap-2 sm:gap-3">
                  {PUBLIC_MARKETING_ROUTES.map((route) => (
                    <Link
                      key={route.href}
                      href={route.href}
                      className="text-[clamp(1.9rem,3vw,3.4rem)] font-medium leading-[0.92] tracking-[-0.06em] transition-colors"
                    >
                      {route.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-10">
              <div className="space-y-4">
                <p className="font-mono text-xs uppercase tracking-[0.34em] text-muted-foreground sm:text-sm">
                  Forged on Earth
                </p>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
                  1 Human & 1 AI, created this to automate aspects of his own life. 
                </p>
              </div>

              <div className="grid gap-6 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground sm:grid-cols-2 sm:text-sm">
                <p>{currentYear} AutoBot</p>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-12 sm:pt-16 lg:pt-20">
            <div className="flex w-full items-end justify-between gap-1 text-[clamp(4.4rem,15vw,16rem)] font-semibold leading-[0.82] tracking-[-0.11em] text-primary/90 sm:gap-2 sm:pr-8">
              {wordmarkLetters.map((letter, index) => (
                <span key={`${letter}-${index}`} className="block">
                  {letter}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
