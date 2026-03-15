type UserLike = {
  sub: string;
  email?: string | null;
};

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "yahoo.com",
  "proton.me",
  "protonmail.com",
]);

export function resolveCompanyKey(user: UserLike) {
  const email = user.email?.trim().toLowerCase();
  const domain = email?.split("@")[1];

  if (domain && !PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return `company:${domain}`;
  }

  return `company:user:${user.sub}`;
}

export function deriveProjectIconKey(name: string) {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() || "?";
}
