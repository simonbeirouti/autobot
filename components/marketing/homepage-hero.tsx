"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { EncryptedText } from "@/components/ui/encrypted-text";

gsap.registerPlugin(useGSAP);

type HomepageHeroProps = {
  words: {
    left: string[];
    right: string[];
  };
};

type PhraseLayout = {
  left: string;
  top: string;
  xPercent: number;
  textAlign: "left" | "right" | "center";
};

const DESKTOP_START: PhraseLayout[] = [
  { left: "50%", top: "36%", xPercent: -70, textAlign: "center" },
  { left: "50%", top: "53%", xPercent: -100, textAlign: "right" },
  { left: "50%", top: "53%", xPercent: 6, textAlign: "left" },
  { left: "50%", top: "68%", xPercent: -50, textAlign: "center" },
];

const DESKTOP_END: PhraseLayout[] = [
  { left: "1%", top: "43%", xPercent: 0, textAlign: "left" },
  { left: "1.5%", top: "58%", xPercent: 0, textAlign: "left" },
  { left: "99%", top: "58%", xPercent: -100, textAlign: "right" },
  { left: "99%", top: "73%", xPercent: -100, textAlign: "right" },
];

const MOBILE_START: PhraseLayout[] = [
  { left: "50%", top: "41%", xPercent: -60, textAlign: "center" },
  { left: "50%", top: "52%", xPercent: -95, textAlign: "right" },
  { left: "50%", top: "52%", xPercent: 15, textAlign: "left" },
  { left: "50%", top: "63%", xPercent: -50, textAlign: "center" },
];

const MOBILE_END: PhraseLayout[] = [
  { left: "6%", top: "46%", xPercent: 0, textAlign: "left" },
  { left: "6%", top: "54%", xPercent: 0, textAlign: "left" },
  { left: "95%", top: "54%", xPercent: -100, textAlign: "right" },
  { left: "95%", top: "62%", xPercent: -100, textAlign: "right" },
];

export function HomepageHero({ words }: HomepageHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const phraseRefs = useRef<HTMLSpanElement[]>([]);
  const shouldReduceMotion = useReducedMotion();

  const phrases = [
    words.left.slice(0, 3).join(" "),
    words.left.slice(3).join(" "),
    words.right[0],
    words.right.slice(1).join(" "),
  ];

  useGSAP(
    () => {
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      const startLayout = isMobile ? MOBILE_START : DESKTOP_START;
      const endLayout = isMobile ? MOBILE_END : DESKTOP_END;

      phraseRefs.current.forEach((phraseRef, index) => {
        const layout = startLayout[index] ?? startLayout[0];
        if (!phraseRef) {
          return;
        }

        phraseRef.style.textAlign = layout.textAlign;
        gsap.set(phraseRef, {
          left: layout.left,
          top: layout.top,
          xPercent: layout.xPercent,
          yPercent: -50,
          opacity: 1,
        });
      });

      if (shouldReduceMotion) {
        phraseRefs.current.forEach((phraseRef, index) => {
          const layout = endLayout[index] ?? endLayout[0];
          if (!phraseRef) {
            return;
          }

          phraseRef.style.textAlign = layout.textAlign;
          gsap.set(phraseRef, {
            left: layout.left,
            top: layout.top,
            xPercent: layout.xPercent,
            yPercent: -50,
          });
        });
        return;
      }

      const timeline = gsap.timeline({
        defaults: {
          duration: 1.5,
          ease: "power3.inOut",
        },
      });

      phraseRefs.current.forEach((phraseRef, index) => {
        const layout = endLayout[index] ?? endLayout[0];
        if (!phraseRef) {
          return;
        }

        timeline.to(
          phraseRef,
          {
            left: layout.left,
            top: layout.top,
            xPercent: layout.xPercent,
            onStart: () => {
              phraseRef.style.textAlign = layout.textAlign;
            },
          },
          0.52,
        );
      });
    },
    {
      scope: sectionRef,
      dependencies: [phrases.join("|"), Boolean(shouldReduceMotion)],
    },
  );

  return (
    <section ref={sectionRef} className="relative bg-background text-foreground">
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] flex-col">
        <div className="relative flex flex-1 items-center justify-center">
          <div className="relative h-[28rem] w-full overflow-hidden md:h-[34rem] -mt-24">
            {phrases.map((phrase, index) => (
              <span
                key={`${phrase}-${index}`}
                ref={(element) => {
                  if (element) {
                    phraseRefs.current[index] = element;
                  }
                }}
                className="absolute block whitespace-nowrap opacity-0 text-[2.3rem] font-extralight tracking-[-0.08em] text-foreground md:text-[5.25rem]"
              >
                <EncryptedText
                  text={phrase}
                  revealDelayMs={20 + index * 5}
                  flipDelayMs={32}
                  encryptedClassName="text-foreground/45"
                  revealedClassName="text-foreground"
                />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
