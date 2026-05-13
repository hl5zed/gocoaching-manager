import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  getCoachMakerCoachStats,
  type CoachMakerCoachStatsData,
} from "@/lib/api/coach-maker/coach-stats";
import {
  getCoachMakerMoksilgiProgress,
  type CoachMakerMoksilgiProgressRow,
} from "@/lib/api/coach-maker/moksilgi-progress";
import { PageNavigationButtons } from "@/components/navigation/PageNavigationButtons";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { ActionMemoDrafts } from "./ActionMemoDrafts";

export const dynamic = "force-dynamic";

function formatPercent(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(1)}%`;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "미입력";
}

function displayOptional(value: string | null | undefined, fallback = "미등록") {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function personName(row: CoachMakerMoksilgiProgressRow) {
  return row.display_name ?? row.full_name ?? row.email ?? row.author_name ?? "알 수 없음";
}

function monthRate(row: CoachMakerMoksilgiProgressRow, month: number) {
  switch (month) {
    case 1:
      return row.month_1_rate;
    case 2:
      return row.month_2_rate;
    case 3:
      return row.month_3_rate;
    case 4:
      return row.month_4_rate;
    case 5:
      return row.month_5_rate;
    case 6:
      return row.month_6_rate;
    case 7:
      return row.month_7_rate;
    case 8:
      return row.month_8_rate;
    case 9:
      return row.month_9_rate;
    case 10:
      return row.month_10_rate;
    case 11:
      return row.month_11_rate;
    case 12:
      return row.month_12_rate;
    default:
      return 0;
  }
}

function getCurrentMonthCutoff(year: number) {
  const today = new Date();

  if (year < today.getFullYear()) return 12;
  if (year > today.getFullYear()) return 0;
  return today.getMonth() + 1;
}

function hasProgressInput(row: CoachMakerMoksilgiProgressRow) {
  return Array.from({ length: 12 }, (_, index) => index + 1).some(
    (month) => safeNumber(monthRate(row, month)) > 0,
  ) || safeNumber(row.cumulative_rate) > 0;
}

function upToCurrentRate(row: CoachMakerMoksilgiProgressRow, year: number) {
  const cutoff = getCurrentMonthCutoff(year);
  if (cutoff === 0) return null;

  return average(
    Array.from({ length: cutoff }, (_, index) =>
      safeNumber(monthRate(row, index + 1)),
    ),
  );
}

function attentionSummary(rows: CoachMakerMoksilgiProgressRow[], year: number) {
  const rowsWithRate = rows.map((row) => ({
    rate: upToCurrentRate(row, year),
    row,
  }));
  const missingRows = rowsWithRate.filter(
    (item) => item.rate === null || !hasProgressInput(item.row),
  );
  const allAttentionRows = rowsWithRate
    .filter(
      (item): item is { rate: number; row: CoachMakerMoksilgiProgressRow } =>
        item.rate !== null && hasProgressInput(item.row) && item.rate < 50,
    )
    .sort((left, right) => left.rate - right.rate);

  return {
    attentionRows: allAttentionRows.slice(0, 5),
    attentionCount: allAttentionRows.length,
    missingCount: missingRows.length,
  };
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
  accent = "default",
  description,
  title,
  value,
}: {
  accent?: "default" | "strong";
  description: ReactNode;
  title: ReactNode;
  value: number | string;
}) {
  return (
    <div
      className={`rounded-md border p-5 ${
        accent === "strong"
          ? "border-slate-300 bg-slate-950 text-white"
          : "border-slate-200 bg-white"
      }`}
    >
      <p
        className={`text-sm font-medium ${
          accent === "strong" ? "text-slate-300" : "text-slate-500"
        }`}
      >
        {title}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold ${
          accent === "strong" ? "text-white" : "text-slate-950"
        }`}
      >
        {value}
      </p>
      <p
        className={`mt-2 text-sm leading-6 ${
          accent === "strong" ? "text-slate-200" : "text-slate-600"
        }`}
      >
        {description}
      </p>
    </div>
  );
}

function ProfileMissing() {
  return (
    <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
      <p className="text-slate-700">
        <I18nText k="dashboard.noProfile" fallback="아직 프로필이 생성되지 않았습니다." />
      </p>
      <Link
        className="mt-4 inline-block text-sm font-medium text-slate-700 underline"
        href="/profile"
      >
        <I18nText k="dashboard.viewProfile" fallback="프로필 보기" />
      </Link>
    </section>
  );
}

