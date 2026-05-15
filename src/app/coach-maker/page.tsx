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
import { ActionMemoDrafts, ActionMemoTaskSummary } from "./ActionMemoDrafts";

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
      className={`min-w-0 rounded-md border p-5 ${
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
        className={`mt-2 break-words text-3xl font-semibold ${
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
    <section className="mt-8 rounded-md border border-slate-200 bg-white p-4 sm:p-6">
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

type AttentionSummaryData = {
  attentionCount: number;
  attentionRows: Array<{
    rate: number;
    row: CoachMakerMoksilgiProgressRow;
  }>;
  missingCount: number;
};

function TopSummarySection({
  attention,
  coachStats,
}: {
  attention: AttentionSummaryData;
  coachStats: CoachMakerCoachStatsData;
}) {
  return (
    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <SummaryCard
        description={<I18nText k="coachMaker.totalCoachesDescription" fallback="현재 관리 중인 코치입니다." />}
        title={<I18nText k="coachMaker.totalCoaches" fallback="전체 코치 수" />}
        value={`${coachStats.summary.coachCount}명`}
      />
      <SummaryCard
        description={<I18nText k="coachMaker.totalCoacheesDescription" fallback="배정된 코치이입니다." />}
        title={<I18nText k="coachMaker.totalCoachees" fallback="전체 담당 코치이 수" />}
        value={`${coachStats.summary.assignedCoacheeCount}명`}
      />
      <SummaryCard
        description={<I18nText k="coachMaker.weeklySubmittedDescription" fallback="이번 주 기록 제출 인원입니다." />}
        title={<I18nText k="coachMaker.weeklySubmitted" fallback="이번 주 제출" />}
        value={`${coachStats.summary.weeklySubmittedThisWeekCount}명`}
      />
      <SummaryCard
        description={<I18nText k="coachMaker.weeklyMissingDescription" fallback="이번 주 확인이 필요합니다." />}
        title={<I18nText k="coachMaker.weeklyMissing" fallback="이번 주 미제출" />}
        value={`${coachStats.summary.weeklyMissingThisWeekCount}명`}
      />
      <SummaryCard
        description={<I18nText k="coachMaker.feedbackPendingDescription" fallback="아직 피드백이 필요합니다." />}
        title={<I18nText k="coachMaker.feedbackPending" fallback="피드백 대기" />}
        value={`${coachStats.summary.feedbackPendingCount}개`}
      />
      <SummaryCard
        description={<I18nText k="moksilgi.attentionTargetsDescription" fallback="목실기 점검이 필요합니다." />}
        title={<I18nText k="moksilgi.attentionTargets" fallback="관심 필요 대상자" />}
        value={`${attention.attentionCount}명`}
        accent="strong"
      />
    </section>
  );
}

function WorkQueueSection({
  attention,
  coachStats,
  year,
}: {
  attention: AttentionSummaryData;
  coachStats: CoachMakerCoachStatsData;
  year: number;
}) {
  const cards = [
    {
      action: "미제출 확인",
      description: "이번 주 기록을 아직 내지 않았습니다.",
      href: "/coach/weekly-logs",
      title: "미제출 인원",
      value: `${coachStats.summary.weeklyMissingThisWeekCount}명`,
    },
    {
      action: "피드백 확인",
      description: "제출된 기록에 피드백이 필요합니다.",
      href: "/coach/weekly-logs",
      title: "피드백 대기",
      value: `${coachStats.summary.feedbackPendingCount}개`,
    },
    {
      action: "목실기 현황 보기",
      description: "성취율이 낮은 대상자를 먼저 봅니다.",
      href: "#quick-check",
      title: "관심 필요 대상자",
      value: `${attention.attentionCount}명`,
    },
  ];

  return (
    <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
      <div>
        <p className="text-sm font-medium text-slate-500">
          오늘/이번 주 처리 필요
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">
          우선 확인할 작업
        </h2>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-4"
            key={card.title}
          >
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {card.value}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {card.description}
            </p>
            <Link
              className="mt-4 inline-flex min-h-10 w-full justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
              href={card.href}
            >
              {card.action}
            </Link>
          </article>
        ))}
        <ActionMemoTaskSummary />
      </div>
      <div className="mt-4 text-sm text-slate-500">
        목실기 기준 연도: {year}
      </div>
    </section>
  );
}

