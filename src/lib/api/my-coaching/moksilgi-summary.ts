import {
  buildMoksilgiCumulativeRow,
  buildMoksilgiMonthlyRatesFromRecords,
  buildMoksilgiMonthRows,
  calculateCoachingDurationMonths,
  calculateCurrentAchievementRate,
  computeMoksilgiGoalFlatOverallAnnual,
  isCountableMeasurementType,
  MOKSILGI_AREA_KEYS,
  resolveActiveAreaKeys,
  type MoksilgiYearSummaryRow,
} from "@/lib/coaching/moksilgi-year-summary";
import { getMoksilgiContext, type ServiceClient } from "./context";
import type { Tables } from "@/types/database";

type SafeError = {
  code:
    | "UNAUTHORIZED"
    | "PROFILE_NOT_FOUND"
    | "PROFILE_QUERY_FAILED"
    | "MOKSILGI_QUERY_FAILED"
    | "VALIDATION_FAILED";
  message: string;
};
type PlanRow = Pick<
  Tables<"moksilgi_plans">,
  "id" | "profile_id" | "title" | "period_start" | "period_end"
>;
type SummaryRow = Pick<
  Tables<"moksilgi_monthly_summaries">,
  | "id"
  | "plan_id"
  | "profile_id"
  | "year"
  | "month"
  | "spiritual_rate"
  | "intellectual_rate"
  | "physical_rate"
  | "social_rate"
  | "other_rate"
  | "total_rate"
  | "average_rate"
>;
type DetailGoalAreaRow = Pick<Tables<"moksilgi_goal_areas">, "id" | "area_key"> & {
  moksilgi_detail_goals: Array<
    Pick<Tables<"moksilgi_detail_goals">, "id" | "measurement_type" | "annual_target">
  >;
};
type MonthlyRecordRateRow = Pick<
  Tables<"moksilgi_monthly_records">,
  "detail_goal_id" | "month" | "achievement_rate" | "actual_value"
>;

export type MoksilgiPersonalSummaryRow = MoksilgiYearSummaryRow & {
  /** 종합(목표 평균): 측정 목표별 달성률 합 ÷ 측정 목표 수 */
  overallRate: number;
  /** 현재 달성률: monthly 페이지와 동일하게 종합과 같은 값(월별 행=그 달 종합, 누적 행=누적 종합) */
  currentRate: number;
};

export type MoksilgiPersonalSummaryResult =
  | {
      ok: true;
      data: {
        plan: PlanRow | null;
        rows: MoksilgiPersonalSummaryRow[];
        cumulativeRow: MoksilgiPersonalSummaryRow;
        totalAchievementRate: number;
        durationMonths: number;
        hasSummaryData: boolean;
        year: number;
      };
    }
  | { ok: false; error: SafeError };

/** 코칭 기간 미설정 시 사용하는 기본 개월 수 */
const DEFAULT_DURATION_MONTHS = 12;

