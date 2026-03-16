import type { RecommendedToolkit } from "@/lib/tools/types";

export const RECOMMENDED_TOOLKITS: RecommendedToolkit[] = [
  {
    slug: "googlecalendar",
    title: "Google Calendar",
    description: "Read schedules, find free slots, and create or update calendar events.",
    category: "calendar",
    isRecommended: true,
  },
  {
    slug: "notion",
    title: "Notion",
    description: "Search pages and databases, then create or update workspace content.",
    category: "cms",
    isRecommended: true,
  },
  {
    slug: "slackbot",
    title: "Slack",
    description: "Send updates and coordinate work across channels and direct messages.",
    category: "messaging",
    isRecommended: true,
  },
  {
    slug: "linear",
    title: "Linear",
    description: "Create issues, inspect projects, and push workflow actions into delivery.",
    category: "work",
    isRecommended: true,
  },
  {
    slug: "hubspot",
    title: "HubSpot",
    description: "Search and enrich CRM records for revenue and pipeline workflows.",
    category: "crm",
    isRecommended: false,
  },
  {
    slug: "tavily",
    title: "Tavily",
    description: "Augment internal context with web search and research results.",
    category: "search",
    isRecommended: false,
  },
];

export const DEFAULT_ONBOARDING_TOOLKITS = RECOMMENDED_TOOLKITS.filter(
  (toolkit) => toolkit.isRecommended,
).map((toolkit) => toolkit.slug);
