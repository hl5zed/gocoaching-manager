import type { ActiveLocale } from "./config";

type LocaleCacheEntry = {
  expiresAt: number;
  locale: ActiveLocale | null;
};

export const LOCALE_CACHE_TTL_MS = 3 * 60 * 1000;

const localeCache = new Map<string, LocaleCacheEntry>();

export function getCachedProfileLocale(authUserId: string): ActiveLocale | null | undefined {
  const entry = localeCache.get(authUserId);

  if (!entry || entry.expiresAt <= Date.now()) {
    return undefined;
  }

  return entry.locale;
}

export function setCachedProfileLocale(
  authUserId: string,
  locale: ActiveLocale | null,
  ttlMs: number = LOCALE_CACHE_TTL_MS,
) {
  localeCache.set(authUserId, {
    expiresAt: Date.now() + ttlMs,
    locale,
  });
}
