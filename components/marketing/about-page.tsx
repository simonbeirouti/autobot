"use client";

import { useCallback, useRef } from "react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { DotFieldCanvas } from "@/components/marketing/dot-field-canvas";
import { openMarketingContact } from "@/components/marketing/marketing-contact-sheet";
import { Button } from "@/components/ui/button";
import { EncryptedText } from "@/components/ui/encrypted-text";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const heroLinks = [
  { id: "platform-clarity", label: "Founders" },
  { id: "platform-velocity", label: "Operators" },
] as const;

const featureSections = [
  {
    id: "platform-clarity",
    eyebrow: "For product leaders",
    title: "Build with clarity before execution eats the roadmap.",
    description:
      "AutoBot turns raw ambition into a working plan, aligns the team on scope, and keeps the path to delivery visible before implementation starts to drift.",
    cta: "Connect with us",
    orientation: "left" as const,
    panels: [
      {
        number: "01",
        title: "Guided planning that converges.",
        body: "Structured prompts, grounded assumptions, and fast iteration help teams turn vague ideas into reviewable execution paths.",
        surface: "bg-[#81afc2]",
      },
      {
        number: "02",
        title: "Operating context that stays intact.",
        body: "Objectives, blockers, and system readiness stay visible so the build keeps moving without constant context reconstruction.",
        surface: "bg-[#f26e3e]",
      },
      {
        number: "03",
        title: "Transparent next steps.",
        body: "Every draft makes the current state, pending decisions, and practical implementation sequence legible to the whole team.",
        surface: "bg-[#ece8e5]",
      },
    ],
  },
  {
    id: "platform-velocity",
    eyebrow: "For execution teams",
    title: "Ship faster with one workspace for planning, tooling, and follow-through.",
    description:
      "The platform connects planning, implementation support, and operational handoff so teams can move from concept to shipped experience without losing momentum.",
    cta: "Open contact form",
    orientation: "right" as const,
    panels: [
      {
        number: "01",
        title: "Plans that are ready to execute.",
        body: "Detailed scopes, assumptions, and acceptance criteria stay attached to the work, reducing re-briefing and execution lag.",
        surface: "bg-[#ece8e5]",
      },
      {
        number: "02",
        title: "Tooling awareness at the right moment.",
        body: "AutoBot surfaces readiness, dependencies, and blockers before a run fails, helping teams spend more time shipping and less time repairing flow.",
        surface: "bg-[#81afc2]",
      },
      {
        number: "03",
        title: "Follow-up that keeps moving.",
        body: "Implementation threads, status, and next actions remain visible after each step so product teams keep momentum across the full build cycle.",
        surface: "bg-[#f26e3e]",
      },
    ],
  },
] as const;

