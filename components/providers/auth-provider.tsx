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

import {
  clearCachedAuthUser,
  getCachedAuthUser,
  setCachedAuthUser,
} from "@/lib/query/persistence";
import { createClient } from "@/lib/supabase/client";

type AuthUser = {
  email: string | null;
  id: string;
};

type AuthContextValue = {
  isLoading: boolean;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(user: User | null): AuthUser | null {
  if (!user) {
    return null;
  }

  return {
    email: user.email ?? null,
    id: user.id,
  };
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousUserIdRef = useRef<string | null>(null);
  const syncSessionPromiseRef = useRef<Promise<void> | null>(null);
  const router = useRouter();

  const applySession = useEffectEvent(
    async ({ refreshServer, session }: { refreshServer: boolean; session: Session | null }) => {
      const nextUser = mapUser(session?.user ?? null);
      const previousUserId = previousUserIdRef.current;
      const nextUserId = nextUser?.id ?? null;
      const userChanged = previousUserId !== nextUserId;

      previousUserIdRef.current = nextUserId;
      setUser(nextUser);
      setIsLoading(false);

      if (nextUser) {
        await setCachedAuthUser(nextUser);
      } else {
        await clearCachedAuthUser();
      }

      if (refreshServer && (userChanged || (!nextUserId && previousUserId))) {
        router.refresh();
      }
    },
  );

  const syncSession = useEffectEvent(async (refreshServer: boolean) => {
    if (syncSessionPromiseRef.current) {
      await syncSessionPromiseRef.current;
      return;
    }

    syncSessionPromiseRef.current = (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        await applySession({ refreshServer, session });
      } finally {
        setIsLoading(false);
        syncSessionPromiseRef.current = null;
      }
    })();

    await syncSessionPromiseRef.current;
  });

  const handleAuthStateChange = useEffectEvent(
    async (event: AuthChangeEvent, session: Session | null) => {
      const shouldRefreshServer =
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED";

      await applySession({
        refreshServer: shouldRefreshServer,
        session,
      });
    },
  );

  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      const cachedUser = await getCachedAuthUser();

      if (cachedUser) {
        previousUserIdRef.current = cachedUser.id;
        setUser(cachedUser);
      }

      await syncSession(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      void handleAuthStateChange(event, session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleAuthStateChange, syncSession]);

  return <AuthContext.Provider value={{ isLoading, user }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
