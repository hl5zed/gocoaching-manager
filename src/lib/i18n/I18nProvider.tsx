"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  isActiveLocale,
  STORAGE_KEY,
  type ActiveLocale,
} from "./config";
import { LOCALE_HINT_COOKIE } from "@/lib/auth/identity-headers";
import { ko } from "./ko";

type MessageDictionary = Record<string, string>;

async function loadLocaleDict(locale: ActiveLocale): Promise<MessageDictionary> {
  if (locale === "ko") return ko;
  const { en } = await import("./en");
  return en;
}

type I18nContextValue = {
  locale: ActiveLocale;
  setLocale: (locale: ActiveLocale) => void;
  t: (key: string, fallback?: string) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

function readLocaleFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("locale" in payload)) {
    return null;
  }

  return (payload as { locale?: unknown }).locale;
}

function readLocaleHintFromCookie(): ActiveLocale | "none" | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_HINT_COOKIE}=([^;]*)`),
  );

  if (!match) {
    return null;
  }

  const value = decodeURIComponent(match[1]);

  if (value === "none") {
    return "none";
  }

  return isActiveLocale(value) ? value : null;
}

function readStoredLocale(): ActiveLocale | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedLocale = window.localStorage.getItem(STORAGE_KEY);
  return isActiveLocale(storedLocale) ? storedLocale : null;
}

function resolveInitialLocale(initialLocale?: ActiveLocale | null) {
  if (isActiveLocale(initialLocale)) {
    return initialLocale;
  }

  return DEFAULT_LOCALE;
}

function scheduleDeferredLocaleFetch(callback: () => void, options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 300;

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(callback, {
      timeout: Math.max(timeoutMs, 1500),
    });

    return () => {
      window.cancelIdleCallback(idleId);
    };
  }

  const timeoutId = window.setTimeout(callback, timeoutMs);

  return () => {
    window.clearTimeout(timeoutId);
  };
}

export function I18nProvider({
  children,
  initialLocale = null,
}: {
  children: ReactNode;
  initialLocale?: ActiveLocale | null;
}) {
  const pathname = usePathname();
  const [locale, setLocaleState] = useState<ActiveLocale>(() =>
    resolveInitialLocale(initialLocale),
  );
  const [dict, setDict] = useState<MessageDictionary>(ko);
  const hasSyncedProfileLocaleRef = useRef(false);

  useEffect(() => {
    const storedLocale = readStoredLocale();

    if (storedLocale) {
      setLocaleState(storedLocale);
    } else if (isActiveLocale(initialLocale)) {
      setLocaleState(initialLocale);
      window.localStorage.setItem(STORAGE_KEY, initialLocale);
    }
  }, [initialLocale]);

  useEffect(() => {
    if (pathname === "/login" || pathname?.startsWith("/login/")) {
      return;
    }

    if (hasSyncedProfileLocaleRef.current) {
      return;
    }

    hasSyncedProfileLocaleRef.current = true;
    let cancelled = false;

    async function loadProfileLocale() {
      try {
        const response = await fetch("/api/profile/locale", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload: unknown = await response.json();
        const profileLocale = readLocaleFromPayload(payload);

        if (!cancelled && isActiveLocale(profileLocale)) {
          setLocaleState(profileLocale);
          window.localStorage.setItem(STORAGE_KEY, profileLocale);
        }
      } catch {
        // localStorage/default locale remains the fallback when profile lookup fails.
      }
    }

    const storedLocale = readStoredLocale();
    const localeHint = readLocaleHintFromCookie();

    if (storedLocale) {
      const scheduleBackgroundSync = () => {
        if (cancelled) {
          return;
        }

        void loadProfileLocale();
      };

      if (typeof window.requestIdleCallback === "function") {
        const idleId = window.requestIdleCallback(scheduleBackgroundSync, {
          timeout: 5000,
        });

        return () => {
          cancelled = true;
          window.cancelIdleCallback(idleId);
        };
      }

      const timeoutId = window.setTimeout(scheduleBackgroundSync, 2000);

      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
      };
    }

    if (localeHint === "none") {
      return;
    }

    if (isActiveLocale(localeHint)) {
      setLocaleState(localeHint);
      window.localStorage.setItem(STORAGE_KEY, localeHint);
      return;
    }

    if (isActiveLocale(initialLocale)) {
      return;
    }

    const runLocaleFetch = () => {
      if (cancelled) {
        return;
      }

      void loadProfileLocale();
    };

    if (pathname === "/dashboard") {
      const cancelDeferredFetch = scheduleDeferredLocaleFetch(runLocaleFetch, {
        timeoutMs: 300,
      });

      return () => {
        cancelled = true;
        cancelDeferredFetch();
      };
    }

    runLocaleFetch();

    return () => {
      cancelled = true;
    };
  }, [initialLocale, pathname]);

  // When locale changes, load the matching dictionary
  useEffect(() => {
    let cancelled = false;
    void loadLocaleDict(locale).then((d) => {
      if (!cancelled) setDict(d);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const setLocale = useCallback((nextLocale: ActiveLocale) => {
    setLocaleState(nextLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => dict[key] ?? fallback ?? key,
    [dict],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function I18nText({
  fallback,
  k,
}: {
  fallback?: string;
  k: string;
}) {
  const context = useContext(I18nContext);

  return <>{context?.t(k, fallback) ?? ko[k] ?? fallback ?? k}</>;
}