function QuickCheckSection({
  attention,
  year,
}: {
  attention: AttentionSummaryData;
  year: number;
}) {
  return (
    <section
      className="mt-8 rounded-md border border-slate-200 bg-white p-4 sm:p-6"
      id="quick-check"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            <I18nText k="moksilgi.quickCheck" fallback="빠른 점검" />
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            <I18nText k="moksilgi.attentionUsers" fallback="관심 필요 대상자" />
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            성취율이 낮은 대상자 중 낮은 순서로 최대 5명만 표시합니다.
          </p>
        </div>
        <Link
          className="inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto"
          href={`/coach-maker/moksilgi-progress?year=${year}`}
        >
          <I18nText k="moksilgi.viewOverallProgress" fallback="전체 목실기 현황 보기" />
        </Link>
      </div>

      {attention.attentionRows.length === 0 ? (
        <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
          <I18nText k="moksilgi.noAttentionUsers" fallback="관심 필요 대상자가 없습니다." />
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2 font-semibold">
                  <I18nText k="members.name" fallback="이름" />
                </th>
                <th className="px-3 py-2 font-semibold">소속</th>
                <th className="px-3 py-2 font-semibold">
                  <I18nText k="moksilgi.currentAverage" fallback="현재 월까지 성취율" />
                </th>
                <th className="px-3 py-2 font-semibold">조치</th>
              </tr>
            </thead>
            <tbody>
              {attention.attentionRows.map((item) => (
                <tr className="border-b border-slate-100" key={item.row.plan_id}>
                  <td className="px-3 py-3 font-medium text-slate-950">
                    {personName(item.row)}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <p>국가/소속: {displayValue(item.row.region_name)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      공동체/팀: {displayValue(item.row.team_name)}
                    </p>
                  </td>
                  <td className="px-3 py-3 font-semibold text-amber-700">
                    {formatPercent(item.rate)}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      href={`/coach-maker/moksilgi-progress?year=${year}&memberId=${encodeURIComponent(item.row.profile_id)}`}
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
  );
}

function CoachStatsSection({
  data,
}: {
  data: CoachMakerCoachStatsData;
}) {
  return (
    <section className="mt-8 rounded-md border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium text-slate-500">
            <I18nText k="coachMaker.coachStatusHeading" fallback="코치별 현황" /> ·{" "}
            {data.weekRange.start} ~ {data.weekRange.end}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            코칭 진행 요약
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

      {data.coaches.length === 0 ? (
        <p className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          <I18nText
            k="coachMaker.noCoachStats"
            fallback="관리 범위 안에 등록된 코치가 없거나 아직 배정된 코치-코치이 관계가 없습니다."
          />
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2 font-semibold"><I18nText k="roles.coach" fallback="코치" /></th>
                <th className="px-3 py-2 font-semibold"><I18nText k="coachMaker.assignedCoachees" fallback="담당 코치이" /></th>
                <th className="px-3 py-2 font-semibold">이번 주 진행</th>
                <th className="px-3 py-2 font-semibold">확인 필요</th>
                <th className="px-3 py-2 font-semibold">조치</th>
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
                    제출 {coach.weeklySubmittedThisWeekCount}명 / 담당{" "}
                    {coach.assignedCoacheeCount}명
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={
                          coach.weeklyMissingThisWeekCount > 0
                            ? "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                            : "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                        }
                      >
                        미제출 {coach.weeklyMissingThisWeekCount}명
                      </span>
                      <span
                        className={
                          coach.feedbackPendingCount > 0
                            ? "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                            : "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                        }
                      >
                        피드백 대기 {coach.feedbackPendingCount}개
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <details className="min-w-36">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700 underline">
                        상세 통계
                      </summary>
                      <dl className="mt-2 grid gap-1 text-xs text-slate-600">
                        <div>공유 하루 기록 {coach.sharedDailyRecordCount}개</div>
                        <div>공유 월간 회고 {coach.sharedMonthlyReflectionCount}개</div>
                        <div>피드백 작성 {coach.feedbackCount}개</div>
                      </dl>
                    </details>
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

function MoksilgiSummarySection({
  attention,
  data,
}: {
  attention: AttentionSummaryData;
  data: NonNullable<Awaited<ReturnType<typeof getCoachMakerMoksilgiProgress>>["data"]>;
}) {
  return (
    <section className="mt-8 rounded-md border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {data.year} <I18nText k="moksilgi.yearSummary" fallback="년 목실기 요약" />
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            목실기 성취 요약
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            전체 {data.rows.length}명 중 현재 월까지 평균 성취율은{" "}
            <span className="font-semibold text-slate-950">
              {formatPercent(data.upToCurrentRate)}
            </span>
            입니다.
          </p>
        </div>
        <Link
          className="inline-flex w-full justify-center rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto"
          href={`/coach-maker/moksilgi-progress?year=${data.year}`}
        >
          <I18nText k="moksilgi.viewOverallProgress" fallback="전체 목실기 현황 보기" />
        </Link>
      </div>

      {data.rows.length === 0 ? (
        <p className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-500">
          <I18nText
            k="moksilgi.noProgressSummary"
            fallback="아직 목실기 현황 데이터가 없습니다. 코치이가 목실기와 월별 기록을 저장하면 이곳에 요약이 표시됩니다."
          />
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            description={<I18nText k="moksilgi.totalTargetsDescription" fallback="현재 확인 가능한 대상자입니다." />}
            title={<I18nText k="moksilgi.totalTargets" fallback="전체 대상자 수" />}
            value={data.rows.length}
          />
          <SummaryCard
            description={<I18nText k="moksilgi.currentAverageDescription" fallback="현재 월까지 평균입니다." />}
            title={<I18nText k="moksilgi.currentAverage" fallback="현재 월까지 평균 성취율" />}
            value={formatPercent(data.upToCurrentRate)}
            accent="strong"
          />
          <SummaryCard
            description={<I18nText k="moksilgi.attentionTargetsDescription" fallback="먼저 살펴볼 대상자입니다." />}
            title={<I18nText k="moksilgi.attentionTargets" fallback="관심 필요 대상자 수" />}
            value={attention.attentionCount}
          />
          <SummaryCard
            description={<I18nText k="moksilgi.missingTargetsDescription" fallback="기록 확인이 필요합니다." />}
            title={<I18nText k="moksilgi.missingTargets" fallback="미입력 대상자 수" />}
            value={attention.missingCount}
          />
        </div>
      )}
    </section>
  );
}

function QuickLinksSection({
  canAccessAdminGenealogy,
}: {
  canAccessAdminGenealogy: boolean;
}) {
  const cards: Array<{
    description: string;
    href?: string;
    title: string;
  }> = [
    {
      description: "담당 코치이와 코칭 기록을 확인합니다.",
      href: "/coach",
      title: "나의 코칭 관리",
    },
    {
      description: "전체 목실기 월별 성취율을 확인합니다.",
      href: "/coach-maker/moksilgi-progress",
      title: "전체 목실기 성취 현황",
    },
    {
      description: canAccessAdminGenealogy
        ? "코칭 관계와 세대별 계층 구조를 관리자 권한으로 확인합니다."
        : "관리자 권한에서 제공됩니다.",
      href: canAccessAdminGenealogy ? "/admin/coaching-genealogy" : undefined,
      title: "세대별 계층 계보도",
    },
    {
      description: "후속 관리 메모를 확인하고 작성합니다.",
      href: "#action-memos",
      title: "관리 액션 메모",
    },
  ];

  return (
    <section className="mt-8 rounded-md border border-slate-200 bg-white p-4 sm:p-6">
      <div>
        <p className="text-sm font-medium text-slate-500">주요 기능</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">
          바로가기
        </h2>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) =>
          card.href ? (
            <Link
              className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white"
              href={card.href}
              key={card.title}
            >
              <h3 className="font-semibold text-slate-950">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {card.description}
              </p>
            </Link>
          ) : (
            <div
              aria-disabled="true"
              className="min-w-0 cursor-default select-none rounded-md border border-dashed border-slate-300 bg-slate-100/80 p-5 text-slate-500"
              key={card.title}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-700">{card.title}</h3>
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
                  준비 중
                </span>
              </div>
              <p className="mt-2 text-sm leading-6">{card.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                현재 권한에서는 사용할 수 없습니다.
              </p>
            </div>
          ),
        )}
      </div>
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

  const attention = result.data
    ? attentionSummary(result.data.rows, result.data.year)
    : { attentionCount: 0, attentionRows: [], missingCount: 0 };
  const canAccessAdminGenealogy =
    coachStatsResult.data?.roles.some((role) => role.role === "super_admin") ?? false;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
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
          <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
            <PageNavigationButtons className="justify-start sm:justify-end" />
            <Link
              className="inline-flex min-h-10 w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto"
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
              <>
                <TopSummarySection
                  attention={attention}
                  coachStats={coachStatsResult.data}
                />
                <WorkQueueSection
                  attention={attention}
                  coachStats={coachStatsResult.data}
                  year={result.data.year}
                />
              </>
            ) : coachStatsResult.error ? (
              <section className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {coachStatsResult.error.message}
              </section>
            ) : null}

            <QuickCheckSection attention={attention} year={result.data.year} />

            {coachStatsResult.data ? (
              <CoachStatsSection data={coachStatsResult.data} />
            ) : null}

            <MoksilgiSummarySection attention={attention} data={result.data} />
            <QuickLinksSection canAccessAdminGenealogy={canAccessAdminGenealogy} />
            <ActionMemoDrafts
              attentionTargets={attention.attentionRows.map((item) => ({
                region: item.row.region_name,
                targetName: personName(item.row),
                targetUserId: item.row.profile_id,
                teamName: item.row.team_name,
              }))}
            />
          </>
        )}
      </section>
    </main>
  );
}
