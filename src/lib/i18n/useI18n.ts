"use client";

import { useContext } from "react";
import { I18nContext } from "./I18nProvider";
import { DEFAULT_LOCALE } from "./config";
import { ko } from "./ko";

export function useI18n() {
  const context = useContext(I18nContext);

  if (context) {
    return context;
  }

  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) => ko[key] ?? fallback ?? key,
  };
}
