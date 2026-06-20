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

export function I18nProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [locale, setLocaleState] = useState<ActiveLocale>(DEFAULT_LOCALE);
  const [dict, setDict] = useState<MessageDictionary>(ko);
  const hasSyncedProfileLocaleRef = useRef(false);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(STORAGE_KEY);

    if (isActiveLocale(storedLocale)) {
      setLocaleState(storedLocale);
    }
  }, []);

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

    void loadProfileLocale();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

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