function CoachStatsSection({
  data,
}: {
  data: CoachMakerCoachStatsData;
}) {
  return (
    <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium text-slate-500">
            <I18nText k="coachMaker.coachStatusHeading" fallback="코치별 현황" /> ·{" "}
            {data.weekRange.start} ~ {data.weekRange.end}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            <I18nText
              k="coachMaker.coachStatusDescription"
              fallback="관리 범위 내 코치별 담당 코치이 통계"
            />
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {data.scopeLabel}{" "}
            <I18nText
              k="coachMaker.coachStatusHelp"
              fallback="기준으로 active 코칭 관계와 제출/공유 현황을 집계합니다. 개인 기록 본문은 표시하지 않습니다."
            />
          </p>
        </div>
        <Link
          className="inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto"
          href="/coach/relationships"
        >
          <I18nText k="coachMaker.viewRelationships" fallback="코칭 관계 보기" />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          description={<I18nText k="coachMaker.totalCoachesDescription" fallback="관리 범위 안에서 active 관계가 있는 코치 수입니다." />}
          title={<I18nText k="coachMaker.totalCoaches" fallback="전체 코치 수" />}
          value={`${data.summary.coachCount}명`}
        />
        <SummaryCard
          description={<I18nText k="coachMaker.totalCoacheesDescription" fallback="active 코칭 관계의 코치이 수입니다." />}
          title={<I18nText k="coachMaker.totalCoachees" fallback="전체 담당 코치이 수" />}
          value={`${data.summary.assignedCoacheeCount}명`}
        />
        <SummaryCard
          description={<I18nText k="coachMaker.weeklySubmittedDescription" fallback="이번 주 제출된 주간 기록 기준 코치이 수입니다." />}
          title={<I18nText k="coachMaker.weeklySubmitted" fallback="이번 주 제출" />}
          value={`${data.summary.weeklySubmittedThisWeekCount}명`}
        />
        <SummaryCard
          description={<I18nText k="coachMaker.weeklyMissingDescription" fallback="담당 코치이 중 이번 주 제출이 확인되지 않은 인원입니다." />}
          title={<I18nText k="coachMaker.weeklyMissing" fallback="이번 주 미제출" />}
          value={`${data.summary.weeklyMissingThisWeekCount}명`}
        />
        <SummaryCard
          description={<I18nText k="coachMaker.sharedDailyRecordsDescription" fallback="코치에게 공유된 하루 기록 수입니다." />}
          title={<I18nText k="coachMaker.sharedDailyRecords" fallback="공유된 하루 기록" />}
          value={`${data.summary.sharedDailyRecordCount}개`}
        />
        <SummaryCard
          description={<I18nText k="coachMaker.sharedMonthlyReflectionsDescription" fallback="코치에게 공유된 월간 회고 수입니다." />}
          title={<I18nText k="coachMaker.sharedMonthlyReflections" fallback="공유된 월간 회고" />}
          value={`${data.summary.sharedMonthlyReflectionCount}개`}
        />
        <SummaryCard
          description={<I18nText k="coachMaker.totalFeedbackDescription" fallback="작성된 코치 피드백 수입니다." />}
          title={<I18nText k="coachMaker.totalFeedback" fallback="전체 피드백 수" />}
          value={`${data.summary.feedbackCount}개`}
        />
        <SummaryCard
          description={<I18nText k="coachMaker.feedbackPendingDescription" fallback="제출된 주간 기록 중 피드백이 없는 항목입니다." />}
          title={<I18nText k="coachMaker.feedbackPending" fallback="피드백 대기" />}
          value={`${data.summary.feedbackPendingCount}개`}
        />
      </div>

      {data.coaches.length === 0 ? (
        <p className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          <I18nText
            k="coachMaker.noCoachStats"
            fallback="관리 범위 안에 등록된 코치가 없거나 아직 배정된 코치-코치이 관계가 없습니다."
          />
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2 font-semibold"><I18nText k="roles.coach" fallback="코치" /></th>
                <th className="px-3 py-2 font-semibold"><I18nText k="coachMaker.assignedCoachees" fallback="담당 코치이" /></th>
                <th className="px-3 py-2 font-semibold"><I18nText k="coachMaker.weeklySubmitted" fallback="이번 주 제출" /></th>
                <th className="px-3 py-2 font-semibold"><I18nText k="coachMaker.weeklyMissing" fallback="이번 주 미제출" /></th>
                <th className="px-3 py-2 font-semibold"><I18nText k="coachMaker.sharedDailyRecords" fallback="공유 하루 기록" /></th>
                <th className="px-3 py-2 font-semibold"><I18nText k="coachMaker.sharedMonthlyReflections" fallback="공유 월간 회고" /></th>
                <th className="px-3 py-2 font-semibold"><I18nText k="coachMaker.totalFeedback" fallback="피드백 작성" /></th>
                <th className="px-3 py-2 font-semibold"><I18nText k="coachMaker.feedbackPending" fallback="피드백 대기" /></th>
              </tr>
            </thead>
            <tbody>
              {data.coaches.map((coach) => (
                <tr className="border-b border-slate-100" key={coach.coachId}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-950">{coach.coachName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {displayOptional(coach.coachEmail, "이메일 미등록")}
                    </p>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-950">
                    {coach.assignedCoacheeCount}명
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {coach.weeklySubmittedThisWeekCount}명
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {coach.weeklyMissingThisWeekCount}명
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {coach.sharedDailyRecordCount}개
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {coach.sharedMonthlyReflectionCount}개
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {coach.feedbackCount}개
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        coach.feedbackPendingCount > 0
                          ? "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                          : "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                      }
                    >
                      {coach.feedbackPendingCount > 0
                        ? `${coach.feedbackPendingCount}개 확인 필요`
                        : "대기 없음"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function CoachMakerPage() {
  const currentYear = new Date().getFullYear();
  const coachStatsResult = await getCoachMakerCoachStats();
  const result = await getCoachMakerMoksilgiProgress({
    year: currentYear,
    teamName: null,
    regionName: null,
    roleLabel: null,
    generationLabel: null,
    search: null,
  });

  if (result.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach-maker");
  }

  if (coachStatsResult.error?.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=/coach-maker");
  }

  const statusCounts = result.data
    ? progressStatusCounts(result.data.rows)
    : { completed: 0, inProgress: 0, notStarted: 0 };
  const attention = result.data
    ? attentionSummary(result.data.rows, result.data.year)
    : { attentionCount: 0, attentionRows: [], missingCount: 0 };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              <I18nText k="nav.coachMaker" fallback="코치메이커" />
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              <I18nText k="coachMaker.title" fallback="코치메이커 대시보드" />
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              <I18nText
                k="coachMaker.subtitle"
                fallback="담당 범위의 목실기 성취 현황과 코칭 진행 상태를 확인합니다."
              />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PageNavigationButtons className="justify-start sm:justify-end" />
            <Link
              className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              href={`/coach-maker/report?year=${currentYear}`}
            >
              <I18nText k="common.print" fallback="인쇄용 보고서 보기" />
            </Link>
          </div>
        </div>

        {result.error?.code === "PROFILE_NOT_FOUND" ? (
          <ProfileMissing />
        ) : result.error?.code === "ACCESS_DENIED" ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            <I18nText k="moksilgi.accessDenied" fallback="코치메이커 권한이 없습니다." />
          </section>
        ) : result.error ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            <I18nText
              k="moksilgi.loadFailed"
              fallback="목실기 요약 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요."
            />
          </section>
        ) : (
          <>
            {coachStatsResult.data ? (
              <CoachStatsSection data={coachStatsResult.data} />
            ) : coachStatsResult.error ? (
              <section className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {coachStatsResult.error.message}
              </section>
            ) : null}

            <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {result.data.year} <I18nText k="moksilgi.yearSummary" fallback="년 목실기 요약" />
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    <I18nText k="moksilgi.achievementStatus" fallback="목실기 성취 현황" />
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    <I18nText
                      k="moksilgi.summaryDescription"
                      fallback="접근 가능한 대상자의 목실기 진행 상태와 평균 성취율을 요약합니다."
                    />
                  </p>
                </div>
                <Link
                  className="inline-flex w-full justify-center rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto"
                  href={`/coach-maker/moksilgi-progress?year=${result.data.year}`}
                >
                  <I18nText k="moksilgi.viewOverallProgress" fallback="전체 목실기 현황 보기" />
                </Link>
              </div>

              {result.data.rows.length === 0 ? (
                <p className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-500">
                  <I18nText
                    k="moksilgi.noProgressSummary"
                    fallback="아직 목실기 현황 데이터가 없습니다. 코치이가 목실기와 월별 기록을 저장하면 이곳에 요약이 표시됩니다."
                  />
                </p>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard
                    description={<I18nText k="moksilgi.totalTargetsDescription" fallback="현재 접근 가능한 목실기 대상자 수입니다." />}
                    title={<I18nText k="moksilgi.totalTargets" fallback="전체 대상자 수" />}
                    value={result.data.rows.length}
                  />
                  <SummaryCard
                    description={<I18nText k="moksilgi.inProgressTargetsDescription" fallback="누적 성취율이 0% 초과 100% 미만인 인원입니다." />}
                    title={<I18nText k="moksilgi.inProgressTargets" fallback="진행 중 인원" />}
                    value={statusCounts.inProgress}
                  />
                  <SummaryCard
                    description={<I18nText k="moksilgi.completedTargetsDescription" fallback="12개월 누적 성취율이 100% 이상인 인원입니다." />}
                    title={<I18nText k="moksilgi.completedTargets" fallback="완료 인원" />}
                    value={statusCounts.completed}
                  />
                  <SummaryCard
                    description={<I18nText k="moksilgi.notStartedTargetsDescription" fallback="아직 누적 성취 기록이 없는 인원입니다." />}
                    title={<I18nText k="moksilgi.notStartedTargets" fallback="미완료 인원" />}
                    value={statusCounts.notStarted}
                  />
                  <SummaryCard
                    description={<I18nText k="moksilgi.currentAverageDescription" fallback="선택 연도 기준 현재 월까지의 평균 성취율입니다." />}
                    title={<I18nText k="moksilgi.currentAverage" fallback="현재 월까지 평균 성취율" />}
                    value={formatPercent(result.data.upToCurrentRate)}
                    accent="strong"
                  />
                  <SummaryCard
                    description={<I18nText k="moksilgi.fullYearAverageDescription" fallback="1월부터 12월까지 전체 평균 누적 성취율입니다." />}
                    title={<I18nText k="moksilgi.fullYearAverage" fallback="12개월 전체 평균 성취율" />}
                    value={formatPercent(result.data.averageRow.cumulative_rate)}
                    accent="strong"
                  />
                  <SummaryCard
                    description={<I18nText k="moksilgi.attentionTargetsDescription" fallback="현재 월까지 성취율이 50% 미만인 대상자 수입니다." />}
                    title={<I18nText k="moksilgi.attentionTargets" fallback="관심 필요 대상자 수" />}
                    value={attention.attentionCount}
                  />
                  <SummaryCard
                    description={<I18nText k="moksilgi.missingTargetsDescription" fallback="성취율 계산이 어렵거나 기록이 없는 대상자 수입니다." />}
                    title={<I18nText k="moksilgi.missingTargets" fallback="미입력 대상자 수" />}
                    value={attention.missingCount}
                  />
                </div>
              )}

              {result.data.rows.length > 0 ? (
                <section className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        <I18nText k="moksilgi.quickCheck" fallback="빠른 점검" />
                      </p>
                      <h3 className="text-lg font-semibold text-slate-950">
                        <I18nText k="moksilgi.attentionUsers" fallback="관심 필요 대상자" />
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        <I18nText
                          k="moksilgi.attentionUsersDescription"
                          fallback="현재 월까지 성취율이 50% 미만인 대상자 중 낮은 성취율 순으로 최대 5명을 표시합니다."
                        />
                      </p>
                    </div>
                    <Link
                      className="inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto"
                      href={`/coach-maker/moksilgi-progress?year=${result.data.year}`}
                    >
                      <I18nText k="moksilgi.viewOverallProgress" fallback="전체 목실기 현황 보기" />
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-amber-200 bg-white p-4">
                      <p className="text-sm font-medium text-slate-500">
                        <I18nText k="moksilgi.attentionTargets" fallback="관심 필요 대상자 수" />
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-amber-700">
                        {attention.attentionCount}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        <I18nText k="moksilgi.lowAverageReason" fallback="현재 월까지 성취율이 50% 미만입니다." />
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-4">
                      <p className="text-sm font-medium text-slate-500">
                        <I18nText k="moksilgi.missingTargets" fallback="미입력 대상자 수" />
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {attention.missingCount}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        <I18nText
                          k="moksilgi.missingTargetsReason"
                          fallback="기록이 없거나 성취율 계산이 어려운 대상자입니다."
                        />
                      </p>
                    </div>
                  </div>

                  {attention.attentionRows.length === 0 ? (
                    <p className="mt-4 rounded-md border border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-500">
                      <I18nText k="moksilgi.noAttentionUsers" fallback="관심 필요 대상자가 없습니다." />
                    </p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-[760px] w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-600">
                            <th className="px-3 py-2 font-semibold"><I18nText k="members.name" fallback="이름" /></th>
                            <th className="px-3 py-2 font-semibold"><I18nText k="moksilgi.team" fallback="팀" /></th>
                            <th className="px-3 py-2 font-semibold"><I18nText k="moksilgi.region" fallback="지역" /></th>
                            <th className="px-3 py-2 font-semibold"><I18nText k="moksilgi.currentAverage" fallback="현재 월까지 성취율" /></th>
                            <th className="px-3 py-2 font-semibold"><I18nText k="moksilgi.details" fallback="상세" /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {attention.attentionRows.map((item) => (
                            <tr className="border-b border-slate-100" key={item.row.plan_id}>
                              <td className="px-3 py-3 font-medium text-slate-950">
                                {personName(item.row)}
                              </td>
                              <td className="px-3 py-3 text-slate-700">
                                {displayValue(item.row.team_name)}
                              </td>
                              <td className="px-3 py-3 text-slate-700">
                                {displayValue(item.row.region_name)}
                              </td>
                              <td className="px-3 py-3 font-semibold text-amber-700">
                                {formatPercent(item.rate)}
                              </td>
                              <td className="px-3 py-3">
                                <Link
                                  className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
                                  href={`/coach-maker/moksilgi-progress?year=${result.data.year}&memberId=${encodeURIComponent(item.row.profile_id)}`}
                                >
                                  <I18nText k="moksilgi.viewProgress" fallback="현황 보기" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}
            </section>

            <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    <I18nText k="coachMaker.myCoachingManagement" fallback="나의 코칭 관리" />
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    <I18nText k="coachMaker.personalCoachRole" fallback="개인 코치 역할 기능" />
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    <I18nText
                      k="coachMaker.myCoachingManagementDescription"
                      fallback="코치메이커가 동시에 코치 역할을 수행할 때 사용하는 개인 코칭 관리 기능입니다."
                    />
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white"
                  href="/coach"
                >
                  <h3 className="font-semibold text-slate-950">
                    <I18nText k="coachMaker.myCoachingManagement" fallback="나의 코칭 관리" />
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    <I18nText
                      k="coachMaker.myCoachingManagementCardDescription"
                      fallback="내가 코치로 담당하는 코치이와 코칭 기록을 확인합니다."
                    />
                  </p>
                </Link>
              </div>
            </section>

            <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    <I18nText k="coachMaker.moksilgiProgress" fallback="전체 목실기 성취 현황" />
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    <I18nText k="coachMaker.teamMoksilgiManagement" fallback="지역/팀 목실기 관리 기능" />
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    <I18nText
                      k="coachMaker.moksilgiProgressDescription"
                      fallback="코치메이커가 담당 지역/팀의 목실기 진행 흐름을 확인하는 관리 기능입니다."
                    />
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white"
                  href="/coach-maker/moksilgi-progress"
                >
                  <h3 className="font-semibold text-slate-950">
                    <I18nText k="coachMaker.moksilgiProgress" fallback="전체 목실기 성취 현황" />
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    <I18nText
                      k="coachMaker.moksilgiProgressCardDescription"
                      fallback="담당 지역/팀의 코치와 코치이 목실기 월별 성취율을 한눈에 확인합니다."
                    />
                  </p>
                </Link>
              </div>
            </section>

            <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    <I18nText k="coachMaker.coachingStructureManagement" fallback="코칭 구조 관리" />
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">
                    <I18nText k="coachMaker.coachingRelationshipFlow" fallback="코칭 관계와 세대 흐름" />
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    <I18nText
                      k="coachMaker.coachingStructureDescription"
                      fallback="코칭 관계와 세대별 계층 구조를 시각적으로 확인하는 기능입니다."
                    />
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Link
                  className="rounded-md border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white"
                  href="/admin/coaching-genealogy"
                >
                  <h3 className="font-semibold text-slate-950">
                    <I18nText k="coachMaker.coachingGenealogy" fallback="세대별 계층 계보도" />
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    <I18nText
                      k="coachMaker.coachingGenealogyDescription"
                      fallback="내가 담당하거나 접근 가능한 코칭 관계의 세대별 흐름과 계층 구조를 확인합니다."
                    />
                  </p>
                </Link>
              </div>
            </section>
          </>
        )}

        <ActionMemoDrafts
          attentionTargets={attention.attentionRows.map((item) => ({
            region: item.row.region_name,
            targetName: personName(item.row),
            targetUserId: item.row.profile_id,
            teamName: item.row.team_name,
          }))}
        />
      </section>
    </main>
  );
}
