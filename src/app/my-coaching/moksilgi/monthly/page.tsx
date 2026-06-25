import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireCoacheePageProfile } from "@/lib/api/my-coaching/coachee-page-auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
  type MoksilgiMonthlyDetailGoal,
  type MoksilgiMonthlyRecord,
  type MoksilgiMonthlySummary,
} from "@/lib/api/my-coaching/moksilgi-monthly";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
  resolveTimezoneFallback,
} from "@/lib/timezone";
import type { Json, MoksilgiAreaKey, Tables } from "@/types/database";


type OrganizationTimezoneRow = Pick<Tables<"organizations">, "default_timezone">;

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

function asObject(value: Json): Record<string, Json> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, Json> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      result[key] = item;
    }
  }
  return result;
}

function boolMap(value: Json) {
  const object = asObject(value);
  const result = new Map<string, boolean>();
  for (const [key, item] of Object.entries(object)) {
    result.set(key, item === true);
  }
  return result;
}

function numberMap(value: Json) {
  const object = asObject(value);
  const result = new Map<string, number>();
  for (const [key, item] of Object.entries(object)) {
    result.set(key, typeof item === "number" ? item : 0);
  }
  return result;
}

function strategyList(value: Json) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
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

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return String(value);
  return value.trim().length > 0 ? value : "-";
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

function MeasurementLabel({ type }: { type: string }) {
  switch (type) {
    case "daily_check":
      return <I18nText k="myCoaching.moksilgi.measurement.dailyCheck" fallback="매일 실행 확인" />;
    case "weekly_count":
      return <I18nText k="myCoaching.moksilgi.measurement.weeklyCount" fallback="매주 실행 확인" />;
    case "monthly_number":
      return <I18nText k="myCoaching.moksilgi.measurement.monthlyNumber" fallback="월간 수치 입력" />;
    case "monthly_comment":
      return <I18nText k="myCoaching.moksilgi.measurement.monthlyComment" fallback="COMMENT" />;
    default:
      return type;
  }
}

function unitLabel(unit: string | null) {
  const normalized = unit?.trim();

  if (!normalized) return "실행량";
  if (normalized === "일") return "일 수";
  if (normalized === "권") return "권 수";
  if (normalized === "회" || normalized === "번") return "횟 수";
  if (normalized === "시간") return "시간";
  if (normalized === "명") return "명 수";
  return normalized;
}

function checkLabel(measurementType: string) {
  switch (measurementType) {
    case "daily_check":
      return <I18nText k="myCoaching.moksilgi.monthly.dailyCheckHeader" fallback="매일 실행 확인 V" />;
    case "weekly_count":
      return <I18nText k="myCoaching.moksilgi.monthly.weeklyCheckHeader" fallback="매주 실행 확인 V" />;
    case "monthly_number":
    case "monthly_comment":
      return "COMMENT";
    default:
      return "COMMENT";
  }
}

function actualDisplay({
  detailGoal,
  record,
  dailyChecks,
  weeklyCounts,
}: {
  detailGoal: MoksilgiMonthlyDetailGoal;
  record: MoksilgiMonthlyRecord | undefined;
  dailyChecks: Map<string, boolean>;
  weeklyCounts: Map<string, number>;
}) {
  const unit = detailGoal.unit?.trim() ?? "";

  if (detailGoal.measurement_type === "daily_check") {
    const checkedCount = [...dailyChecks.values()].filter(Boolean).length;
    return `${checkedCount}${unit || "일"}`;
  }

  if (detailGoal.measurement_type === "weekly_count") {
    const total = [...weeklyCounts.values()].reduce((sum, value) => sum + value, 0);
    return `${total}${unit || "회"}`;
  }

  if (record?.actual_value !== null && record?.actual_value !== undefined) {
    return `${record.actual_value}${unit ? unit : ""}`;
  }

  return "-";
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

function StatChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-control bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-base">
      {children}
    </span>
  );
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

