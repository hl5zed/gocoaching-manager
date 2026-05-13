import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  getCoachMakerMoksilgiProgress,
  type CoachMakerMoksilgiProgressFilters,
  type CoachMakerMoksilgiProgressRow,
} from "@/lib/api/coach-maker/moksilgi-progress";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import { PrintPageButton } from "@/components/print/PrintPageButton";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { MoksilgiProgressClientTable } from "./MoksilgiProgressClientTable";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function textParam(value: string | string[] | undefined) {
  const text = firstParam(value)?.trim();
  return text && text.length > 0 ? text : null;
}

function parseYear(params: Record<string, string | string[] | undefined>) {
  const today = new Date();
  const year = Number(firstParam(params.year) ?? today.getFullYear());

  return Number.isInteger(year) && year >= 2000 && year <= 2100
    ? year
    : today.getFullYear();
}

function parseFilters(
  params: Record<string, string | string[] | undefined>,
): CoachMakerMoksilgiProgressFilters {
  return {
    year: parseYear(params),
    teamName: textParam(params.team),
    regionName: textParam(params.region),
    roleLabel: textParam(params.role),
    generationLabel: textParam(params.generation),
    search: textParam(params.search),
  };
}

function formatPercent(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(1)}%`;
}

function progressStatusCounts(rows: CoachMakerMoksilgiProgressRow[]) {
  return rows.reduce(
    (counts, row) => {
      const rate = typeof row.cumulative_rate === "number" && Number.isFinite(row.cumulative_rate)
        ? row.cumulative_rate
        : 0;

      if (rate >= 100) {
        return { ...counts, completed: counts.completed + 1 };
      }

      if (rate > 0) {
        return { ...counts, inProgress: counts.inProgress + 1 };
      }

      return { ...counts, notStarted: counts.notStarted + 1 };
    },
    { completed: 0, inProgress: 0, notStarted: 0 },
  );
}

function SummaryCard({
  description,
  title,
  value,
}: {
  description: string;
  title: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function FilterForm({ filters }: { filters: CoachMakerMoksilgiProgressFilters }) {
  return (
    <form className="print-hidden mt-6 grid gap-4 rounded-md border border-slate-200 bg-white p-5 md:grid-cols-3 lg:grid-cols-6" method="get">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          <I18nText k="moksilgi.year" fallback="연도" />
        </span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.year}
          max={2100}
          min={2000}
          name="year"
          type="number"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          <I18nText k="moksilgi.region" fallback="지역" />
        </span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.regionName ?? ""}
          name="region"
          type="search"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          <I18nText k="moksilgi.team" fallback="팀/목장" />
        </span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.teamName ?? ""}
          name="team"
          type="search"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          <I18nText k="moksilgi.role" fallback="직책" />
        </span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.roleLabel ?? ""}
          name="role"
          type="search"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          <I18nText k="moksilgi.generation" fallback="세대" />
        </span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.generationLabel ?? ""}
          name="generation"
          type="search"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          <I18nText k="moksilgi.keyword" fallback="검색어" />
        </span>
        <input
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={filters.search ?? ""}
          name="search"
          type="search"
        />
      </label>
      <div className="flex items-end gap-3 md:col-span-3 lg:col-span-6">
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          type="submit"
        >
          <I18nText k="moksilgi.query" fallback="조회" />
        </button>
        <Link
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/coach-maker/moksilgi-progress?year=${filters.year}`}
        >
          <I18nText k="moksilgi.resetFilters" fallback="필터 초기화" />
        </Link>
      </div>
    </form>
  );
}

function ProfileMissing() {
  return (
    <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
      <p className="text-slate-700">아직 프로필이 생성되지 않았습니다.</p>
      <Link className="mt-4 inline-block text-sm font-medium text-slate-700 underline" href="/profile">
        프로필 보기
      </Link>
    </section>
  );
}

export default async function CoachMakerMoksilgiProgressPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const filters = parseFilters(params);
  const initialMemberId = textParam(params.memberId);
  const result = await getCoachMakerMoksilgiProgress(filters);
  const statusCounts = result.data
    ? progressStatusCounts(result.data.rows)
    : { completed: 0, inProgress: 0, notStarted: 0 };

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach-maker/moksilgi-progress");
  }

  return (
    <main className="print-root min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-7xl">
        <div className="print-report-title print-only">
          <h1>
            <I18nText k="moksilgi.reportTitle" fallback="목실기 전체 진행 현황 보고서" />
          </h1>
          <p>
            <I18nText k="moksilgi.reportYear" fallback="출력 연도" />: {filters.year}
          </p>
          <p>
            <I18nText k="moksilgi.generatedAt" fallback="생성일" />: {new Date().toLocaleDateString("ko-KR")}
          </p>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              <I18nText k="moksilgi.title" fallback="코치메이커 전체 목실기 성취 현황" />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="moksilgi.title" fallback="전체 목실기 성취 현황" />
            </h1>
            <p className="mt-2 text-lg text-slate-700">
              <I18nText k="nav.moksilgiProgress" fallback="코치메이커용 목실기 진행 현황" />
            </p>
            <p className="mt-3 max-w-3xl text-slate-600">
              <I18nText
                k="moksilgi.subtitle"
                fallback="지역/팀의 코치와 코치이 목실기 월별 성취율을 한눈에 확인합니다."
              />
            </p>
          </div>
          <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
            <PrintPageButton
              fileName={`moksilgi-team-progress-${filters.year}`}
              label="목실기 전체 현황 출력"
            />
            <PageNavigationButtons className="justify-start sm:justify-end" />
          </div>
        </div>

        <FilterForm filters={filters} />

        {result.error?.code === "PROFILE_NOT_FOUND" ? (
          <ProfileMissing />
        ) : result.error?.code === "ACCESS_DENIED" ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            <I18nText k="moksilgi.accessDenied" fallback="코치메이커 권한이 없습니다." />
          </section>
        ) : result.error ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            <I18nText k="moksilgi.loadFailed" fallback="지금 전체 목실기 성취 현황을 불러올 수 없습니다." />
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                description="현재 필터 조건으로 조회된 목실기 대상자 수입니다."
                title={<I18nText k="moksilgi.totalTargets" fallback="전체 대상자 수" />}
                value={result.data.rows.length}
              />
              <SummaryCard
                description="12개월 누적 성취율이 100% 이상인 대상자 수입니다."
                title={<I18nText k="moksilgi.completedCount" fallback="완료 수" />}
                value={statusCounts.completed}
              />
              <SummaryCard
                description="누적 성취율이 0% 초과 100% 미만인 대상자 수입니다."
                title={<I18nText k="moksilgi.inProgressCount" fallback="진행 수" />}
                value={statusCounts.inProgress}
              />
              <SummaryCard
                description="아직 누적 성취 기록이 없는 대상자 수입니다."
                title={<I18nText k="moksilgi.notCompletedCount" fallback="미완료 수" />}
                value={statusCounts.notStarted}
              />
              <SummaryCard
                description="선택 연도 기준 현재 월까지의 평균 성취율입니다."
                title={<I18nText k="moksilgi.upToCurrent" fallback="전체 성취(UP TO CURRENT)" />}
                value={formatPercent(result.data.upToCurrentRate)}
              />
              <SummaryCard
                description="1월부터 12월까지 전체 평균 누적 성취율입니다."
                title={<I18nText k="moksilgi.fullYearAverage" fallback="12개월 전체 성취 현황" />}
                value={formatPercent(result.data.averageRow.cumulative_rate)}
              />
              <SummaryCard
                description="현재 조회 중인 목실기 성취 현황 연도입니다."
                title={<I18nText k="moksilgi.queryYear" fallback="조회 연도" />}
                value={result.data.year}
              />
              <SummaryCard
                description={
                  result.data.scopeMode === "all"
                    ? "전체 비삭제 목실기를 조회합니다."
                    : "직접 코칭 관계 기준으로 조회합니다."
                }
                title={<I18nText k="moksilgi.queryScope" fallback="조회 범위" />}
                value={
                  result.data.scopeMode === "all"
                    ? <I18nText k="moksilgi.allScope" fallback="전체" />
                    : <I18nText k="moksilgi.directCoachingScope" fallback="직접 코칭" />
                }
              />
            </section>

            {result.data.rows.length === 0 ? (
              <p className="mt-8 rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-slate-500">
                <I18nText k="moksilgi.noProgressData" fallback="아직 확인할 목실기 성취 현황이 없습니다." />
              </p>
            ) : (
              <MoksilgiProgressClientTable
                initialMemberId={initialMemberId}
                relationshipRows={result.data.relationshipRows}
                rows={result.data.rows}
                year={result.data.year}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}
