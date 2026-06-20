"use client";

import { useI18n } from "@/lib/i18n/useI18n";

export function PrintReportButton() {
  const { t } = useI18n();

  return (
    <button
      className="inline-flex min-h-10 w-full justify-center rounded-control bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 sm:w-auto print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      {t("coachMaker.report.printOrPdf", "보고서 인쇄/PDF 저장")}
    </button>
  );
}
