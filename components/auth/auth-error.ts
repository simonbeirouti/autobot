import { AuthMode, buildAuthHref } from "@/components/auth/auth-route";

type AuthFlow = "login" | "sign-up" | "forgot-password";

export type AuthErrorCode =
  | "account-exists"
  | "invalid-credentials"
  | "login-failed"
  | "sign-up-failed"
  | "reset-failed"
  | "unknown";

type AuthErrorAction = {
  href: string;
  label: string;
};

export type AuthErrorDisplay = {
  description: string;
  primaryAction: AuthErrorAction;
  secondaryAction?: AuthErrorAction;
  title: string;
};

export type AuthFlowError = {
  code: AuthErrorCode;
  message: string;
};

function createAction(mode: AuthMode, label: string) {
  return {
    href: buildAuthHref(mode),
    label,
  };
}

export function buildAuthErrorHref(code: AuthErrorCode, message?: string) {
  return buildAuthHref("error", {
    code,
    message,
  });
}

export function getAuthErrorDisplay(
  code: string | null,
  message: string | null,
): AuthErrorDisplay {
  const fallbackMessage = message?.trim();

  switch (code) {
    case "account-exists":
      return {
        title: "Account already exists",
        description:
          "That email is already registered. Try logging in instead, or reset your password if you need a new one.",
        primaryAction: createAction("login", "Go to login"),
        secondaryAction: createAction("forgot-password", "Reset password"),
      };
    case "invalid-credentials":
      return {
        title: "We couldn't sign you in",
        description:
          "Your email or password didn't match our records. Try again, create an account, or reset your password.",
        primaryAction: createAction("login", "Try login again"),
        secondaryAction: createAction("sign-up", "Create account"),
      };
    case "login-failed":
      return {
        title: "Login failed",
        description:
          fallbackMessage ??
          "We couldn't complete your sign-in right now. Please try again, or create an account if you're new here.",
        primaryAction: createAction("login", "Try login again"),
        secondaryAction: createAction("sign-up", "Go to sign up"),
      };
    case "sign-up-failed":
      return {
        title: "Sign up failed",
        description:
          fallbackMessage ??
          "We couldn't create your account right now. Please try again, or login if you already have one.",
        primaryAction: createAction("sign-up", "Try sign up again"),
        secondaryAction: createAction("login", "Go to login"),
      };
    case "reset-failed":
      return {
        title: "Reset request failed",
        description:
          fallbackMessage ??
          "We couldn't send the reset email right now. Please try again, or head back to login.",
        primaryAction: createAction("forgot-password", "Try again"),
        secondaryAction: createAction("login", "Back to login"),
      };
    default:
      return {
        title: "Sorry, something went wrong",
        description:
          fallbackMessage ?? "An unspecified authentication error occurred.",
        primaryAction: createAction("login", "Go to login"),
        secondaryAction: createAction("sign-up", "Go to sign up"),
      };
  }
}

export function getAuthFlowError(error: unknown, flow: AuthFlow): AuthFlowError {
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("user already registered") ||
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already exists")
  ) {
    return {
      code: "account-exists",
      message,
    };
  }

  if (
    normalizedMessage.includes("invalid login credentials") ||
    normalizedMessage.includes("invalid credentials")
  ) {
    return {
      code: "invalid-credentials",
      message,
    };
  }

  if (flow === "login") {
    return {
      code: "login-failed",
      message,
    };
  }

  if (flow === "sign-up") {
    return {
      code: "sign-up-failed",
      message,
    };
  }

  return {
    code: "reset-failed",
    message,
  };
}
