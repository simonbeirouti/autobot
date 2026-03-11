"use client";

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24,
        refetchInterval: false,
        refetchOnMount: false,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 1000 * 30,
      },
    },
  });
}

function BootstrapQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
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
  const cacheScope = user?.id ?? GUEST_QUERY_SCOPE;
  const previousCacheScopeRef = useRef(cacheScope);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const previousCacheScope = previousCacheScopeRef.current;

    if (previousCacheScope === cacheScope) {
      return;
    }

    previousCacheScopeRef.current = cacheScope;
    void clearPersistedQueryCache(previousCacheScope);
  }, [cacheScope, isLoading]);

  if (isLoading) {
    return <BootstrapQueryProvider>{children}</BootstrapQueryProvider>;
  }

  return (
    <ScopedPersistedQueryProvider cacheScope={cacheScope} key={cacheScope}>
      {children}
    </ScopedPersistedQueryProvider>
  );
}
