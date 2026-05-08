import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getMyMoksilgiMonthly,
  saveMyMoksilgiMonthlyRecord,
  type MoksilgiMonthlyDetailGoal,
  type MoksilgiMonthlyRecord,
  type MoksilgiMonthlySummary,
} from "@/lib/api/my-coaching/moksilgi-monthly";
import type { Json, MoksilgiAreaKey } from "@/types/database";

export const dynamic = "force-dynamic";

const AREA_LABELS: Record<MoksilgiAreaKey, string> = {
  spiritual: "영적 성장",
  intellectual: "지적 성장",
  physical: "육체적 성장",
  social: "사회적 성장",
  other: "기타",
};

const MEASUREMENT_LABELS: Record<string, string> = {
  daily_check: "매일 실행 확인",
  weekly_count: "매주 실행 확인",
  monthly_number: "월간 수치 입력",
  monthly_comment: "COMMENT",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseYearMonth(params: Record<string, string | string[] | undefined>) {
  const today = new Date();
  const year = Number(firstParam(params.year) ?? today.getFullYear());
  const month = Number(firstParam(params.month) ?? today.getMonth() + 1);
  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : today.getFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : today.getMonth() + 1,
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

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return String(value);
  return value.trim().length > 0 ? value : "-";
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
      return "매일 실행 확인 V";
    case "weekly_count":
      return "매주 실행 확인 V";
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

function MonthSelector({ year, month }: { year: number; month: number }) {
  return (
    <form className="mt-5 flex flex-wrap items-end gap-3" method="get">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">연도</span>
        <input
          className="mt-2 w-32 rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={year}
          max={2100}
          min={2000}
          name="year"
          type="number"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">월</span>
        <select
          className="mt-2 w-32 rounded-md border border-slate-300 bg-white px-3 py-2"
          defaultValue={month}
          name="month"
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value}월
            </option>
          ))}
        </select>
      </label>
      <button
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        type="submit"
      >
        조회
      </button>
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
  const selectedMonthLabel = `${month}월`;
  const unitHeader = unitLabel(detailGoal.unit);
  const actionHeader = checkLabel(detailGoal.measurement_type);
  const currentActualDisplay = actualDisplay({
    detailGoal,
    record,
    dailyChecks,
    weeklyCounts,
  });

  return (
    <form action={saveMonthlyRecordAction} className="mt-4 rounded-md border border-slate-200 bg-white p-4">
      <input name="detail_goal_id" type="hidden" value={detailGoal.id} />
      <input name="year" type="hidden" value={year} />
      <input name="month" type="hidden" value={month} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{detailGoal.title}</h3>
          <p className="mt-1 text-sm text-slate-600">
            월 목표량: {displayValue(detailGoal.monthly_target)} / 연간 목표량:{" "}
            {displayValue(detailGoal.annual_target)} / 단위:{" "}
            {displayValue(detailGoal.unit)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            측정 방식: {MEASUREMENT_LABELS[detailGoal.measurement_type]}
          </p>
          {strategies.length > 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              실행전략: {strategies.join(", ")}
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
          현재 달성률 {formatPercent(record?.achievement_rate)}
        </span>
      </div>

      <div className="mt-4 rounded-md border border-slate-200">
        <div className="grid grid-cols-[72px_100px_88px_72px_minmax(0,1fr)] border-b border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
          <div className="border-r border-slate-200 px-3 py-2">월 별</div>
          <div className="border-r border-slate-200 px-3 py-2">{unitHeader}</div>
          <div className="border-r border-slate-200 px-3 py-2">달성률</div>
          <div className="border-r border-slate-200 px-3 py-2">월 별</div>
          <div className="px-3 py-2">{actionHeader}</div>
        </div>
        <div className="grid grid-cols-[72px_100px_88px_72px_minmax(0,1fr)] text-sm">
          <div className="border-r border-slate-200 px-3 py-3 font-medium">
            {selectedMonthLabel}
          </div>
          <div className="border-r border-slate-200 px-3 py-3">
            {detailGoal.measurement_type === "monthly_number" ||
            detailGoal.measurement_type === "monthly_comment" ? (
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1"
                defaultValue={record?.actual_value ?? ""}
                name="actual_value"
                step="any"
                type="number"
              />
            ) : (
              currentActualDisplay
            )}
          </div>
          <div className="border-r border-slate-200 px-3 py-3">
            {formatPercent(record?.achievement_rate)}
          </div>
          <div className="border-r border-slate-200 px-3 py-3 font-medium">
            {selectedMonthLabel}
          </div>
          <div className="px-3 py-3">
            {detailGoal.measurement_type === "daily_check" ? (
              <div className="flex flex-wrap gap-x-3 gap-y-2">
                {Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1).map((day) => (
                  <label className="inline-flex items-center gap-1 whitespace-nowrap" key={day}>
                    <span>{day}</span>
                    <span>(</span>
                    <input
                      aria-label={`${day}일`}
                      defaultChecked={dailyChecks.get(String(day)) ?? false}
                      name={`day_${day}`}
                      type="checkbox"
                    />
                    <span>)</span>
                  </label>
                ))}
              </div>
            ) : null}

            {detailGoal.measurement_type === "weekly_count" ? (
              <div className="grid gap-2 sm:grid-cols-5">
                {[
                  "첫주",
                  "둘째주",
                  "셋째주",
                  "넷째주",
                  "다섯째주",
                ].map((label, index) => (
                  <label className="block" key={label}>
                    <span className="text-xs font-medium text-slate-600">{label}</span>
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
                      defaultValue={weeklyCounts.get(`week${index + 1}`) ?? 0}
                      min={0}
                      name={`week${index + 1}`}
                      step="any"
                      type="number"
                    />
                  </label>
                ))}
              </div>
            ) : null}

            {detailGoal.measurement_type === "monthly_number" ||
            detailGoal.measurement_type === "monthly_comment" ? (
              <textarea
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                defaultValue={record?.comment ?? ""}
                maxLength={2000}
                name="comment"
                rows={3}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            월 목표량 / 현재 목표량 수정
          </span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            defaultValue={record?.target_value ?? detailGoal.monthly_target ?? ""}
            name="target_value"
            step="any"
            type="number"
          />
        </label>
        {detailGoal.measurement_type === "daily_check" ||
        detailGoal.measurement_type === "weekly_count" ? (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">코멘트</span>
            <textarea
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              defaultValue={record?.comment ?? ""}
              maxLength={2000}
              name="comment"
              rows={3}
            />
          </label>
        ) : null}
      </div>

      <button
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        type="submit"
      >
        저장
      </button>
    </form>
  );
}

function summaryValue(
  summary: MoksilgiMonthlySummary | undefined,
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

  return (
    <section className="mt-6 rounded-md border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">월별 요약</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-left text-slate-600">
              <th className="px-3 py-2 font-semibold">월</th>
              <th className="px-3 py-2 font-semibold">영적 성장</th>
              <th className="px-3 py-2 font-semibold">지적 성장</th>
              <th className="px-3 py-2 font-semibold">육체적 성장</th>
              <th className="px-3 py-2 font-semibold">사회적 성장</th>
              <th className="px-3 py-2 font-semibold">기타</th>
              <th className="px-3 py-2 font-semibold">종합</th>
              <th className="px-3 py-2 font-semibold">평균</th>
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
                      ? "border-b border-slate-200 bg-slate-100 font-medium"
                      : "border-b border-slate-100"
                  }
                  key={month}
                >
                  <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
                    {month}월
                    {isSelected ? (
                      <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                        현재 선택
                      </span>
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
            <tr className="bg-slate-950 text-white">
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">누적</th>
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
    </section>
  );
}

export default async function MoksilgiMonthlyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const { year, month } = parseYearMonth(params);
  const result = await getMyMoksilgiMonthly(year, month);
  const saved = firstParam(params.saved) === "1";
  const error = firstParam(params.error) === "save";

  if (!result.ok && result.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Fmoksilgi%2Fmonthly");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              목실기 월별 체크리스트
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              월별 실행 기록과 달성률 자동 계산
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              세부 목표별 실행 상황을 기록하면 달성률이 자동 계산됩니다.
            </p>
            <MonthSelector month={month} year={year} />
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <Link className="font-medium text-slate-700 underline" href="/my-coaching/moksilgi">
              목실기 작성으로 돌아가기
            </Link>
            <Link className="font-medium text-slate-700 underline" href="/my-coaching">
              내 코칭 공간으로 돌아가기
            </Link>
            <Link className="font-medium text-slate-700 underline" href="/dashboard">
              대시보드
            </Link>
          </div>
        </div>

        {!result.ok && result.error.code === "PROFILE_NOT_FOUND" ? (
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            <p className="text-slate-700">아직 프로필이 생성되지 않았습니다.</p>
            <Link className="mt-4 inline-block text-sm font-medium text-slate-700 underline" href="/profile">
              프로필 보기
            </Link>
          </section>
        ) : !result.ok ? (
          <section className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            지금 월별 체크리스트를 불러올 수 없습니다.
          </section>
        ) : !result.data.plan ? (
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            <p className="text-slate-700">먼저 목실기 기본 작성 폼을 저장해 주세요.</p>
            <Link className="mt-4 inline-block text-sm font-medium text-slate-700 underline" href="/my-coaching/moksilgi">
              목실기 작성
            </Link>
          </section>
        ) : result.data.detailGoals.length === 0 ? (
          <section className="mt-8 rounded-md border border-slate-200 bg-white p-6">
            <p className="text-slate-700">먼저 세부 목표와 실행전략을 등록해 주세요.</p>
            <Link className="mt-4 inline-block text-sm font-medium text-slate-700 underline" href="/my-coaching/moksilgi">
              목실기 작성
            </Link>
          </section>
        ) : (
          <div className="mt-8">
            {saved ? (
              <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                저장되었습니다.
              </div>
            ) : null}
            {error ? (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
                저장할 수 없습니다. 입력값을 확인해 주세요.
              </div>
            ) : null}

            <div className="grid gap-5">
              {result.data.areas.map((area) => {
                const areaGoals = result.data.detailGoals.filter(
                  (goal) => goal.area_id === area.id,
                );
                const areaRecords = result.data.records.filter(
                  (record) => record.area_id === area.id,
                );
                const areaAverage =
                  areaGoals.length > 0
                    ? areaGoals.reduce((sum, goal) => {
                        const record = areaRecords.find(
                          (item) => item.detail_goal_id === goal.id,
                        );
                        return sum + Math.min(100, record?.achievement_rate ?? 0);
                      }, 0) / areaGoals.length
                    : 0;

                return (
                  <section className="rounded-md border border-slate-200 bg-slate-50 p-5" key={area.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold">
                          목표 {area.sort_order}: {area.area_title}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {area.area_subtitle}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                        영역 평균 {formatPercent(areaAverage)}
                      </span>
                    </div>

                    {areaGoals.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-600">
                        이 영역에는 세부 목표가 없습니다.
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-4">
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
                  </section>
                );
              })}
            </div>

            <Summary
              selectedMonth={month}
              summaries={result.data.yearlySummaries}
            />
          </div>
        )}
      </section>
    </main>
  );
}
