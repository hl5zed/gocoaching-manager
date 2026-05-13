"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <section className="report-controls mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 print:hidden">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm font-medium text-slate-700">
          연도
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => setYear(event.target.value)}
            value={year}
          >
            {yearOptions(selectedFilters.year).map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}년
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          팀
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            list="report-team-options"
            onChange={(event) => setTeam(event.target.value)}
            placeholder="전체 또는 팀명 입력"
            value={team}
          />
          <datalist id="report-team-options">
            {teamOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>

        <label className="text-sm font-medium text-slate-700">
          시작일
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => setFrom(event.target.value)}
            type="date"
            value={from}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          종료일
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => setTo(event.target.value)}
            type="date"
            value={to}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={applyFilters}
          type="button"
        >
          필터 적용
        </button>
        <button
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          onClick={resetFilters}
          type="button"
        >
          필터 초기화
        </button>
      </div>
    </section>
  );
}
