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

          /* ── 기본 리셋 ── */
          html,
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 10px !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          /* ── 루트 컨테이너 ── */
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

          /* ── 숨김 처리 ── */
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

          /* ── 보고서 헤더 ── */
          .print-report-title {
            background: #1d2b4f !important;
            border-radius: 6px !important;
            break-after: avoid;
            color: #ffffff !important;
            display: grid !important;
            gap: 2px 16px !important;
            grid-template-columns: 1fr 1fr !important;
            margin: 0 0 6px !important;
            padding: 6px 10px !important;
            page-break-after: avoid;
          }

          .print-report-title h1 {
            color: #ffffff !important;
            font-size: 15px !important;
            font-weight: 700 !important;
            grid-column: 1 / -1 !important;
            margin: 0 0 4px !important;
          }

          .print-report-title p {
            color: #c8d6e0 !important;
            font-size: 9px !important;
            margin: 0 !important;
          }

          /* ── 헤딩 ── */
          .print-root h1,
          .print-root h2,
          .print-root h3,
          .print-root h4 {
            break-after: avoid;
            page-break-after: avoid;
          }

          .print-root h3 {
            font-size: 11px !important;
          }

          .print-root h4 {
            font-size: 10px !important;
          }

          /* ── 섹션 카드 ── */
          .print-section,
          .print-root section,
          .print-root article {
            border: 1px solid #d1d9e6 !important;
            border-radius: 5px !important;
            break-after: auto;
            break-before: auto;
            break-inside: auto;
            margin: 0 0 4px !important;
            page-break-after: auto;
            page-break-before: auto;
            page-break-inside: auto;
            padding: 0 !important;
          }

          /* 섹션 헤더 (CardHeader) */
          .print-section > div:first-child {
            background: #f4f6fa !important;
            border-bottom: 1px solid #d1d9e6 !important;
            border-radius: 5px 5px 0 0 !important;
            padding: 4px 8px !important;
          }

          /* 섹션 헤더 제목 */
          .print-section > div:first-child h2,
          .print-section > div:first-child h3 {
            font-size: 10px !important;
            font-weight: 700 !important;
            margin: 0 !important;
          }

          /* 섹션 본문 (CardContent) */
          .print-section > div:last-child {
            padding: 5px 8px !important;
          }

          /* ── 내부 카드 (목표 영역, 핵심가치 등) ── */
          .print-card {
            border: 1px solid #e2e8f0 !important;
            border-radius: 4px !important;
            break-inside: avoid;
            margin: 0 0 3px !important;
            page-break-inside: avoid;
            padding: 0 !important;
          }

          .print-card > div {
            padding: 4px 6px !important;
          }

          /* ── 사명선언서 · 비전 커스텀 레이아웃 ── */
          .print-root .mission-desc-row {
            grid-column: 1 / -1 !important;
          }

          /* ── 정보 그리드 (dl) ── */
          .print-root dl {
            column-gap: 8px !important;
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            margin-bottom: 0 !important;
            row-gap: 4px !important;
          }

          .print-root dl > div {
            min-width: 0 !important;
          }

          .print-root dt {
            color: #64748b !important;
            font-size: 8px !important;
            font-weight: 600 !important;
            letter-spacing: 0.02em !important;
            text-transform: uppercase !important;
          }

          .print-root dd {
            color: #0f172a !important;
            font-size: 9.5px !important;
            margin-top: 1px !important;
            white-space: pre-wrap !important;
            word-break: break-word !important;
          }

          /* ── 핵심가치 그리드 ── */
          .print-root .grid.gap-4.md\\:grid-cols-3 {
            display: grid !important;
            gap: 4px !important;
            grid-template-columns: repeat(3, 1fr) !important;
          }

          /* ── 목표 영역 그리드 ── */
          .print-root .grid.gap-5 {
            display: grid !important;
            gap: 4px !important;
          }

          /* ── 세부목표 그리드 ── */
          .print-root .grid.gap-3 {
            display: grid !important;
            gap: 3px !important;
          }

          /* 세부목표 내 4컬럼 dl */
          .print-root .grid.gap-3.sm\\:grid-cols-2.lg\\:grid-cols-4 {
            grid-template-columns: repeat(4, 1fr) !important;
          }

          /* ── 일반 텍스트 ── */
          .print-root p {
            font-size: 9.5px !important;
            line-height: 1.45 !important;
            margin-bottom: 0 !important;
          }

          /* ── 강조 지표 숫자 (요약 카드의 핵심 수치) ── */
          .print-root p.print-stat-value {
            font-size: 15px !important;
            line-height: 1.3 !important;
          }

          .print-root ul {
            margin-bottom: 0 !important;
            padding-left: 12px !important;
          }

          .print-root li {
            font-size: 9.5px !important;
            line-height: 1.4 !important;
          }

          /* ── 배지 (Badge) ── */
          .print-root [class*="badge"],
          .print-root [class*="Badge"] {
            border: 1px solid #cbd5e1 !important;
            border-radius: 3px !important;
            display: inline-block !important;
            font-size: 8px !important;
            padding: 1px 4px !important;
          }

          /* ── 성취표 ── */
          .print-root table {
            border-collapse: collapse !important;
            font-size: 8.5px !important;
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
            border: 1px solid #e2e8f0 !important;
            overflow-wrap: anywhere;
            padding: 2px 4px !important;
            word-break: break-word;
          }

          .print-root thead th {
            background: #f4f6fa !important;
            font-weight: 700 !important;
          }

          /* 누적행 (bg-navy-900) */
          .print-root tr.bg-navy-900,
          .print-root tr[class*="navy"] {
            background: #1d2b4f !important;
            color: #ffffff !important;
          }

          /* ── 숨길 입력 요소 ── */
          .print-root input,
          .print-root textarea,
          .print-root select {
            display: none !important;
          }

          /* ── 레이아웃 gap 리셋 ── */
          .print-root .gap-6 {
            gap: 4px !important;
          }

          .print-root .gap-5 {
            gap: 3px !important;
          }

          .print-root .gap-4 {
            gap: 3px !important;
          }

          .print-root .mt-6 {
            margin-top: 4px !important;
          }

          .print-root .mt-4 {
            margin-top: 3px !important;
          }

          .print-root .mt-3 {
            margin-top: 2px !important;
          }

          .print-root .mt-2 {
            margin-top: 1px !important;
          }
        }
      `}</style>
    </>
  );
}
