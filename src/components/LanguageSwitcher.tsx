"use client";

import { useEffect, useRef, useState } from "react";
import {
  LOCALE_OPTIONS,
  isActiveLocale,
  type ActiveLocale,
} from "@/lib/i18n/config";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n/useI18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [savingLocale, setSavingLocale] = useState<ActiveLocale | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeLabel = locale === "en" ? "English" : "한국어";

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  async function handleSelect(nextLocale: ActiveLocale) {
    setLocale(nextLocale);
    setOpen(false);
    setSavingLocale(nextLocale);

    try {
      const response = await fetch("/api/profile/locale", {
        body: JSON.stringify({ locale: nextLocale }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        console.warn("[LANGUAGE_LOCALE_SAVE_FAILED]", response.status);
      }
    } catch (error) {
      console.warn("[LANGUAGE_LOCALE_SAVE_FAILED]", error);
    } finally {
      setSavingLocale(null);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-10 min-h-10 min-w-[112px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border-slate-200 bg-white px-4 py-2 text-sm leading-none hover:bg-slate-50 [&_span]:whitespace-nowrap"
        icon="globe"
        iconPosition="left"
        onClick={() => setOpen((value) => !value)}
        size="sm"
        type="button"
      >
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {activeLabel}
          <Icon className="h-3.5 w-3.5" name="chevron-down" />
        </span>
      </Button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-slate-200 bg-white p-2 text-sm shadow-lg"
          role="menu"
        >
          <p className="px-2 py-1 text-xs font-medium text-slate-500">
            {t("language.change", "언어 변경")}
          </p>
          {LOCALE_OPTIONS.filter((option) => option.status === "active").map((option) => (
            <button
              className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-slate-50 ${
                option.code === locale ? "font-semibold text-slate-950" : "text-slate-700"
              }`}
              key={option.code}
              onClick={() => {
                if (isActiveLocale(option.code)) {
                  void handleSelect(option.code);
                }
              }}
              role="menuitem"
              disabled={savingLocale !== null}
              type="button"
            >
              <span>
                {option.flag} {option.label}
              </span>
              {option.code === locale ? <Icon className="h-3.5 w-3.5" name="check" /> : null}
            </button>
          ))}

          <div className="my-2 border-t border-slate-200" />

          {LOCALE_OPTIONS.slice(2).map((option) => (
            <button
              aria-disabled="true"
              className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-2 py-2 text-left text-slate-400"
              disabled
              key={option.code}
              role="menuitem"
              type="button"
            >
              <span>
                {option.flag} {option.label}
              </span>
              <span className="text-xs">{t("language.comingSoon", "준비 중")}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
