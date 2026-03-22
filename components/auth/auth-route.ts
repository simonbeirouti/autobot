export type AuthMode =
  | "login"
  | "sign-up"
  | "forgot-password"
  | "update-password"
  | "sign-up-success"
  | "error";

export const DEFAULT_AUTH_MODE: AuthMode = "login";

const VALID_AUTH_MODES = new Set<AuthMode>([
  "login",
  "sign-up",
  "forgot-password",
  "update-password",
  "sign-up-success",
  "error",
]);

export function getAuthMode(mode: string | null): AuthMode {
  if (mode && VALID_AUTH_MODES.has(mode as AuthMode)) {
    return mode as AuthMode;
  }

  return DEFAULT_AUTH_MODE;
}

export function buildAuthHref(
  mode: AuthMode,
  params?: Record<string, string | null | undefined>,
) {
  const searchParams = new URLSearchParams();

  if (mode !== DEFAULT_AUTH_MODE) {
    searchParams.set("mode", mode);
  }

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();

  return query ? `/auth?${query}` : "/auth";
}