function sumValues(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * 영역별 row에 목표 평균 종합·현재 달성률을 덧붙인다.
 * 현재 달성률 = 종합 ÷ 코칭기간 개월수 — 코치/코치메이커 상세 화면
 * (getCoachMoksilgiDetail, getCoachMakerMoksilgiProgressDetail)과 동일한
 * calculateCurrentAchievementRate를 사용해, 코치이 본인이 보는 값과
 * 코치가 보는 같은 데이터의 값이 어긋나지 않게 한다.
 * 누적 행의 영역별 퍼센트는 평균이 아닌 월별 값의 합으로 계산한다(연간 기준 B안).
 */
function decorateSummaryRows(
  rows: MoksilgiYearSummaryRow[],
  cumulativeRow: MoksilgiYearSummaryRow,
  overallByMonth: Map<number, number>,
  cumulativeOverall: number,
  durationMonths: number,
): {
  rows: MoksilgiPersonalSummaryRow[];
  cumulativeRow: MoksilgiPersonalSummaryRow;
} {
  const decoratedRows = rows.map((row) => {
    const overallRate =
      typeof row.month === "number" ? overallByMonth.get(row.month) ?? 0 : 0;
    return {
      ...row,
      overallRate,
      currentRate: calculateCurrentAchievementRate(overallRate, durationMonths),
    };
  });

  const cumulativeAreaSums = {
    spiritual_rate: sumValues(rows.map((row) => row.spiritual_rate)),
    intellectual_rate: sumValues(rows.map((row) => row.intellectual_rate)),
    physical_rate: sumValues(rows.map((row) => row.physical_rate)),
    social_rate: sumValues(rows.map((row) => row.social_rate)),
    other_rate: sumValues(rows.map((row) => row.other_rate)),
  };

  return {
    rows: decoratedRows,
    cumulativeRow: {
      ...cumulativeRow,
      ...cumulativeAreaSums,
      total_rate:
        cumulativeAreaSums.spiritual_rate +
        cumulativeAreaSums.intellectual_rate +
        cumulativeAreaSums.physical_rate +
        cumulativeAreaSums.social_rate +
        cumulativeAreaSums.other_rate,
      overallRate: cumulativeOverall,
      currentRate: calculateCurrentAchievementRate(cumulativeOverall, durationMonths),
    },
  };
}

const SUMMARY_SELECT =
  "id, plan_id, profile_id, year, month, spiritual_rate, intellectual_rate, physical_rate, social_rate, other_rate, total_rate, average_rate";

function validateYear(year: number): SafeError | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { code: "VALIDATION_FAILED", message: "연도가 올바르지 않습니다." };
  }

  return null;
}

