"use client";

import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type AuthUser = {
  avatar: string;
  email: string | null;
  id: string;
  name: string;
};

type AuthContextValue = {
  isLoading: boolean;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_USER_STORAGE_KEY = "autobot-auth-user";

function getDisplayName(user: {
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
  };
}) {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;

  if (metadataName) {
    return metadataName;
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "User";
}

function mapUser(user: User | null): AuthUser | null {
  if (!user) {
    return null;
  }

  return {
    avatar: user.user_metadata?.avatar_url ?? "",
    email: user.email ?? null,
    id: user.id,
    name: getDisplayName(user),
  };
}

function readStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AuthUser>;

    if (
      typeof parsed?.id !== "string" ||
      parsed.id.length === 0 ||
      typeof parsed?.name !== "string" ||
      typeof parsed?.avatar !== "string" ||
      (parsed.email !== null && parsed.email !== undefined && typeof parsed.email !== "string")
    ) {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      return null;
    }

    return {
      avatar: parsed.avatar,
      email: parsed.email ?? null,
      id: parsed.id,
      name: parsed.name,
    };
  } catch {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousUserIdRef = useRef<string | null>(null);
  const hasResolvedInitialSessionRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = readStoredUser();

    if (!storedUser) {
      return;
    }

    previousUserIdRef.current = storedUser.id;
    setUser(storedUser);
  }, []);

  const applySession = useEffectEvent(
    async ({ refreshServer, nextUser }: { refreshServer: boolean; nextUser: AuthUser | null }) => {
      const previousUserId = previousUserIdRef.current;
      const nextUserId = nextUser?.id ?? null;
      const userChanged = previousUserId !== nextUserId;

      previousUserIdRef.current = nextUserId;
      setUser(nextUser);
      setIsLoading(false);

      if (typeof window !== "undefined") {
        if (nextUser) {
          window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUser));
        } else {
          window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        }
      }

      if (refreshServer && (userChanged || (!nextUserId && previousUserId))) {
        router.refresh();
      }
    },
  );

  const handleAuthStateChange = useEffectEvent(
    async (event: AuthChangeEvent, session: Session | null) => {
      await applySession({
        nextUser: mapUser(session?.user ?? null),
        refreshServer:
          hasResolvedInitialSessionRef.current &&
          (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED"),
      });

      hasResolvedInitialSessionRef.current = true;
    },
  );

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted || error || hasResolvedInitialSessionRef.current) {
        return;
      }

      void handleAuthStateChange("INITIAL_SESSION", data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      void handleAuthStateChange(event, session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [handleAuthStateChange]);

  return <AuthContext.Provider value={{ isLoading, user }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
