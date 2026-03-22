export function getSiteUrl() {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!candidate) {
    return "http://localhost:3000";
  }

  const normalized = candidate.startsWith("http") ? candidate : `https://${candidate}`;

  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}
