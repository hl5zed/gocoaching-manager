"use client";

export function PrintCoacheeReportButton() {
  return (
    <button
      className="rounded-control bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      인쇄하기
    </button>
  );
}