async function getOwnedPlan(client: ServiceClient, profileId: string) {
  return client
    .from("moksilgi_plans")
    .select("id, profile_id, title, period_start, period_end")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    // Duplicate active plans are data anomalies; keep the normal case unchanged
    // while making anomaly reads deterministic and newest-created first.
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getMyMoksilgiSummary(
  year: number,
  options?: { profileId?: string },
): Promise<MoksilgiPersonalSummaryResult> {
  const validation = validateYear(year);
  if (validation) return { ok: false, error: validation };

  const context = await getMoksilgiContext({
    logTag: "MOKSILGI_SUMMARY_SERVICE_CLIENT_UNAVAILABLE",
    serviceClientUnavailableMessage: "지금 개인 성취표를 불러올 수 없습니다.",
    ...(options?.profileId ? { profileId: options.profileId } : {}),
  });
  if (!context.ok) return { ok: false, error: context.error };

  const { data: plan, error: planError } = await getOwnedPlan(
    context.serviceClient,
    context.profileId,
  );

  if (planError) {
    return {
      ok: false,
      error: { code: "MOKSILGI_QUERY_FAILED", message: "목실기 정보를 불러올 수 없습니다." },
    };
  }

  const ownedPlan = plan as PlanRow | null;

  if (!ownedPlan) {
    const baseRows = buildMoksilgiMonthRows([]);
    const baseCumulativeRow = buildMoksilgiCumulativeRow(baseRows, MOKSILGI_AREA_KEYS);
    const { rows, cumulativeRow } = decorateSummaryRows(
      baseRows,
      baseCumulativeRow,
      new Map(),
      0,
      DEFAULT_DURATION_MONTHS,
    );

    return {
      ok: true,
      data: {
        plan: null,
        rows,
        cumulativeRow,
        totalAchievementRate: 0,
        durationMonths: DEFAULT_DURATION_MONTHS,
        hasSummaryData: false,
        year,
      },
    };
  }

  const [summariesResult, areasResult, recordsResult] = await Promise.all([
    context.serviceClient
      .from("moksilgi_monthly_summaries")
      .select(SUMMARY_SELECT)
      .eq("plan_id", ownedPlan.id)
      .eq("profile_id", context.profileId)
      .eq("year", year)
      .is("deleted_at", null)
      .order("month", { ascending: true }),
    context.serviceClient
      .from("moksilgi_goal_areas")
      .select("id, area_key, moksilgi_detail_goals!inner(id, measurement_type, annual_target)")
      .eq("plan_id", ownedPlan.id)
      // "기타"(other) 영역은 리포트 집계에서 제외한다. DB 값은 그대로 유지한다.
      .neq("area_key", "other")
      .is("deleted_at", null)
      .is("moksilgi_detail_goals.deleted_at", null),
    context.serviceClient
      .from("moksilgi_monthly_records")
      .select("detail_goal_id, month, achievement_rate, actual_value")
      .eq("plan_id", ownedPlan.id)
      .eq("profile_id", context.profileId)
      .eq("year", year)
      .is("deleted_at", null),
  ]);

  if (summariesResult.error || areasResult.error || recordsResult.error) {
    return {
      ok: false,
      error: { code: "MOKSILGI_QUERY_FAILED", message: "개인 성취표를 불러올 수 없습니다." },
    };
  }

  const persistedSummaries = (summariesResult.data ?? []) as SummaryRow[];
  const areas = (areasResult.data ?? []) as DetailGoalAreaRow[];
  const records = (recordsResult.data ?? []) as MonthlyRecordRateRow[];
  const activeAreaKeys = resolveActiveAreaKeys(
    areas.map((area) => ({ id: area.id, area_key: area.area_key })),
    areas.flatMap((area) =>
      area.moksilgi_detail_goals.map(() => ({ area_id: area.id })),
    ),
  );

  // "연간 기준(B안)": 영역별 월 퍼센트도 monthly 페이지와 동일하게
  // 그 달 실적 ÷ 연간 목표(annual_target)로 재계산한다(월간목표 기준 achievement_rate 미사용).
  const goals = areas.flatMap((area) => area.moksilgi_detail_goals);
  const annualTargetByGoalId = new Map<string, number>();
  for (const goal of goals) {
    if (
      isCountableMeasurementType(goal.measurement_type) &&
      typeof goal.annual_target === "number" &&
      goal.annual_target > 0
    ) {
      annualTargetByGoalId.set(goal.id, goal.annual_target);
    }
  }
  const annualRecords = records.map((record) => {
    const annualTarget = annualTargetByGoalId.get(record.detail_goal_id);
    const actual =
      typeof record.actual_value === "number" && Number.isFinite(record.actual_value)
        ? Math.max(0, record.actual_value)
        : 0;
    return {
      detail_goal_id: record.detail_goal_id,
      month: record.month,
      achievement_rate: annualTarget ? (actual / annualTarget) * 100 : 0,
    };
  });

  const computedSummaries = buildMoksilgiMonthlyRatesFromRecords({
    areas: areas.map((area) => ({ id: area.id, area_key: area.area_key })),
    detailGoals: areas.flatMap((area) =>
      area.moksilgi_detail_goals.map((goal) => ({
        id: goal.id,
        area_id: area.id,
      })),
    ),
    records: annualRecords,
  });
  const summaryByMonth = new Map(
    persistedSummaries.map((summary) => [summary.month, summary]),
  );
  for (const computedSummary of computedSummaries) {
    summaryByMonth.set(computedSummary.month, computedSummary as SummaryRow);
  }
  const summaries = [...summaryByMonth.values()].sort((a, b) => a.month - b.month);
  const baseRows = buildMoksilgiMonthRows(summaries);
  const baseCumulativeRow = buildMoksilgiCumulativeRow(baseRows, activeAreaKeys);

  // "연간 기준(B안)" 종합: 각 측정 목표의 실적 ÷ 연간 목표(annual_target)로 원자료에서 집계.
  const goalFlat = computeMoksilgiGoalFlatOverallAnnual(goals, records);
  const durationMonths =
    calculateCoachingDurationMonths(ownedPlan.period_start, ownedPlan.period_end) ||
    DEFAULT_DURATION_MONTHS;

  const { rows, cumulativeRow } = decorateSummaryRows(
    baseRows,
    baseCumulativeRow,
    goalFlat.overallByMonth,
    goalFlat.cumulativeOverall,
    durationMonths,
  );

  return {
    ok: true,
    data: {
      plan: ownedPlan,
      rows,
      cumulativeRow,
      totalAchievementRate: cumulativeRow.average_rate,
      durationMonths,
      hasSummaryData: summaries.length > 0,
      year,
    },
  };
}
