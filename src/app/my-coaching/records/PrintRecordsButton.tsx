"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/useI18n";

type PrintRange = "all" | "daily" | "weekly" | "monthly";

type PrintRecordsButtonProps = {
  suggestedTitles: Record<PrintRange, string>;
};

const allButton = {
  fallback: "전체 인쇄/PDF",
  labelKey: "myCoaching.records.print.currentResults",
  value: "all" as PrintRange,
};

const subButtons: Array<{
  fallback: string;
  labelKey: string;
  shortLabelKey: string;
  shortFallback: string;
  value: PrintRange;
}> = [
  {
    fallback: "하루 기록 인쇄/PDF 저장",
    labelKey: "myCoaching.records.print.daily",
    shortLabelKey: "myCoaching.records.print.daily.short",
    shortFallback: "하루",
    value: "daily",
  },
  {
    fallback: "주간 기록 인쇄/PDF 저장",
    labelKey: "myCoaching.records.print.weekly",
    shortLabelKey: "myCoaching.records.print.weekly.short",
    shortFallback: "주간",
    value: "weekly",
  },
  {
    fallback: "월간 회고 인쇄/PDF 저장",
    labelKey: "myCoaching.records.print.monthlyReflection",
    shortLabelKey: "myCoaching.records.print.monthlyReflection.short",
    shortFallback: "월간",
    value: "monthly",
  },
];

export function PrintRecordsButton({
  suggestedTitles,
}: PrintRecordsButtonProps) {
  const { t } = useI18n();
  const [printRange, setPrintRange] = useState<PrintRange>("all");

  useEffect(() => {
    const restorePrintRange = () => {
      document.documentElement.dataset.recordsPrintRange = "all";
      const previousTitle = document.documentElement.dataset.previousPrintTitle;

      if (previousTitle) {
        document.title = previousTitle;
        delete document.documentElement.dataset.previousPrintTitle;
      }

      setPrintRange("all");
    };

    window.addEventListener("afterprint", restorePrintRange);
    window.addEventListener("focus", restorePrintRange);

    return () => {
      window.removeEventListener("afterprint", restorePrintRange);
      window.removeEventListener("focus", restorePrintRange);
      restorePrintRange();
    };
  }, []);

  function handlePrint(nextRange: PrintRange) {
    setPrintRange(nextRange);
    document.documentElement.dataset.recordsPrintRange = nextRange;
    if (!document.documentElement.dataset.previousPrintTitle) {
      document.documentElement.dataset.previousPrintTitle = document.title;
    }
    // Browsers that use document.title for "Save as PDF" can suggest this name,
    // but the final filename is still controlled by the browser/OS dialog.
    document.title = suggestedTitles[nextRange]
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    requestAnimationFrame(() => {
      window.setTimeout(() => {
        window.print();
      }, 0);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        icon="print"
        onClick={() => handlePrint(allButton.value)}
        size="sm"
        type="button"
        variant={printRange === allButton.value ? "primary" : "secondary"}
      >
        {t(allButton.labelKey, allButton.fallback)}
      </Button>
      <div className="flex gap-1.5">
        {subButtons.map((button) => (
          <Button
            aria-label={t(button.labelKey, button.fallback)}
            icon="print"
            key={button.value}
            onClick={() => handlePrint(button.value)}
            size="sm"
            type="button"
            variant={printRange === button.value ? "primary" : "secondary"}
          >
            {t(button.shortLabelKey, button.shortFallback)}
          </Button>
        ))}
      </div>
    </div>
  );
}
