import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireCoacheePageProfile } from "@/lib/api/my-coaching/coachee-page-auth";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MoksilgiMonthlyRecordForm } from "@/components/coachee/MoksilgiMonthlyRecordForm";
import { MoksilgiAreaCard } from "@/components/coachee/MoksilgiAreaCard";
import { MoksilgiAppBar } from "@/components/coachee/MoksilgiSection";
import { PrintPageButton } from "@/components/print/PrintPageButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { I18nText } from "@/lib/i18n/I18nProvider";
import {
  getMyMoksilgiMonthly,
  saveMyMoksilgiMonthlyRecord,
  type MoksilgiMonthlySummary,
} from "@/lib/api/my-coaching/moksilgi-monthly";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
  resolveTimezoneFallback,
} from "@/lib/timezone";
import type { MoksilgiAreaKey } from "@/types/database";


const INPUT_CLASS =
  "mt-1.5 w-full rounded-control border border-line-base bg-surface-card px-3 py-2 text-ink-base outline-none focus:border-brand-600";
const LABEL_CLASS = "text-sm font-medium text-ink-muted";

const AREA_TRANSLATION_KEY_BY_AREA_KEY: Record<
  MoksilgiAreaKey,
  { subtitle: string; title: string }
> = {
  intellectual: {
    subtitle: "myCoaching.moksilgi.goal.intellectual.subtitle",
    title: "myCoaching.moksilgi.goal.intellectual.title",
  },
  other: {
    subtitle: "myCoaching.moksilgi.goal.other.subtitle",
    title: "myCoaching.moksilgi.goal.other.title",
  },
  physical: {
    subtitle: "myCoaching.moksilgi.goal.physical.subtitle",
    title: "myCoaching.moksilgi.goal.physical.title",
  },
  social: {
    subtitle: "myCoaching.moksilgi.goal.social.subtitle",
    title: "myCoaching.moksilgi.goal.social.title",
  },
  spiritual: {
    subtitle: "myCoaching.moksilgi.goal.spiritual.subtitle",
    title: "myCoaching.moksilgi.goal.spiritual.title",
  },
};

const AREA_DOT_CLASS: Record<MoksilgiAreaKey, string> = {
  intellectual: "bg-sky-500",
  other: "bg-ink-faint",
  physical: "bg-brand-600",
  social: "bg-amber-500",
  spiritual: "bg-violet-500",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hasExplicitYearMonth(params: Record<string, string | string[] | undefined>) {
  return firstParam(params.year) !== undefined && firstParam(params.month) !== undefined;
}

function parseExplicitYearMonth(params: Record<string, string | string[] | undefined>) {
  const year = Number(firstParam(params.year));
  const month = Number(firstParam(params.month));
  const defaultYear = new Date().getFullYear();
  const defaultMonth = new Date().getMonth() + 1;

  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : defaultYear,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : defaultMonth,
  };
}

function parseYearMonth(
  params: Record<string, string | string[] | undefined>,
  timezone: string,
) {
  const defaultYear = getCurrentYearInTimezone(timezone);
  const defaultMonth = getCurrentMonthInTimezone(timezone);
  const year = Number(firstParam(params.year) ?? defaultYear);
  const month = Number(firstParam(params.month) ?? defaultMonth);
  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : defaultYear,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : defaultMonth,
  };
}

function formatPercent(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${numeric.toFixed(1)}%`;
}

function rateTone(value: number | null | undefined): "success" | "info" | "warning" {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (numeric >= 80) return "success";
  if (numeric >= 50) return "info";
  return "warning";
}

function MonthLabel({ month }: { month: number }) {
  return (
    <>
      <I18nText k="myCoaching.moksilgi.monthly.monthOptionPrefix" fallback="" />
      {month}
      <I18nText k="myCoaching.moksilgi.monthly.monthOptionSuffix" fallback="월" />
    </>
  );
}

async function saveMonthlyRecordAction(formData: FormData) {
  "use server";

  const result = await saveMyMoksilgiMonthlyRecord(formData);
  const year = String(formData.get("year") ?? "");
  const month = String(formData.get("month") ?? "");
  const base = `/my-coaching/moksilgi/monthly?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;

  if (!result.ok) {
    redirect(`${base}&error=save`);
  }

  redirect(`${base}&saved=1`);
}