export function AboutPage() {
  const pageRef = useRef<HTMLDivElement>(null);

  const handleJump = useCallback((id: string) => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useGSAP(
    () => {
      const page = pageRef.current;
      const scroller = document.getElementById("marketing-scroll-root");

      if (!page || !scroller || window.matchMedia("(max-width: 1023px)").matches) {
        return;
      }

      const sections = gsap.utils.toArray<HTMLElement>("[data-about-feature-section]", page);

      sections.forEach((section) => {
        const stickyColumn = section.querySelector<HTMLElement>("[data-about-sticky]");
        const panelsColumn = section.querySelector<HTMLElement>("[data-about-panels]");
        const stickyContent = section.querySelector<HTMLElement>("[data-about-sticky-content]");
        const lastPanel = panelsColumn?.querySelector<HTMLElement>("[data-about-panel]:last-child");
        const contactButton = stickyColumn?.querySelector<HTMLElement>("[data-about-contact]");

        if (!stickyColumn || !panelsColumn || !stickyContent || !lastPanel || !contactButton) {
          return;
        }

        ScrollTrigger.create({
          trigger: section,
          scroller,
          start: "top top+=88",
          end: () => {
            const stickyHeight = stickyContent.offsetHeight;
            const buttonBottom = contactButton.offsetTop + contactButton.offsetHeight;
            const releaseOffset = Math.max(stickyHeight - buttonBottom, 0);
            const panelTravel = Math.max(panelsColumn.offsetHeight - stickyHeight, 0);

            return `+=${Math.max(panelTravel - releaseOffset, window.innerHeight * 0.4)}`;
          },
          pin: stickyColumn,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        });
      });
    },
    { scope: pageRef, dependencies: [] },
  );

  return (
    <div ref={pageRef} className="bg-background text-foreground">
      <section className="relative isolate overflow-hidden bg-background">
        <DotFieldCanvas
          variant="bottom-semicircle"
          className="z-0 bg-background opacity-90"
        />
        <div className="relative z-10 flex min-h-[calc(100svh-4rem)] flex-col px-5 pb-6 pt-8 sm:px-8 lg:px-12">
          <div className="flex flex-1 items-center justify-center">
            <div className="max-w-[62rem] text-center">
              <h1 className="text-[2.3rem] font-extralight uppercase leading-[0.9] tracking-[-0.08em] text-foreground md:text-[5.25rem]">
                <EncryptedText
                  text="The future isn't something that happens. It's something we build."
                  revealDelayMs={10}
                  flipDelayMs={20}
                  encryptedClassName="text-foreground/40"
                  revealedClassName="text-foreground"
                />
              </h1>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {heroLinks.map((link) => (
                <Button
                  key={link.id}
                  type="button"
                  size="lg"
                  variant="outline"
                  className="min-w-[10rem] px-5 font-mono uppercase tracking-[0.08em] sm:min-w-[11.5rem]"
                  onClick={() => handleJump(link.id)}
                >
                  {link.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="relative overflow-hidden">
        <div className="relative z-10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="space-y-20 lg:space-y-28">
            {featureSections.map((section) => (
              <AboutFeatureSection
                key={section.id}
                section={section}
                onJumpToContact={openMarketingContact}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutFeatureSection({
  section,
  onJumpToContact,
}: {
  section: (typeof featureSections)[number];
  onJumpToContact: () => void;
}) {
  const isReversed = section.orientation === "right";

  return (
    <section id={section.id} data-about-feature-section className="scroll-mt-24">
      <div
        className={cn(
          "min-h-[80em] grid items-start gap-8 lg:grid-cols-[0.42fr_0.58fr] lg:gap-10",
          isReversed && "lg:grid-cols-[0.58fr_0.42fr]",
        )}
      >
        <div className={cn("lg:self-start", isReversed && "lg:order-2")}>
          <div data-about-sticky className="lg:self-start">
            <div data-about-sticky-content className="max-w-[33rem] space-y-8">
              <div className="space-y-5">
                <p className="font-mono text-[1rem] uppercase tracking-[0.08em] text-[#b0aca7]">
                  {section.eyebrow}
                </p>
                <h2 className="font-extralight uppercase leading-[0.95] tracking-[-0.08em] text-[2.15rem] md:text-[3rem]">
                  {section.title}
                </h2>
              </div>

              <div className="h-px w-full bg-border" />

              <p className="max-w-[31rem] font-mono text-[1rem] uppercase leading-[1.45] tracking-[0.06em] text-muted-foreground">
                {section.description}
              </p>

              <Button
                type="button"
                size="lg"
                variant="outline"
                data-about-contact
                className="px-7 font-mono uppercase tracking-[0.08em]"
                onClick={onJumpToContact}
              >
                {section.cta}
              </Button>
            </div>
          </div>
        </div>

        <div data-about-panels className={cn(isReversed && "lg:order-1")}>
          <div className="flex flex-col gap-3 md:gap-4">
            {section.panels.map((panel) => (
              <article
                key={panel.number}
                data-about-panel
                className={cn(
                  "h-[26rem] px-7 py-8 text-[#111111] sm:px-10 sm:py-10",
                  panel.surface,
                )}
              >
                <div className="flex h-full flex-col">
                  <div className="max-w-2/3 font-extralight uppercase leading-[0.95] tracking-[-0.08em] text-[2.15rem] md:text-[3rem]">
                    {panel.title}
                  </div>

                  <div className="mt-auto space-y-6 pt-16">
                    <p className="font-mono text-[1.1rem] uppercase tracking-[0.08em]">{panel.number}</p>
                    <div className="h-px w-full bg-black/14" />
                    <p className="max-w-[30rem] text-[1.45rem] leading-[1.12] tracking-[-0.04em]">
                      {panel.body}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
