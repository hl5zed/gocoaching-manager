"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/useI18n";

type PrintRange = "all" | "daily" | "weekly" | "monthly";

type PrintRecordsButtonProps = {
  suggestedTitles: Record<PrintRange, string>;
};

const printRangeButtons: Array<{
  fallback: string;
  labelKey: string;
  value: PrintRange;
}> = [
  {
    fallback: "현재 결과 전체 인쇄/PDF 저장",
    labelKey: "myCoaching.records.print.currentResults",
    value: "all",
  },
  {
    fallback: "하루 기록 인쇄/PDF 저장",
    labelKey: "myCoaching.records.print.daily",
    value: "daily",
  },
  {
    fallback: "주간 기록 인쇄/PDF 저장",
    labelKey: "myCoaching.records.print.weekly",
    value: "weekly",
  },
  {
    fallback: "월간 회고 인쇄/PDF 저장",
    labelKey: "myCoaching.records.print.monthlyReflection",
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
    <div className="flex flex-wrap gap-2">
      {printRangeButtons.map((button) => (
        <Button
          icon="print"
          key={button.value}
          onClick={() => handlePrint(button.value)}
          size="sm"
          type="button"
          variant={printRange === button.value ? "primary" : "secondary"}
        >
          {t(button.labelKey, button.fallback)}
        </Button>
      ))}
    </div>
  );
}
