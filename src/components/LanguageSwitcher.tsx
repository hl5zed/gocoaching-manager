"use client";

import { useEffect, useRef, useState } from "react";
import {
  LOCALE_OPTIONS,
  isActiveLocale,
  type ActiveLocale,
} from "@/lib/i18n/config";
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
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        🌐 {activeLabel} ▾
      </button>

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
              {option.code === locale ? <span>✓</span> : null}
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
