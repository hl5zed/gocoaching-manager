"use client";

import { Button } from "@/components/ui/Button";
import {
  getPrintMarginSize,
  normalizePrintOptions,
  type PrintOptions,
} from "@/lib/print/print-options";

type PrintPageButtonProps = {
  className?: string;
  fileName?: string;
  label?: string;
  printOptions?: Partial<PrintOptions> | null;
  title?: string;
};

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sanitizeFileName(value: string | undefined) {
  const fallback = `moksilgi-report-${todayText()}`;
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized && normalized.length > 0 ? normalized : fallback;
}

export function PrintPageButton({
  className = "",
  fileName,
  label = "인쇄/PDF 저장",
  printOptions,
  title,
}: PrintPageButtonProps) {
  const resolvedPrintOptions = normalizePrintOptions(printOptions);
  const printMargin = getPrintMarginSize(resolvedPrintOptions.margin);
  const pageSize = `A4 ${resolvedPrintOptions.orientation}`;

  function handlePrint() {
    if (typeof window === "undefined") {
      return;
    }

    const originalTitle = document.title;
    const nextTitle = sanitizeFileName(fileName ?? title);
    let restored = false;

    const restoreTitle = () => {
      if (restored) {
        return;
      }

      document.title = originalTitle;
      restored = true;
      window.removeEventListener("afterprint", restoreTitle);
    };

    // Browsers that use document.title for "Save as PDF" will suggest this
    // filename, but users may still need to edit it depending on the browser/OS.
    document.title = nextTitle;
    window.addEventListener("afterprint", restoreTitle, { once: true });

    window.setTimeout(() => {
      window.print();
      window.setTimeout(restoreTitle, 15000);
    }, 0);
  }

  return (
    <>
      <Button
        className={`print-hidden ${className}`}
        icon="print"
        onClick={handlePrint}
        type="button"
      >
        {label}
      </Button>
      <style jsx global>{`
        .print-only {
          display: none;
        }

        @media print {
          @page {
            size: ${pageSize};
            margin: ${printMargin};
          }

          html,
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          .print-root {
            background: #ffffff !important;
            display: block !important;
            height: auto !important;
            max-height: none !important;
            min-height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            width: 100% !important;
          }

          .print-root > div {
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
          }

          .print-root * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          .print-root .min-h-screen {
            min-height: auto !important;
          }

          .print-root .overflow-x-auto,
          .print-root .overflow-y-auto,
          .print-root .overflow-hidden {
            max-height: none !important;
            overflow: visible !important;
          }

          .print-hidden,
          .no-print,
          .print-root nav,
          .print-root a,
          .print-root button,
          .print-root [data-print-hidden="true"] {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .print-report-title {
            border-bottom: 1px solid #cbd5e1;
            break-after: avoid;
            margin: 0 0 8px !important;
            padding: 0 0 8px !important;
            page-break-after: avoid;
          }

          .print-report-title h1 {
            font-size: 20px !important;
            font-weight: 700 !important;
            margin: 0 0 6px !important;
          }

          .print-report-title p {
            font-size: 11px !important;
            margin: 2px 0 !important;
          }

          .print-root h1,
          .print-root h2,
          .print-root h3,
          .print-root h4 {
            break-after: avoid;
            page-break-after: avoid;
          }

          .print-section,
          .print-card,
          .print-root section,
          .print-root article {
            break-after: auto;
            break-before: auto;
            break-inside: auto;
            margin: 0 0 5mm !important;
            page-break-after: auto;
            page-break-before: auto;
            page-break-inside: auto;
            padding: 0 !important;
          }

          .print-section,
          .print-card {
            border: 1px solid #dddddd !important;
          }

          .print-section > div,
          .print-card > div {
            border-bottom: 0 !important;
            padding: 3mm 4mm !important;
          }

          .print-root dl,
          .print-root ul,
          .print-root p {
            margin-bottom: 0 !important;
          }

          .print-root table {
            border-collapse: collapse !important;
            font-size: 10px !important;
            min-width: 0 !important;
            page-break-inside: auto;
            width: 100% !important;
          }

          .print-root thead {
            display: table-header-group;
          }

          .print-root tbody {
            display: table-row-group;
          }

          .print-root tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-root th,
          .print-root td {
            border-color: #cbd5e1 !important;
            word-break: break-word;
            overflow-wrap: anywhere;
          }

          .print-root input,
          .print-root textarea,
          .print-root select {
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
          }
        }
      `}</style>
    </>
  );
}
