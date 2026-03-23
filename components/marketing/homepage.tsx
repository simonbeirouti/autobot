import { HomepageFeaturePanels } from "@/components/marketing/homepage-feature-panels";
import { HomepageToolCategories } from "@/components/marketing/homepage-tool-categories";
import { HomepageHero } from "@/components/marketing/homepage-hero";

const heroWords = {
  left: ["Turn", "product", "ideas", "into", "working"],
  right: ["software", "without", "the", "friction"],
};

const capabilityCards = [
  {
    title: "Guide",
    subtitle: "Clarify the objective before the build drifts.",
    description:
      "Start with the business outcome. AutoBot keeps asking the next useful question until the scope is actionable.",
    accent: "bands" as const,
  },
  {
    title: "Draft",
    subtitle: "Shape raw intent into a plan you can review.",
    description:
      "AutoBot turns rough prompts into structured drafts with assumptions, next steps, and a clearer execution path.",
    accent: "wave" as const,
  },
  {
    title: "Interact",
    subtitle: "Connect the right systems before execution stalls.",
    description:
      "The workspace tracks tool readiness, missing inputs, and blockers so runs can move through real operational steps.",
    accent: "burst" as const,
  },
  {
    title: "Execute",
    subtitle: "Keep the context, progress, and follow-up in one place.",
    description:
      "From intake to run state, AutoBot preserves the thread of work so teams can keep shipping instead of reconstructing context.",
    accent: "loop" as const,
  },
];

export function MarketingHomepage() {
  return (
    <>
      <HomepageHero words={heroWords} />
      <HomepageToolCategories />
      <HomepageFeaturePanels cards={capabilityCards} />
    </>
  );
}
