"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { EncryptedText } from "@/components/ui/encrypted-text";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type AccentKind = "bands" | "wave" | "burst" | "loop";

type CapabilityCard = {
  title: string;
  subtitle: string;
  description: string;
  accent: AccentKind;
};

type HomepageFeaturePanelsProps = {
  cards: CapabilityCard[];
};

const panelStyles = [
  {
    surface: "bg-[#88A95D] text-[#111111]",
    art: "text-[#111111]/58",
  },
  {
    surface: "bg-[#6E9FAE] text-[#111111]",
    art: "text-[#111111]/58",
  },
  {
    surface: "bg-[#D98C44] text-[#111111]",
    art: "text-[#111111]/58",
  },
  {
    surface: "bg-[#F1E7D8] text-[#111111]",
    art: "text-[#111111]/58",
  },
] as const;

export function HomepageFeaturePanels({ cards }: HomepageFeaturePanelsProps) {
  const [activeIndex, setActiveIndex] = useState(1);
  const shouldReduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (shouldReduceMotion) {
        return;
      }

      const section = sectionRef.current;
      const scroller = document.getElementById("marketing-scroll-root");

      if (!section || !scroller) {
        return;
      }

      const allPanels = gsap.utils.toArray<HTMLElement>("[data-feature-panel]", section);

      if (allPanels.length === 0) {
        return;
      }

      gsap.set(allPanels, {
        autoAlpha: 0,
        y: 80,
      });

      gsap.to(allPanels, {
        autoAlpha: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.16,
        ease: "power3.out",
        scrollTrigger: {
          trigger: section,
          scroller,
          start: "top 72%",
          toggleActions: "play none none reverse",
        },
      });
    },
    { scope: sectionRef, dependencies: [cards.length, Boolean(shouldReduceMotion)] },
  );

  return (
    <section ref={sectionRef} className="bg-background pb-24 pt-8 lg:pb-28 lg:pt-12">
      <div className="w-full">
        <div className="grid gap-8 px-6 pb-12 pt-4 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:pb-14 lg:pt-8">
          <div className="space-y-5 lg:py-12">
            <p className="text-[0.78rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <EncryptedText
                text="Core capabilities"
                revealDelayMs={18}
                flipDelayMs={28}
                encryptedClassName="opacity-50"
                revealedClassName="opacity-100"
              />
            </p>
            <h2 className="max-w-md text-3xl font-semibold leading-[0.9] tracking-[-0.06em] text-balance">
              <EncryptedText
                text="Four sections, one operating model."
                revealDelayMs={22}
                flipDelayMs={32}
                encryptedClassName="opacity-40"
                revealedClassName="opacity-100"
              />
            </h2>
          </div>

          <div className="space-y-6 lg:pt-10">
            <div className="h-px w-full bg-border" />
            <p className="max-w-[46rem] text-base leading-[1.45] tracking-[-0.02em] text-muted-foreground sm:text-[1.15rem]">
              <EncryptedText
                text="Each panel holds its width. The active one simply opens up, pulls more detail forward, and shows where AutoBot adds the most leverage."
                revealDelayMs={10}
                flipDelayMs={26}
                encryptedClassName="opacity-45"
                revealedClassName="opacity-100"
              />
            </p>
          </div>
        </div>

        <div className="grid gap-1 md:grid-cols-2 xl:hidden">
          {cards.map((card, index) => {
            const palette = panelStyles[index % panelStyles.length];

            return (
              <article
                key={card.title}
                data-feature-panel
                className={cn("overflow-hidden", palette.surface)}
              >
                <FeaturePanelCard
                  card={card}
                  index={index}
                  active={index === activeIndex}
                  palette={palette}
                  compact
                />
              </article>
            );
          })}
        </div>

        <div
          className="hidden w-full gap-px xl:flex"
          onMouseLeave={() => setActiveIndex(1)}
        >
          {cards.map((card, index) => {
            const active = index === activeIndex;
            const palette = panelStyles[index % panelStyles.length];

            return (
              <motion.button
                key={card.title}
                data-feature-panel
                type="button"
                aria-pressed={active}
                className={cn(
                  "relative min-w-0 basis-0 overflow-hidden text-left",
                  palette.surface,
                )}
                style={{ flexBasis: 0 }}
                onFocus={() => setActiveIndex(index)}
                onMouseEnter={() => setActiveIndex(index)}
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        flexGrow: active ? 1.45 : 0.85,
                      }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 260, damping: 30, mass: 0.9 }
                }
              >
                <FeaturePanelCard
                  card={card}
                  index={index}
                  active={active}
                  palette={palette}
                />
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type FeaturePanelCardProps = {
  card: CapabilityCard;
  index: number;
  active: boolean;
  palette: (typeof panelStyles)[number];
  compact?: boolean;
};

function FeaturePanelCard({
  card,
  index,
  active,
  palette,
  compact = false,
}: FeaturePanelCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "flex items-center justify-center px-6 py-7 text-center sm:px-7 sm:py-8",
        compact ? "min-h-[30rem] sm:min-h-[34rem] md:aspect-square" : "h-[36rem] 2xl:h-[40rem]",
      )}
    >
      <div className="flex w-full max-w-[36rem] flex-col items-center justify-center gap-10">
        <div className="space-y-3 text-center">
          <p className="mx-auto max-w-[10ch] text-[clamp(2rem,6vw,2.5rem)] font-semibold uppercase leading-[0.88] tracking-[-0.07em] md:max-w-[9ch] md:text-[clamp(2rem,4vw,2.8rem)] 2xl:text-[2.8rem]">
            <EncryptedText
              text={card.title}
              revealDelayMs={20 + index * 5}
              flipDelayMs={28}
              encryptedClassName="opacity-45"
              revealedClassName="opacity-100"
            />
          </p>
          <p className="mx-auto max-w-[24ch] text-[0.95rem] leading-[1.2] tracking-[-0.03em] md:max-w-[22ch] md:text-[0.9rem] lg:text-base">
            <EncryptedText
              text={card.subtitle}
              revealDelayMs={10}
              flipDelayMs={24}
              encryptedClassName="opacity-45"
              revealedClassName="opacity-100"
            />
          </p>
        </div>

        <motion.div
          aria-hidden="true"
          className={cn("flex w-full items-center justify-center", palette.art)}
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  scale: active ? 1 : 0.94,
                  opacity: active ? 1 : 0.72,
                }
          }
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28 }}
        >
          <FeatureGlyph accent={card.accent} compact={compact} />
        </motion.div>

        <div className="space-y-5">
          <p className="font-mono text-base uppercase tracking-[0.24em]">{`0${index + 1} / 04`}</p>
          <motion.p
            className="mx-auto max-w-[28ch] font-mono text-[0.86rem] uppercase leading-[1.24] tracking-[0.04em] text-balance sm:max-w-[30ch] sm:text-[0.9rem] md:max-w-[24ch] md:text-[0.8rem] lg:max-w-[30ch] lg:text-[0.92rem] xl:max-w-[34ch] xl:text-[0.95rem]"
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: active ? 1 : 0.82,
                  }
            }
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22 }}
          >
            <EncryptedText
              text={card.description}
              revealDelayMs={8}
              flipDelayMs={22}
              encryptedClassName="opacity-45"
              revealedClassName="opacity-100"
            />
          </motion.p>
        </div>
      </div>
    </div>
  );
}

