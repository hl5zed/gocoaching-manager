"use client";

import { useEffect, useState } from "react";

type PrintRange = "all" | "daily" | "weekly" | "monthly";

type PrintRecordsButtonProps = {
  suggestedTitles: Record<PrintRange, string>;
};

const printRangeButtons: Array<{
  label: string;
  value: PrintRange;
}> = [
  {
    label: "전체 기록 인쇄",
    value: "all",
  },
  {
    label: "하루 기록 인쇄",
    value: "daily",
  },
  {
    label: "주간 기록 인쇄",
    value: "weekly",
  },
  {
    label: "월간 회고 인쇄",
    value: "monthly",
  },
];

export function PrintRecordsButton({
  suggestedTitles,
}: PrintRecordsButtonProps) {
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
        <button
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            printRange === button.value
              ? "bg-slate-950 text-white"
              : "border border-slate-300 bg-white text-slate-700"
          }`}
          key={button.value}
          onClick={() => handlePrint(button.value)}
          type="button"
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
