import { createStore, del, get, set } from "idb-keyval";

export const QUERY_CACHE_KEY = "autobot-react-query";
export const QUERY_CACHE_BUSTER = "v1";
export const AUTH_USER_CACHE_KEY = "autobot-auth-user";
const QUERY_STORE = createStore("autobot-query-db", "query-cache");
const AUTH_STORE = createStore("autobot-auth-db", "auth-cache");

export type CachedAuthUser = {
  email: string | null;
  id: string;
};

export function getQueryCacheStorageKey(cacheScope: string) {
  return `${QUERY_CACHE_KEY}:${cacheScope}`;
}

export const queryIndexedDbStorage = {
  async getItem(key: string) {
    return (await get<string>(key, QUERY_STORE)) ?? null;
  },
  async setItem(key: string, value: string) {
    await set(key, value, QUERY_STORE);
  },
  async removeItem(key: string) {
    await del(key, QUERY_STORE);
  },
};

export async function clearPersistedQueryCache(cacheScope: string) {
  await queryIndexedDbStorage.removeItem(getQueryCacheStorageKey(cacheScope));
}

export async function getCachedAuthUser() {
  return (await get<CachedAuthUser>(AUTH_USER_CACHE_KEY, AUTH_STORE)) ?? null;
}

export async function setCachedAuthUser(user: CachedAuthUser) {
  await set(AUTH_USER_CACHE_KEY, user, AUTH_STORE);
}

export async function clearCachedAuthUser() {
  await del(AUTH_USER_CACHE_KEY, AUTH_STORE);
}