function FeatureGlyph({
  accent,
  compact = false,
}: {
  accent: AccentKind;
  compact?: boolean;
}) {
  const sizeClass = compact ? "max-w-[15rem]" : "max-w-[21rem]";

  if (accent === "bands") {
    return (
      <svg
        viewBox="0 0 340 260"
        className={cn("h-auto w-[78%]", sizeClass)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {Array.from({ length: 16 }).map((_, index) => (
          <path
            key={index}
            d={`M38 ${52 + index * 10}C92 ${22 + index * 4},128 ${170 - index * 3},170 ${138 + index * 2}C214 ${104 - index * 2},254 ${220 - index * 4},304 ${182 + index * 1.5}`}
            stroke="currentColor"
            strokeOpacity={0.16 + index * 0.032}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="0.01 8.5"
          />
        ))}
      </svg>
    );
  }

  if (accent === "wave") {
    return (
      <svg
        viewBox="0 0 340 260"
        className={cn("h-auto w-[78%]", sizeClass)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {Array.from({ length: 20 }).map((_, index) => (
          <path
            key={index}
            d={`M34 ${42 + index * 9}C90 ${38 + index * 1.5},114 ${174 - index * 3.2},170 ${142 + index * 1.4}C224 ${108 - index * 2.2},252 ${194 - index * 2.8},306 ${166 + index * 1.6}`}
            stroke="currentColor"
            strokeOpacity={0.12 + index * 0.028}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="0.01 7.5"
          />
        ))}
      </svg>
    );
  }

  if (accent === "burst") {
    return (
      <svg
        viewBox="0 0 340 260"
        className={cn("h-auto w-[72%]", sizeClass)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {Array.from({ length: 18 }).map((_, index) => {
          const angle = -110 + index * 12;
          const x = 170 + Math.cos((angle * Math.PI) / 180) * 112;
          const y = 130 + Math.sin((angle * Math.PI) / 180) * 112;

          return (
            <path
              key={index}
              d={`M170 130L${x.toFixed(2)} ${y.toFixed(2)}`}
              stroke="currentColor"
              strokeOpacity={0.14 + index * 0.03}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeDasharray="0.01 8"
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 340 260"
      className={cn("h-auto w-[76%]", sizeClass)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from({ length: 15 }).map((_, index) => (
        <path
          key={index}
          d={`M64 ${64 + index * 8}C64 ${32 + index * 5},96 ${28 + index * 5},126 ${28 + index * 5}H182C212 ${28 + index * 5},246 ${54 + index * 5},246 ${86 + index * 5}C246 ${118 + index * 5},212 ${144 + index * 5},182 ${144 + index * 5}H146C116 ${144 + index * 5},88 ${168 + index * 5},88 ${198 + index * 5}`}
          stroke="currentColor"
          strokeOpacity={0.13 + index * 0.032}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="0.01 8"
        />
      ))}
    </svg>
  );
}