function MonthSelector({ year, month }: { year: number; month: number }) {
  return (
    <form className="print-hidden mt-4 flex flex-wrap items-end gap-2" method="get">
      <label className="block">
        <span className={LABEL_CLASS}>
          <I18nText k="myCoaching.moksilgi.monthly.year" fallback="연도" />
        </span>
        <input
          className={`${INPUT_CLASS} w-28`}
          defaultValue={year}
          max={2100}
          min={2000}
          name="year"
          type="number"
        />
      </label>
      <label className="block">
        <span className={LABEL_CLASS}>
          <I18nText k="myCoaching.moksilgi.monthly.month" fallback="월" />
        </span>
        <select className={`${INPUT_CLASS} w-28`} defaultValue={month} name="month">
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              <MonthLabel month={value} />
            </option>
          ))}
        </select>
      </label>
      <Button icon="search" type="submit" variant="primary">
        <I18nText k="myCoaching.moksilgi.monthly.search" fallback="조회" />
      </Button>
    </form>
  );
}

const AREA_RATE_KEY: Record<
  MoksilgiAreaKey,
  | "spiritual_rate"
  | "intellectual_rate"
  | "physical_rate"
  | "social_rate"
  | "other_rate"
> = {
  spiritual: "spiritual_rate",
  intellectual: "intellectual_rate",
  physical: "physical_rate",
  social: "social_rate",
  other: "other_rate",
};

