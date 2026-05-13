"use client";

import { useContext } from "react";
import { I18nContext } from "./I18nProvider";
import { DEFAULT_LOCALE } from "./config";
import { messages } from "./messages";

export function useI18n() {
  const context = useContext(I18nContext);

  if (context) {
    return context;
  }

  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => undefined,
    t: (key: string, fallback?: string) =>
      messages[DEFAULT_LOCALE][key] ?? fallback ?? key,
  };
}
