import type { ActiveLocale } from "./config";
import { ko } from "./ko";
import { en } from "./en";

type MessageDictionary = Record<string, string>;

// Server-side barrel — do not import this from client components.
// Client components (I18nProvider, useI18n) import ko/en directly
// so that only the active locale enters the client bundle.
export const messages: Record<ActiveLocale, MessageDictionary> = {
  ko,
  en,
};