function MonthlyRecordForm({
  detailGoal,
  record,
  year,
  month,
}: {
  detailGoal: MoksilgiMonthlyDetailGoal;
  record: MoksilgiMonthlyRecord | undefined;
  year: number;
  month: number;
}) {
  const dailyChecks = boolMap(record?.daily_checks_json ?? {});
  const weeklyCounts = numberMap(record?.weekly_counts_json ?? {});
  const strategies = strategyList(detailGoal.strategies_json);
  const unitHeader = unitLabel(detailGoal.unit);
  const actionHeader = checkLabel(detailGoal.measurement_type);
  const totalDays = daysInMonth(year, month);
  const checkedDays = [...dailyChecks.values()].filter(Boolean).length;
  const currentActualDisplay = actualDisplay({
    detailGoal,
    record,
    dailyChecks,
    weeklyCounts,
  });
  const isMonthly =
    detailGoal.measurement_type === "monthly_number" ||
    detailGoal.measurement_type === "monthly_comment";

  return (
    <form
      action={saveMonthlyRecordAction}
      className="space-y-4 rounded-xl border border-line-base bg-surface-app p-4"
    >
      <input name="detail_goal_id" type="hidden" value={detailGoal.id} />
      <input name="year" type="hidden" value={year} />
      <input name="month" type="hidden" value={month} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-ink-strong">{detailGoal.title}</h4>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            <I18nText k="myCoaching.moksilgi.detailGoal.monthlyTarget" fallback="월 목표량" />:{" "}
            {displayValue(detailGoal.monthly_target)} ·{" "}
            <I18nText k="myCoaching.moksilgi.detailGoal.yearlyTarget" fallback="연간 목표량" />:{" "}
            {displayValue(detailGoal.annual_target)} ·{" "}
            <I18nText k="myCoaching.moksilgi.detailGoal.unit" fallback="단위" />:{" "}
            {displayValue(detailGoal.unit)}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-ink-muted">
            <I18nText k="myCoaching.moksilgi.detailGoal.measurementMethod" fallback="측정 방식" />:{" "}
            <MeasurementLabel type={detailGoal.measurement_type} />
          </p>
          {strategies.length > 0 ? (
            <p className="mt-0.5 text-xs leading-5 text-ink-muted">
              <I18nText k="myCoaching.moksilgi.monthly.actionStrategies" fallback="실행전략" />:{" "}
              {strategies.join(", ")}
            </p>
          ) : null}
        </div>
        <Badge tone={rateTone(record?.achievement_rate)}>
          <I18nText k="myCoaching.moksilgi.monthly.currentAchievement" fallback="현재 달성률" />{" "}
          {formatPercent(record?.achievement_rate)}
        </Badge>
      </div>

      {detailGoal.measurement_type === "daily_check" ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">{actionHeader}</span>
            <span className="text-xs font-semibold text-brand-600">
              {checkedDays} / {totalDays}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: totalDays }, (_, index) => index + 1).map((day) => (
              <label className="relative block" key={day}>
                <input
                  aria-label={`${day}일`}
                  className="peer sr-only"
                  defaultChecked={dailyChecks.get(String(day)) ?? false}
                  name={`day_${day}`}
                  type="checkbox"
                />
                <span className="flex h-9 items-center justify-center rounded-control border border-line-base bg-surface-card text-xs text-ink-muted transition-colors peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:font-medium peer-checked:text-white">
                  {day}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {detailGoal.measurement_type === "weekly_count" ? (
        <div>
          <span className="text-xs font-medium text-ink-muted">{actionHeader}</span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { fallback: "첫주", key: "myCoaching.moksilgi.monthly.week1" },
              { fallback: "둘째주", key: "myCoaching.moksilgi.monthly.week2" },
              { fallback: "셋째주", key: "myCoaching.moksilgi.monthly.week3" },
              { fallback: "넷째주", key: "myCoaching.moksilgi.monthly.week4" },
              { fallback: "다섯째주", key: "myCoaching.moksilgi.monthly.week5" },
            ].map((label, index) => (
              <label className="block" key={label.key}>
                <span className="text-xs font-medium text-ink-muted">
                  <I18nText k={label.key} fallback={label.fallback} />
                </span>
                <input
                  className={INPUT_CLASS}
                  defaultValue={weeklyCounts.get(`week${index + 1}`) ?? 0}
                  min={0}
                  name={`week${index + 1}`}
                  step="any"
                  type="number"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {isMonthly ? (
        <div className="grid gap-3">
          <label className="block">
            <span className={LABEL_CLASS}>{unitHeader}</span>
            <input
              className={INPUT_CLASS}
              defaultValue={record?.actual_value ?? ""}
              name="actual_value"
              step="any"
              type="number"
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>
              <I18nText k="myCoaching.moksilgi.monthly.comment" fallback="코멘트" />
            </span>
            <textarea
              className={INPUT_CLASS}
              defaultValue={record?.comment ?? ""}
              maxLength={2000}
              name="comment"
              rows={3}
            />
          </label>
        </div>
      ) : null}

      {!isMonthly ? (
        <div className="flex flex-wrap gap-2">
          <StatChip>
            {unitHeader}: {currentActualDisplay}
          </StatChip>
          <StatChip>
            <I18nText k="myCoaching.moksilgi.monthly.achievementRate" fallback="달성률" />{" "}
            {formatPercent(record?.achievement_rate)}
          </StatChip>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL_CLASS}>
            <I18nText
              k="myCoaching.moksilgi.monthly.targetValue"
              fallback="월 목표량 / 현재 목표량 수정"
            />
          </span>
          <input
            className={INPUT_CLASS}
            defaultValue={record?.target_value ?? detailGoal.monthly_target ?? ""}
            name="target_value"
            step="any"
            type="number"
          />
        </label>
        {!isMonthly ? (
          <label className="block">
            <span className={LABEL_CLASS}>
              <I18nText k="myCoaching.moksilgi.monthly.comment" fallback="코멘트" />
            </span>
            <textarea
              className={INPUT_CLASS}
              defaultValue={record?.comment ?? ""}
              maxLength={2000}
              name="comment"
              rows={3}
            />
          </label>
        ) : null}
      </div>

      <Button icon="save" type="submit" variant="primary">
        <I18nText k="myCoaching.moksilgi.monthly.save" fallback="저장" />
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
  const auth = await requireCoacheePageProfile("/my-coaching/moksilgi/monthly");

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
  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[MOKSILGI_MONTHLY_SERVICE_CLIENT_UNAVAILABLE]", serviceClientError);
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            월별 목실기를 준비할 수 없습니다.
          </CardContent>
        </Card>
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

  // URL 파라미터가 있으면 timezone과 무관하게 year/month가 확정된다.
  // 우선 prelim timezone(개인 timezone 또는 기본값)으로 파싱해 데이터 fetch를 바로 시작한다.
  const prelimTimezone = resolveTimezoneFallback(profile.timezone, null, null);
  const { year: prelimYear, month: prelimMonth } = parseYearMonth(params, prelimTimezone);

  const [organizationResult, result] = await Promise.all([
    organizationTimezonePromise,
    getMyMoksilgiMonthly(prelimYear, prelimMonth, { profileId: profile.id }),
  ]);

  const organizationTimezone =
    (organizationResult.data as OrganizationTimezoneRow | null)?.default_timezone ?? null;
  const effectiveTimezone = resolveTimezoneFallback(
    profile.timezone,
    organizationTimezone,
    null,
  );
  const { year, month } = parseYearMonth(params, effectiveTimezone);

  // edge case 보정: 개인 timezone 미설정 + year/month 파라미터 미지정 상태에서
  // 월 경계 등으로 prelim 기본 month와 org timezone 기준 month가 달라지면,
  // 정확한 month로 명시 redirect한다(이후 요청은 파라미터가 있어 재진입 루프 없음).
  if (year !== prelimYear || month !== prelimMonth) {
    redirect(`/my-coaching/moksilgi/monthly?year=${year}&month=${month}`);
  }
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
                        <MonthlyRecordForm
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
