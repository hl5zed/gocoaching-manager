import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCoacheePageProfile } from "@/lib/api/my-coaching/coachee-page-auth";
import { PrintPageButton } from "@/components/print/PrintPageButton";
import {
  getMyMoksilgiSummary,
  type MoksilgiPersonalSummaryRow,
} from "@/lib/api/my-coaching/moksilgi-summary";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
  resolveTimezoneFallback,
} from "@/lib/timezone";
import type { Tables } from "@/types/database";


type OrganizationTimezoneRow = Pick<Tables<"organizations">, "default_timezone">;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseYear(
  params: Record<string, string | string[] | undefined>,
  timezone: string,
) {
  const defaultYear = getCurrentYearInTimezone(timezone);
  const year = Number(firstParam(params.year) ?? defaultYear);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : defaultYear;
}

function formatPercent(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(1)}%`;
}

function YearSelector({ year }: { year: number }) {
  return (
    <form className="print-hidden flex items-center gap-2" method="get">
      <div className="flex items-center gap-2 rounded-full border border-line-base bg-surface-card px-3 py-1.5">
        <span className="text-xs text-ink-faint">연도</span>
        <input
          className="w-16 bg-transparent text-sm font-medium text-ink-strong focus:outline-none"
          defaultValue={year}
          max={2100}
          min={2000}
          name="year"
          type="number"
        />
      </div>
      <button
        className="rounded-full border border-line-base bg-surface-card px-3 py-1.5 text-sm font-medium text-ink-base hover:bg-surface-sunken"
        type="submit"
      >
        조회
      </button>
    </form>
  );
}

const GOAL_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-slate-400",
] as const;

const GOAL_LABELS = [
  "목표1: 영적",
  "목표2: 지적",
  "목표3: 육체",
  "목표4: 사회",
  "목표5: 기타",
] as const;

type GoalRates = Pick<
  MoksilgiPersonalSummaryRow,
  "spiritual_rate" | "intellectual_rate" | "physical_rate" | "social_rate" | "other_rate"
>;

function getGoalValues(row: GoalRates): [number, number, number, number, number] {
  return [
    typeof row.spiritual_rate === "number" ? row.spiritual_rate : 0,
    typeof row.intellectual_rate === "number" ? row.intellectual_rate : 0,
    typeof row.physical_rate === "number" ? row.physical_rate : 0,
    typeof row.social_rate === "number" ? row.social_rate : 0,
    typeof row.other_rate === "number" ? row.other_rate : 0,
  ];
}

function GoalBars({ dark, row }: { dark?: boolean; row: GoalRates }) {
  const values = getGoalValues(row);
  return (
    <div className="flex flex-col gap-2">
      {GOAL_LABELS.map((label, i) => (
        <div className="flex items-center gap-2" key={label}>
          <span className={`w-20 shrink-0 text-xs ${dark ? "text-white/60" : "text-ink-muted"}`}>
            {label}
          </span>
          <div
            className={`h-1.5 flex-1 overflow-hidden rounded-full ${
              dark ? "bg-white/10" : "border border-line-soft bg-surface-sunken"
            }`}
          >
            <div
              className={`h-full rounded-full ${GOAL_COLORS[i]} ${dark ? "opacity-90" : ""}`}
              style={{ width: `${Math.min(values[i], 100)}%` }}
            />
          </div>
          <span className={`w-9 text-right text-xs font-medium ${dark ? "text-white/90" : "text-ink-strong"}`}>
            {formatPercent(values[i])}
          </span>
        </div>
      ))}
    </div>
  );
}

function HeroCard({
  currentMonth,
  rows,
  totalRate,
  year,
}: {
  currentMonth: number | null;
  rows: MoksilgiPersonalSummaryRow[];
  totalRate: number | null | undefined;
  year: number;
}) {
  const current = currentMonth !== null ? rows.find((r) => r.month === currentMonth) : null;
  const previous =
    currentMonth !== null && currentMonth > 1
      ? rows.find((r) => r.month === currentMonth - 1)
      : null;

  const delta =
    current && previous
      ? Math.round((current.total_rate - previous.total_rate) * 10) / 10
      : null;

  const deltaSign = delta !== null && delta > 0 ? "+" : "";
  const deltaArrow =
    delta !== null ? (delta > 0 ? "▲" : delta < 0 ? "▼" : "–") : null;
  const deltaColor =
    delta === null
      ? ""
      : delta > 0
        ? "text-emerald-300"
        : delta < 0
          ? "text-red-300"
          : "text-white/60";

  return (
    <section className="overflow-hidden rounded-card bg-navy-900 p-5 text-white">
      <p className="text-xs font-medium text-white/60">{year}년 총 달성률</p>
      <p className="mt-1 text-4xl font-semibold">{formatPercent(totalRate)}</p>

      {current ? (
        <>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-xs text-white/60">이번 달({currentMonth}월) 종합 실행률</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-2xl font-semibold">{formatPercent(current.total_rate)}</span>
              {delta !== null && (
                <span className={`text-sm font-medium ${deltaColor}`}>
                  {deltaArrow} {deltaSign}{delta.toFixed(1)}%p
                </span>
              )}
            </div>
            {previous ? (
              <p className="mt-0.5 text-xs text-white/50">
                지난달 {formatPercent(previous.total_rate)} → 이번 달{" "}
                {formatPercent(current.total_rate)}
              </p>
            ) : null}
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs text-white/60">목표별 이번 달 실행률</p>
            <GoalBars dark row={current} />
          </div>
        </>
      ) : null}
    </section>
  );
}

function SummaryRow({
  isCurrentMonth,
  row,
}: {
  isCurrentMonth: boolean;
  row: MoksilgiPersonalSummaryRow;
}) {
  const isCumulative = row.month === "cumulative";

  if (isCumulative) {
    return (
      <tr className="bg-surface-sunken font-medium">
        <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-ink-strong">
          {row.monthLabel}
        </th>
        <td className="px-3 py-2 text-ink-strong">{formatPercent(row.spiritual_rate)}</td>
        <td className="px-3 py-2 text-ink-strong">{formatPercent(row.intellectual_rate)}</td>
        <td className="px-3 py-2 text-ink-strong">{formatPercent(row.physical_rate)}</td>
        <td className="px-3 py-2 text-ink-strong">{formatPercent(row.social_rate)}</td>
        <td className="px-3 py-2 text-ink-strong">{formatPercent(row.other_rate)}</td>
        <td className="px-3 py-2 font-semibold text-brand-600">{formatPercent(row.total_rate)}</td>
        <td className="px-3 py-2 text-ink-strong">{formatPercent(row.average_rate)}</td>
      </tr>
    );
  }

  return (
    <tr
      className={
        isCurrentMonth
          ? "border-b border-line-base bg-blue-50"
          : "border-b border-line-soft"
      }
    >
      <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-ink-strong">
        {row.monthLabel}
        {isCurrentMonth ? (
          <span className="ml-1.5 rounded-full bg-navy-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
            현재
          </span>
        ) : null}
      </th>
      <td className="px-3 py-2 text-ink-base">{formatPercent(row.spiritual_rate)}</td>
      <td className="px-3 py-2 text-ink-base">{formatPercent(row.intellectual_rate)}</td>
      <td className="px-3 py-2 text-ink-base">{formatPercent(row.physical_rate)}</td>
      <td className="px-3 py-2 text-ink-base">{formatPercent(row.social_rate)}</td>
      <td className="px-3 py-2 text-ink-base">{formatPercent(row.other_rate)}</td>
      <td className="px-3 py-2 font-medium text-ink-strong">{formatPercent(row.total_rate)}</td>
      <td className="px-3 py-2 text-ink-base">{formatPercent(row.average_rate)}</td>
    </tr>
  );
}

function AchievementTable({
  cumulativeRow,
  currentMonth,
  rows,
}: {
  cumulativeRow: MoksilgiPersonalSummaryRow;
  currentMonth: number | null;
  rows: MoksilgiPersonalSummaryRow[];
}) {
  return (
    <section className="mt-5 rounded-card border border-line-base bg-surface-card">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <p className="text-sm font-medium text-ink-strong">
          월별 성취표{" "}
          <span className="font-normal text-ink-faint">(연간 대비 · 누적)</span>
        </p>
        <span className="text-xs text-ink-faint">단위: %</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
              <th className="px-3 py-2 font-medium">월</th>
              <th className="px-3 py-2 font-medium">영적</th>
              <th className="px-3 py-2 font-medium">지적</th>
              <th className="px-3 py-2 font-medium">육체</th>
              <th className="px-3 py-2 font-medium">사회</th>
              <th className="px-3 py-2 font-medium">기타</th>
              <th className="px-3 py-2 font-medium">종합</th>
              <th className="px-3 py-2 font-medium">평균</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <SummaryRow
                isCurrentMonth={row.month === currentMonth}
                key={row.month}
                row={row}
              />
            ))}
            <SummaryRow isCurrentMonth={false} row={cumulativeRow} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProfileMissing() {
  return (
    <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
      <p className="text-ink-base">아직 프로필이 생성되지 않았습니다.</p>
      <Link
        className="mt-4 inline-block text-sm font-medium text-brand-600 underline"
        href="/profile"
      >
        프로필 보기
      </Link>
    </section>
  );
}

export default async function MoksilgiSummaryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const auth = await requireCoacheePageProfile("/my-coaching/moksilgi/summary");

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <p className="text-sm text-ink-muted">
          개인 성취표를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </main>
    );
  }

  const profile = auth.profile;
  const { client: serviceClient, error: serviceClientError } = createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[MOKSILGI_SUMMARY_SERVICE_CLIENT_UNAVAILABLE]", serviceClientError);
    return (
      <main className="min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
        <p className="text-sm text-red-700">개인 성취표를 준비할 수 없습니다.</p>
      </main>
    );
  }

  // org timezone 조회는 메인 데이터 fetch와 독립적이므로 병렬로 실행한다.
  // (직렬 await 시 timezone 왕복 후에야 데이터 fetch가 시작되어 워터폴 지연 발생)
  const organizationTimezonePromise =
    profile.organization_id && !profile.timezone
      ? serviceClient
          .from("organizations")
          .select("default_timezone")
          .eq("id", profile.organization_id)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null as OrganizationTimezoneRow | null, error: null });

  // URL 파라미터가 있으면 timezone과 무관하게 year가 확정된다.
  // 우선 prelim timezone(개인 timezone 또는 기본값)으로 파싱해 데이터 fetch를 바로 시작한다.
  const prelimTimezone = resolveTimezoneFallback(profile.timezone, null, null);
  const prelimYear = parseYear(params, prelimTimezone);

  const [organizationResult, result] = await Promise.all([
    organizationTimezonePromise,
    getMyMoksilgiSummary(prelimYear, { profileId: profile.id }),
  ]);

  const organizationTimezone =
    (organizationResult.data as OrganizationTimezoneRow | null)?.default_timezone ?? null;
  const effectiveTimezone = resolveTimezoneFallback(
    profile.timezone,
    organizationTimezone,
    null,
  );
  const year = parseYear(params, effectiveTimezone);
  const currentYear = getCurrentYearInTimezone(effectiveTimezone);
  const currentMonthInTimezone = getCurrentMonthInTimezone(effectiveTimezone);
  const currentMonthForYear = year === currentYear ? currentMonthInTimezone : null;

  // edge case 보정: 개인 timezone 미설정 + year 파라미터 미지정 상태에서
  // 연 경계 등으로 prelim 기본 year와 org timezone 기준 year가 달라지면,
  // 정확한 year로 명시 redirect한다(이후 요청은 파라미터가 있어 재진입 루프 없음).
  if (year !== prelimYear) {
    redirect(`/my-coaching/moksilgi/summary?year=${year}`);
  }

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Fmoksilgi%2Fsummary");
  }

  return (
    <main className="print-root min-h-screen bg-surface-app px-6 py-10 text-ink-strong">
      <section className="mx-auto w-full max-w-4xl">
        <div className="print-report-title print-only">
          <h1>내 목실기 연간 성취 보고서</h1>
          <p>출력 연도: {year}년</p>
          <p>생성일: {new Date().toLocaleDateString("ko-KR")}</p>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-ink-faint">
              목실기 개인 성취표
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink-strong">
              개인 목표와 실행전략 성취표
            </h1>
            <p className="mt-1 text-sm text-ink-muted">목실기 연간 성취 요약</p>
          </div>
          <div className="print-hidden flex items-center gap-3">
            <Link
              className="text-sm font-medium text-brand-600 underline"
              href="/my-coaching/moksilgi"
            >
              ← 목실기 작성으로 돌아가기
            </Link>
            <PrintPageButton
              fileName={`moksilgi-my-summary-${year}`}
              label="출력"
            />
          </div>
        </div>

        <div className="print-hidden mt-4">
          <YearSelector year={year} />
        </div>

        <div className="print-hidden mt-4 rounded-control border border-line-base bg-surface-sunken px-3 py-2.5 text-sm text-ink-muted">
          이 화면은 결과를 보는{" "}
          <span className="font-medium text-ink-base">리포트</span>예요. 매일 실행 체크는{" "}
          <span className="font-medium text-ink-base">체크(월별 체크리스트)</span>에서 하세요.
        </div>

        {!result.ok && result.error.code === "PROFILE_NOT_FOUND" ? (
          <ProfileMissing />
        ) : !result.ok ? (
          <section className="mt-8 rounded-control border border-red-200 bg-red-50 p-4 text-red-800">
            지금 개인 성취표를 불러올 수 없습니다.
          </section>
        ) : !result.data.plan ? (
          <section className="mt-8 rounded-card border border-line-base bg-surface-card p-6">
            <p className="text-ink-base">먼저 목실기 기본 작성 폼을 저장해 주세요.</p>
            <Link
              className="mt-4 inline-block text-sm font-medium text-brand-600 underline"
              href="/my-coaching/moksilgi"
            >
              목실기 작성
            </Link>
          </section>
        ) : (
          <div className="mt-6">
            {!result.data.hasSummaryData ? (
              <div className="mb-4 rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                아직 월별 체크리스트 기록이 없습니다.
              </div>
            ) : null}

            <HeroCard
              currentMonth={currentMonthForYear}
              rows={result.data.rows}
              totalRate={result.data.totalAchievementRate}
              year={year}
            />

            <AchievementTable
              cumulativeRow={result.data.cumulativeRow}
              currentMonth={currentMonthForYear}
              rows={result.data.rows}
            />
          </div>
        )}
      </section>
    </main>
  );
}
