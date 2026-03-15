"use client";

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect, useRef, useState } from "react";

import {
  clearPersistedQueryCache,
  getQueryCacheStorageKey,
  QUERY_CACHE_BUSTER,
  queryIndexedDbStorage,
} from "@/lib/query/persistence";
import { useAuth } from "@/components/providers/auth-provider";

const GUEST_QUERY_SCOPE = "guest";
const QUERY_SCOPE_STORAGE_KEY = "autobot-query-scope";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: 0,
      },
      queries: {
        gcTime: 1000 * 60 * 60 * 24,
        refetchInterval: false,
        refetchOnMount: false,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 1000 * 60,
      },
    },
  });
}

function readStoredQueryScope() {
  if (typeof window === "undefined") {
    return GUEST_QUERY_SCOPE;
  }

  return window.localStorage.getItem(QUERY_SCOPE_STORAGE_KEY) ?? GUEST_QUERY_SCOPE;
}

function ScopedPersistedQueryProvider({
  cacheScope,
  children,
}: {
  cacheScope: string;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(createQueryClient);
  const queryPersister = createAsyncStoragePersister({
    key: getQueryCacheStorageKey(cacheScope),
    storage: queryIndexedDbStorage,
    throttleTime: 1_000,
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        buster: `${QUERY_CACHE_BUSTER}:${cacheScope}`,
        maxAge: 1000 * 60 * 60 * 24,
        persister: queryPersister,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, user } = useAuth();
  const [cacheScope, setCacheScope] = useState(readStoredQueryScope);
  const previousCacheScopeRef = useRef(cacheScope);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const resolvedCacheScope = user?.id ?? GUEST_QUERY_SCOPE;
    const previousCacheScope = previousCacheScopeRef.current;

    if (previousCacheScope === resolvedCacheScope) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(QUERY_SCOPE_STORAGE_KEY, resolvedCacheScope);
      }
      return;
    }

    previousCacheScopeRef.current = resolvedCacheScope;
    setCacheScope(resolvedCacheScope);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(QUERY_SCOPE_STORAGE_KEY, resolvedCacheScope);
    }
    void clearPersistedQueryCache(previousCacheScope);
  }, [isLoading, user?.id]);

  return (
    <ScopedPersistedQueryProvider cacheScope={cacheScope} key={cacheScope}>
      {children}
    </ScopedPersistedQueryProvider>
  );
}
