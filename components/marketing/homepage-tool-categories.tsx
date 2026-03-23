"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { EncryptedText } from "@/components/ui/encrypted-text";

const categoryRows = [
  {
    title: "Communication",
    description: "Slack, Gmail, Outlook, and Teams for messages, threads, replies, and signals.",
    indicators: ["Inbox", "Threads", "Replies", "Signals"],
  },
  {
    title: "Productivity",
    description: "Notion, ClickUp, Asana, and task systems for plans, docs, tasks, and execution.",
    indicators: ["Tasks", "Docs", "Projects", "Views"],
  },
  {
    title: "CRM",
    description: "HubSpot and Salesforce for leads, accounts, deals, and pipeline movement.",
    indicators: ["Leads", "Accounts", "Deals", "Pipeline"],
  },
  {
    title: "Engineering",
    description: "GitHub, Jira, and GitLab for issues, repos, pull requests, and delivery signals.",
    indicators: ["Issues", "Repos", "PRs", "Deploys"],
  },
  {
    title: "Support",
    description: "Zendesk and Intercom for tickets, queues, escalations, and customer context.",
    indicators: ["Tickets", "Queues", "SLA", "Escalations"],
  },
  {
    title: "Data & Docs",
    description: "Drive, Sheets, Airtable, and internal docs for records, tables, files, and search.",
    indicators: ["Files", "Tables", "Records", "Search"],
  },
] as const;

const frontVariants = {
  inactive: {
    rotateX: 0,
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  active: {
    rotateX: 82,
    opacity: 0,
    y: -14,
    scale: 0.975,
    filter: "blur(3px)",
  },
};

const backVariants = {
  initial: {
    rotateX: -82,
    opacity: 0,
    y: 14,
    scale: 0.975,
    filter: "blur(3px)",
  },
  animate: {
    rotateX: 0,
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: {
    rotateX: 82,
    opacity: 0,
    y: -14,
    scale: 0.975,
    filter: "blur(3px)",
  },
};

const stackVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
};

const rowRevealVariants = {
  hidden: {
    opacity: 0,
    y: 28,
    filter: "blur(6px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export function HomepageToolCategories() {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  const shouldReduceMotion = useReducedMotion();

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.78, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <section className="min-h-[75svh] bg-background">
        <div className="mx-auto flex min-h-[75svh] w-full max-w-7xl items-center justify-center px-6 sm:px-8 lg:px-12">
          <motion.div
            variants={stackVariants}
            initial={shouldReduceMotion ? undefined : "hidden"}
            whileInView={shouldReduceMotion ? undefined : "visible"}
            viewport={{ once: true, amount: 0.3 }}
            className="flex min-h-[75svh] w-full max-w-5xl flex-col items-center justify-start pt-[10svh]"
          >
          {categoryRows.map((row, index) => {
            const isActive = activeIndex === index;

            return (
              <motion.button
                key={row.title}
                variants={shouldReduceMotion ? undefined : rowRevealVariants}
                type="button"
                aria-pressed={isActive}
                className="group relative block w-full"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(isActive ? null : index)}
              >
                <motion.div
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : { height: isActive ? "12.5rem" : "4.5rem" }
                  }
                  transition={transition}
                  className="relative flex h-full w-full items-center justify-center overflow-hidden px-4 py-0 text-center sm:px-6"
                >
                  <motion.div
                    variants={frontVariants}
                    animate={isActive ? "active" : "inactive"}
                    transition={transition}
                    style={{ transformOrigin: "center center" }}
                    className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center"
                  >
                    <p className="mx-auto text-[clamp(1.9rem,4.4vw,3.8rem)] font-extralight leading-[0.82] tracking-[-0.09em]">
                      <EncryptedText
                        text={row.title}
                        revealDelayMs={18 + index * 4}
                        flipDelayMs={30}
                        encryptedClassName="text-foreground/40"
                        revealedClassName="text-foreground"
                      />
                    </p>
                  </motion.div>

                  <AnimatePresence initial={false}>
                    {isActive ? (
                      <motion.div
                        key={`${row.title}-details`}
                        variants={backVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={transition}
                        style={{ transformOrigin: "center center" }}
                        className="relative mx-auto flex w-full max-w-4xl items-center justify-center py-1 text-center"
                      >
                        <span className="absolute left-0 top-0 text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
                          {row.indicators[0]}
                        </span>
                        <span className="absolute right-0 top-0 text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
                          {row.indicators[1]}
                        </span>
                        <span className="absolute bottom-0 left-0 text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
                          {row.indicators[2]}
                        </span>
                        <span className="absolute bottom-0 right-0 text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
                          {row.indicators[3]}
                        </span>

                        <div className="mx-auto flex max-w-2xl flex-col items-center gap-1 text-center">
                          <p className="mx-auto text-[clamp(1.9rem,4.4vw,3.8rem)] font-extralight leading-[0.82] tracking-[-0.09em]">
                            {row.title}
                          </p>
                          <p className="max-w-[30ch] text-sm pt-2 leading-5 text-muted-foreground sm:text-base">
                            {row.description}
                          </p>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              </motion.button>
            );
          })}
          </motion.div>
      </div>
    </section>
  );
}
