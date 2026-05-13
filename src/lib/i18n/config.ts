export const ACTIVE_LOCALE_CODES = ["ko", "en"] as const;

export type ActiveLocale = (typeof ACTIVE_LOCALE_CODES)[number];
export type LocaleCode = ActiveLocale | "th" | "my" | "fil" | "zh";

export type LocaleOption = {
  code: LocaleCode;
  label: string;
  flag: string;
  status: "active" | "comingSoon";
};

export const STORAGE_KEY = "go-coaching-locale";
export const I18N_STORAGE_KEY = STORAGE_KEY;

export const DEFAULT_LOCALE: ActiveLocale = "ko";

export const ACTIVE_LOCALES: ActiveLocale[] = [...ACTIVE_LOCALE_CODES];

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: "ko", flag: "🇰🇷", label: "한국어", status: "active" },
  { code: "en", flag: "🇺🇸", label: "English", status: "active" },
  { code: "th", flag: "🇹🇭", label: "ภาษาไทย", status: "comingSoon" },
  { code: "my", flag: "🇲🇲", label: "မြန်မာဘာသာ", status: "comingSoon" },
  { code: "fil", flag: "🇵🇭", label: "Filipino", status: "comingSoon" },
  { code: "zh", flag: "🇨🇳", label: "中文", status: "comingSoon" },
];

export function isActiveLocale(value: unknown): value is ActiveLocale {
  return (
    typeof value === "string" &&
    ACTIVE_LOCALE_CODES.includes(value as ActiveLocale)
  );
}
