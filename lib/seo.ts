import type { Metadata } from "next";

const siteName = "AutoBot";
const defaultDescription =
  "AutoBot turns your app ideas into working software with a fast, guided build workflow.";

export function createPageMetadata({
  title,
  description = defaultDescription,
  path = "/",
}: {
  title: string;
  description?: string;
  path?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export const seoDefaults = {
  siteName,
  defaultDescription,
};
