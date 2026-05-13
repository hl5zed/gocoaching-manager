"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/useI18n";

type PageNavigationButtonsProps = {
  className?: string;
  dashboardHref?: string;
};

export function PageNavigationButtons({
  className = "",
  dashboardHref = "/dashboard",
}: PageNavigationButtonsProps) {
  const router = useRouter();
  const { t } = useI18n();

  function handleForward() {
    if (typeof window !== "undefined") {
      window.history.forward();
    }
  }

  return (
    <nav
      aria-label="페이지 이동"
      className={`flex flex-wrap items-center gap-2 text-sm ${className}`}
    >
      <button
        className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => router.back()}
        type="button"
      >
        {t("common.previous", "이전 화면")}
      </button>
      <button
        className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
        onClick={handleForward}
        type="button"
      >
        {t("common.next", "다음 화면")}
      </button>
      <Link
        className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
        href={dashboardHref}
      >
        {t("nav.dashboard", "대시보드")}
      </Link>
      <LanguageSwitcher />
    </nav>
  );
}
