import { createStore, del, get, set } from "idb-keyval";

export const QUERY_CACHE_KEY = "autobot-react-query";
export const QUERY_CACHE_BUSTER = "v4";
const QUERY_STORE = createStore("autobot-query-db", "query-cache");

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