function summaryValue(
  summary: MoksilgiMonthlySummary | undefined | null,
  key:
    | "spiritual_rate"
    | "intellectual_rate"
    | "physical_rate"
    | "social_rate"
    | "other_rate"
    | "total_rate"
    | "average_rate",
) {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function areaRateFromSummary(
  areaKey: MoksilgiAreaKey,
  summary: MoksilgiMonthlySummary | null,
) {
  if (!summary) {
    return 0;
  }

  return summaryValue(summary, AREA_RATE_KEY[areaKey]);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function Summary({
  summaries,
  selectedMonth,
}: {
  summaries: MoksilgiMonthlySummary[];
  selectedMonth: number;
}) {
  const summaryByMonth = new Map(summaries.map((summary) => [summary.month, summary]));
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  const cumulative = {
    spiritual_rate: average(months.map((month) => summaryValue(summaryByMonth.get(month), "spiritual_rate"))),
    intellectual_rate: average(months.map((month) => summaryValue(summaryByMonth.get(month), "intellectual_rate"))),
    physical_rate: average(months.map((month) => summaryValue(summaryByMonth.get(month), "physical_rate"))),
    social_rate: average(months.map((month) => summaryValue(summaryByMonth.get(month), "social_rate"))),
    other_rate: average(months.map((month) => summaryValue(summaryByMonth.get(month), "other_rate"))),
    total_rate: average(months.map((month) => summaryValue(summaryByMonth.get(month), "total_rate"))),
    average_rate: average(months.map((month) => summaryValue(summaryByMonth.get(month), "average_rate"))),
  };

  const headerCols: Array<{ key: MoksilgiAreaKey; labelKey: string; fallback: string }> = [
    { key: "spiritual", labelKey: "myCoaching.moksilgi.goal.spiritual.title", fallback: "목표 1: 영적 성장" },
    { key: "intellectual", labelKey: "myCoaching.moksilgi.goal.intellectual.title", fallback: "목표 2: 지적 성장" },
    { key: "physical", labelKey: "myCoaching.moksilgi.goal.physical.title", fallback: "목표 3: 육체적 성장" },
    { key: "social", labelKey: "myCoaching.moksilgi.goal.social.title", fallback: "목표 4: 사회적 성장" },
    { key: "other", labelKey: "myCoaching.moksilgi.goal.other.title", fallback: "목표 5: 기타" },
  ];

  return (
    <Card className="border-line-base bg-surface-card">
      <CardContent className="p-4">
        <h2 className="text-base font-semibold text-ink-strong">
          <I18nText k="myCoaching.moksilgi.monthly.summaryTitle" fallback="월별 요약" />
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[680px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-base text-left text-ink-muted">
                <th className="px-3 py-2 font-medium">
                  <I18nText k="myCoaching.moksilgi.monthly.month" fallback="월" />
                </th>
                {headerCols.map((col) => (
                  <th className="px-3 py-2 font-medium" key={col.key}>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={`h-2 w-2 shrink-0 rounded-full ${AREA_DOT_CLASS[col.key]}`}
                      />
                      <I18nText k={col.labelKey} fallback={col.fallback} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">
                  <I18nText k="myCoaching.moksilgi.monthly.total" fallback="종합" />
                </th>
                <th className="px-3 py-2 font-medium">
                  <I18nText k="myCoaching.moksilgi.monthly.average" fallback="평균" />
                </th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const summary = summaryByMonth.get(month);
                const isSelected = month === selectedMonth;

                return (
                  <tr
                    className={
                      isSelected
                        ? "border-b border-line-soft bg-brand-50 font-medium text-ink-strong"
                        : "border-b border-line-soft text-ink-base"
                    }
                    key={month}
                  >
                    <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
                      <MonthLabel month={month} />
                      {isSelected ? (
                        <Badge className="ml-2" tone="success">
                          <I18nText k="myCoaching.moksilgi.monthly.currentSelection" fallback="현재 선택" />
                        </Badge>
                      ) : null}
                    </th>
                    <td className="px-3 py-2">{formatPercent(summaryValue(summary, "spiritual_rate"))}</td>
                    <td className="px-3 py-2">{formatPercent(summaryValue(summary, "intellectual_rate"))}</td>
                    <td className="px-3 py-2">{formatPercent(summaryValue(summary, "physical_rate"))}</td>
                    <td className="px-3 py-2">{formatPercent(summaryValue(summary, "social_rate"))}</td>
                    <td className="px-3 py-2">{formatPercent(summaryValue(summary, "other_rate"))}</td>
                    <td className="px-3 py-2">{formatPercent(summaryValue(summary, "total_rate"))}</td>
                    <td className="px-3 py-2">{formatPercent(summaryValue(summary, "average_rate"))}</td>
                  </tr>
                );
              })}
              <tr className="bg-navy-900 text-white">
                <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                  <I18nText k="myCoaching.moksilgi.monthly.cumulative" fallback="누적" />
                </th>
                <td className="px-3 py-2">{formatPercent(cumulative.spiritual_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulative.intellectual_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulative.physical_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulative.social_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulative.other_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulative.total_rate)}</td>
                <td className="px-3 py-2">{formatPercent(cumulative.average_rate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function MoksilgiMonthlyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};

  // Supabase 클라이언트를 먼저 생성하고, 미들웨어가 설정한 profile ID 헤더를 읽어
  // auth(profile 전체) 조회와 moksilgi plan 조회를 병렬로 시작합니다.
  // /my-coaching 경로는 미들웨어 "profile" 요건 대상이므로 PROFILE_ID_HEADER가 보장됩니다.
  const [supabase, verifiedProfileId] = await Promise.all([
    createSupabaseServerClient(),
    getVerifiedProfileId(),
  ]);

  const [auth, preloadedPlanResult] = await Promise.all([
    requireCoacheePageProfile("/my-coaching/moksilgi/monthly"),
    verifiedProfileId
      ? supabase
          .from("moksilgi_plans")
          .select("id, profile_id, title")
          .eq("profile_id", verifiedProfileId)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card>
          <CardContent className="p-4 text-sm text-ink-muted">
            월별 목실기를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.
          </CardContent>
        </Card>
      </main>
    );
  }

  const profile = auth.profile;

  let year: number;
  let month: number;

  if (hasExplicitYearMonth(params)) {
    ({ year, month } = parseExplicitYearMonth(params));
  } else {
    // 소속 조직 기본 타임존은 requireCoacheePageProfile의 profile 조회 시
    // FK 조인으로 함께 가져오므로 별도 organizations 왕복이 필요 없습니다.
    const effectiveTimezone = resolveTimezoneFallback(
      profile.timezone,
      profile.organization_default_timezone,
      null,
    );
    ({ year, month } = parseYearMonth(params, effectiveTimezone));
  }

  // preloadedPlan은 verifiedProfileId로 조회한 결과가 "성공적으로 확정"된 경우에만 신뢰한다.
  // - verifiedProfileId가 null(미들웨어 profile 헤더 부재)이면 preload 쿼리를 건너뛰어 data가 null이고,
  //   error도 일시적으로 발생할 수 있다. 이때 null을 확정값으로 넘기면 plan이 실제로 있어도
  //   "목실기 없음"으로 잘못 판정되어 데이터가 사라진다.
  // - 따라서 신뢰 불가한 경우 undefined를 넘겨 getMyMoksilgiMonthly의 자체 조회(에러 처리 포함)로 fallback한다.
  const trustedPreloadedPlan =
    verifiedProfileId && !preloadedPlanResult.error
      ? preloadedPlanResult.data
      : undefined;

  const result = await getMyMoksilgiMonthly(year, month, {
    profileId: profile.id,
    serviceClient: supabase,
    preloadedPlan: trustedPreloadedPlan,
  });
  const saved = firstParam(params.saved) === "1";
  const error = firstParam(params.error) === "save";

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Fmoksilgi%2Fmonthly");
  }

  const hasData = result.ok && Boolean(result.data.plan) && result.data.detailGoals.length > 0;
  const monthSummary = result.ok ? result.data.summary : null;

  const areaStats = hasData
    ? result.data.areas.map((area) => {
        const areaGoals = result.data.detailGoals.filter((goal) => goal.area_id === area.id);
        const areaRecords = result.data.records.filter((record) => record.area_id === area.id);
        return {
          area,
          areaGoals,
          areaAverage: areaRateFromSummary(area.area_key, monthSummary),
          hasRecords: areaRecords.length > 0,
        };
      })
    : [];

  const recordedAreas = areaStats.filter((stat) => stat.hasRecords).length;
  const monthAverage = summaryValue(monthSummary, "average_rate");

  return (
    <main className="print-root min-h-screen bg-surface-app px-4 py-5 pb-32 text-ink-base">
      <div className="print-report-title print-only">
        <h1>
          <I18nText k="myCoaching.moksilgi.monthly.reportTitle" fallback="월별 목실기 기록 보고서" />
        </h1>
        <p>
          <I18nText k="myCoaching.moksilgi.monthly.printPeriod" fallback="출력 기간" />: {year}
          <I18nText k="myCoaching.moksilgi.monthly.yearSuffix" fallback="년" />{" "}
          <MonthLabel month={month} />
        </p>
        <p>
          <I18nText k="myCoaching.moksilgi.generatedAt" fallback="생성일" />:{" "}
          {new Date().toLocaleDateString("ko-KR")}
        </p>
      </div>

      <MoksilgiAppBar
        actions={
          <>
            <div className="print:hidden">
              <LanguageSwitcher />
            </div>
            <PrintPageButton
              fileName={`moksilgi-monthly-record-${year}-${String(month).padStart(2, "0")}`}
              label={
                (
                  <I18nText k="myCoaching.moksilgi.monthly.print" fallback="월별 목실기 출력" />
                ) as unknown as string
              }
            />
          </>
        }
      />

      <section className="mx-auto w-full max-w-md space-y-4">
        <div className="pt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
            <I18nText k="myCoaching.moksilgi.monthly.title" fallback="목실기 월별 체크리스트" />
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink-strong">
            <I18nText
              k="myCoaching.moksilgi.monthly.subtitle"
              fallback="월별 실행 기록과 달성률 자동 계산"
            />
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            <I18nText
              k="myCoaching.moksilgi.monthly.description"
              fallback="세부 목표별 실행 상황을 기록하면 달성률이 자동 계산됩니다."
            />
          </p>
          <p className="mt-3 rounded-control border border-line-soft bg-surface-sunken px-3 py-2 text-xs leading-5 text-ink-muted">
            여기는 <span className="font-semibold text-ink-base">매일·매주 실행을 체크하는 곳</span>이에요. 한 달 전체 결과와 성취표는 <span className="font-semibold text-ink-base">리포트</span>에서 볼 수 있어요.
          </p>
          <MonthSelector month={month} year={year} />
          <div className="print:hidden mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            <Link className="font-medium text-ink-muted hover:text-brand-600" href="/my-coaching/moksilgi">
              <I18nText k="myCoaching.moksilgi.monthly.backToMoksilgi" fallback="목실기 작성으로 돌아가기" />
            </Link>
          </div>
        </div>

        {saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <I18nText k="myCoaching.moksilgi.saved" fallback="저장되었습니다." />
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <I18nText
              k="myCoaching.moksilgi.saveFailed"
              fallback="저장할 수 없습니다. 입력값을 확인해 주세요."
            />
          </div>
        ) : null}

        {!result.ok && result.error.code === "PROFILE_NOT_FOUND" ? (
          <Card className="border-line-base bg-surface-card">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-ink-base">
                <I18nText k="dashboard.noProfile" fallback="아직 프로필이 생성되지 않았습니다." />
              </p>
              <Link className="text-sm font-medium text-brand-600 hover:underline" href="/profile">
                <I18nText k="myCoaching.viewProfile" fallback="프로필 보기" />
              </Link>
            </CardContent>
          </Card>
        ) : !result.ok ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <I18nText
              k="myCoaching.moksilgi.monthly.loadFailed"
              fallback="지금 월별 체크리스트를 불러올 수 없습니다."
            />
          </div>
        ) : !result.data.plan ? (
          <Card className="border-line-base bg-surface-card">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-ink-base">
                <I18nText
                  k="myCoaching.moksilgi.monthly.needBasicForm"
                  fallback="먼저 목실기 기본 작성 폼을 저장해 주세요."
                />
              </p>
              <Link className="text-sm font-medium text-brand-600 hover:underline" href="/my-coaching/moksilgi">
                <I18nText k="myCoaching.moksilgi.monthly.writeMoksilgi" fallback="목실기 작성" />
              </Link>
            </CardContent>
          </Card>
        ) : result.data.detailGoals.length === 0 ? (
          <Card className="border-line-base bg-surface-card">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-ink-base">
                <I18nText
                  k="myCoaching.moksilgi.monthly.needDetailGoals"
                  fallback="먼저 세부 목표와 실행전략을 등록해 주세요."
                />
              </p>
              <Link className="text-sm font-medium text-brand-600 hover:underline" href="/my-coaching/moksilgi">
                <I18nText k="myCoaching.moksilgi.monthly.writeMoksilgi" fallback="목실기 작성" />
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-line-base bg-surface-card">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="relative h-20 w-20 shrink-0">
                  <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      className="stroke-surface-sunken"
                      cx="18"
                      cy="18"
                      fill="none"
                      r="15.9155"
                      strokeWidth="3.4"
                    />
                    <circle
                      className="stroke-brand-600"
                      cx="18"
                      cy="18"
                      fill="none"
                      r="15.9155"
                      strokeLinecap="round"
                      strokeWidth="3.4"
                      style={{ strokeDasharray: `${Math.min(100, Math.max(0, monthAverage))} 100` }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-semibold text-ink-strong">
                      {Math.round(monthAverage)}%
                    </span>
                    <span className="text-[10px] text-ink-muted">
                      <I18nText k="myCoaching.moksilgi.monthly.average" fallback="평균" />
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-muted">
                    {year}
                    <I18nText k="myCoaching.moksilgi.monthly.yearSuffix" fallback="년" />{" "}
                    <MonthLabel month={month} />
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink-base">
                    {recordedAreas} / {areaStats.length}{" "}
                    <I18nText k="myCoaching.moksilgi.monthly.areaAverage" fallback="영역 평균" />
                  </p>
                  <div className="mt-2">
                    <ProgressBar showValue={false} value={monthAverage} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {areaStats.map(({ area, areaGoals, areaAverage }) => (
                <MoksilgiAreaCard
                  areaKey={area.area_key}
                  areaSubtitle={
                    <I18nText
                      k={AREA_TRANSLATION_KEY_BY_AREA_KEY[area.area_key].subtitle}
                      fallback={area.area_subtitle ?? ""}
                    />
                  }
                  areaTitle={
                    <I18nText
                      k={AREA_TRANSLATION_KEY_BY_AREA_KEY[area.area_key].title}
                      fallback={`목표 ${area.sort_order}: ${area.area_title}`}
                    />
                  }
                  detailGoalCount={areaGoals.length}
                  key={area.id}
                  trailing={
                    <Badge tone={rateTone(areaAverage)}>
                      <I18nText k="myCoaching.moksilgi.monthly.areaAverage" fallback="영역 평균" />{" "}
                      {formatPercent(areaAverage)}
                    </Badge>
                  }
                >
                  {areaGoals.length === 0 ? (
                    <p className="text-sm text-ink-muted">
                      <I18nText
                        k="myCoaching.moksilgi.monthly.noAreaDetailGoals"
                        fallback="이 영역에는 세부 목표가 없습니다."
                      />
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {areaGoals.map((goal) => (
                        <MoksilgiMonthlyRecordForm
                          action={saveMonthlyRecordAction}
                          detailGoal={goal}
                          key={goal.id}
                          month={month}
                          record={result.data.records.find(
                            (record) => record.detail_goal_id === goal.id,
                          )}
                          year={year}
                        />
                      ))}
                    </div>
                  )}
                </MoksilgiAreaCard>
              ))}
            </div>

            <Summary selectedMonth={month} summaries={result.data.yearlySummaries} />
          </>
        )}
      </section>
    </main>
  );
}
