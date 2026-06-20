"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/useI18n";

type ReportFiltersProps = {
  selectedFilters: {
    from: string | null;
    team: string | null;
    to: string | null;
    year: number;
  };
  teamOptions: string[];
};

function yearOptions(selectedYear: number) {
  const currentYear = new Date().getFullYear();
  const years = new Set<number>([
    selectedYear,
    currentYear - 1,
    currentYear,
    currentYear + 1,
  ]);

  return Array.from(years).sort((left, right) => right - left);
}

export function ReportFilters({
  selectedFilters,
  teamOptions,
}: ReportFiltersProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [year, setYear] = useState(String(selectedFilters.year));
  const [team, setTeam] = useState(selectedFilters.team ?? "");
  const [from, setFrom] = useState(selectedFilters.from ?? "");
  const [to, setTo] = useState(selectedFilters.to ?? "");

  function applyFilters() {
    const params = new URLSearchParams();

    if (year.trim()) {
      params.set("year", year.trim());
    }

    if (team.trim()) {
      params.set("team", team.trim());
    }

    if (from.trim()) {
      params.set("from", from.trim());
    }

    if (to.trim()) {
      params.set("to", to.trim());
    }

    const query = params.toString();
    router.push(query ? `/coach-maker/report?${query}` : "/coach-maker/report");
  }

  function resetFilters() {
    setYear(String(new Date().getFullYear()));
    setTeam("");
    setFrom("");
    setTo("");
    router.push("/coach-maker/report");
  }

  return (
    <section className="report-controls mt-6 rounded-card border border-line-base bg-surface-app p-4 print:hidden">
      <div className="mb-4 rounded-md border border-line-base bg-surface-card px-4 py-3 text-sm leading-6 text-ink-muted">
        <p className="font-semibold text-ink-base">
          {t("coachMaker.report.filters.title", "보고서 기준")}
        </p>
        <p className="mt-1">
          {t(
            "coachMaker.report.filters.description",
            "목실기 성취 현황은 선택 연도 기준, 관리 액션 메모는 작성일 기간 기준으로 표시합니다. 팀 필터는 목실기 대상자와 관리 메모 모두에 공통 적용됩니다.",
          )}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm font-medium text-ink-base">
          {t("coachMaker.report.filters.year", "연도")}
          <select
            className="mt-1 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm"
            onChange={(event) => setYear(event.target.value)}
            value={year}
          >
            {yearOptions(selectedFilters.year).map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
                {t("coachMaker.report.filters.yearSuffix", "년")}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-ink-base">
          {t("coachMaker.report.filters.team", "팀")}
          <input
            className="mt-1 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm"
            list="report-team-options"
            onChange={(event) => setTeam(event.target.value)}
            placeholder={t(
              "coachMaker.report.filters.teamPlaceholder",
              "전체 또는 팀명 입력",
            )}
            value={team}
          />
          <datalist id="report-team-options">
            {teamOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>

        <label className="text-sm font-medium text-ink-base">
          {t("coachMaker.report.filters.from", "시작일")}
          <input
            className="mt-1 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm"
            onChange={(event) => setFrom(event.target.value)}
            type="date"
            value={from}
          />
        </label>

        <label className="text-sm font-medium text-ink-base">
          {t("coachMaker.report.filters.to", "종료일")}
          <input
            className="mt-1 w-full rounded-md border border-line-base bg-surface-card px-3 py-2 text-sm"
            onChange={(event) => setTo(event.target.value)}
            type="date"
            value={to}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-control bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800"
          onClick={applyFilters}
          type="button"
        >
          {t("coachMaker.report.filters.apply", "필터 적용")}
        </button>
        <button
          className="rounded-md border border-line-base bg-surface-card px-4 py-2 text-sm font-semibold text-ink-base hover:bg-surface-sunken"
          onClick={resetFilters}
          type="button"
        >
          {t("coachMaker.report.filters.reset", "필터 초기화")}
        </button>
      </div>
    </section>
  );
}
