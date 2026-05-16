"use client";

export function PrintReportButton() {
  return (
    <button
      className="inline-flex min-h-10 w-full justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      보고서 인쇄/PDF 저장
    </button>
  );
}
