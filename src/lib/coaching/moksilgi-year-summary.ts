import type { MoksilgiAreaKey, MoksilgiMeasurementType } from "@/types/database";

/** 목실기 연간 성취표 — 1~12월 + 누적 row 공통 타입 */
export type MoksilgiYearSummaryRow = {
  month: number | "cumulative";
  monthLabel: string;
  spiritual_rate: number;
  intellectual_rate: number;
  physical_rate: number;
  social_rate: number;
  other_rate: number;
  total_rate: number;
  average_rate: number;
};

export type MoksilgiMonthlySummaryRates = {
  month: number;
  spiritual_rate?: number | null;
  intellectual_rate?: number | null;
  physical_rate?: number | null;
  social_rate?: number | null;
  other_rate?: number | null;
  total_rate?: number | null;
  average_rate?: number | null;
};

export type MoksilgiSummaryAreaSource = {
  id: string;
  area_key: MoksilgiAreaKey;
};

export type MoksilgiSummaryDetailGoalSource = {
  id: string;
  area_id: string;
};

export type MoksilgiSummaryRecordSource = {
  detail_goal_id: string;
  month: number;
  achievement_rate?: number | null;
};

export const MOKSILGI_AREA_KEYS: MoksilgiAreaKey[] = [
  "spiritual",
  "intellectual",
  "physical",
  "social",
  "other",
];

type SummaryRateKey =
  | "spiritual_rate"
  | "intellectual_rate"
  | "physical_rate"
  | "social_rate"
  | "other_rate"
  | "total_rate"
  | "average_rate";

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summaryValue(summary: MoksilgiMonthlySummaryRates | undefined, key: SummaryRateKey) {
  return safeNumber(summary?.[key]);
}

function positiveNumber(value: number | null | undefined) {
  return Math.max(0, safeNumber(value));
}

/** 월별 실행 기록의 현재 달성률을 기준으로 영역/월 요약을 재계산합니다. */
export function buildMoksilgiMonthlyRatesFromRecords({
  areas,
  detailGoals,
  records,
}: {
  areas: MoksilgiSummaryAreaSource[];
  detailGoals: MoksilgiSummaryDetailGoalSource[];
  records: MoksilgiSummaryRecordSource[];
}): MoksilgiMonthlySummaryRates[] {
  const detailsByAreaId = new Map<string, MoksilgiSummaryDetailGoalSource[]>();
  for (const detailGoal of detailGoals) {
    const existing = detailsByAreaId.get(detailGoal.area_id) ?? [];
    existing.push(detailGoal);
    detailsByAreaId.set(detailGoal.area_id, existing);
  }

  const recordsByMonth = new Map<number, Map<string, number>>();
  for (const record of records) {
    if (!Number.isInteger(record.month) || record.month < 1 || record.month > 12) {
      continue;
    }

    const monthRecords = recordsByMonth.get(record.month) ?? new Map<string, number>();
    monthRecords.set(record.detail_goal_id, positiveNumber(record.achievement_rate));
    recordsByMonth.set(record.month, monthRecords);
  }

  return [...recordsByMonth.entries()]
    .sort(([monthA], [monthB]) => monthA - monthB)
    .map(([month, monthRecords]) => {
      const areaRates: Record<MoksilgiAreaKey, number> = {
        spiritual: 0,
        intellectual: 0,
        physical: 0,
        social: 0,
        other: 0,
      };
      const activeAreaRates: number[] = [];

      for (const area of areas) {
        const areaDetails = detailsByAreaId.get(area.id) ?? [];
        if (areaDetails.length === 0) {
          continue;
        }

        const rate =
          areaDetails.reduce(
            (sum, detail) => sum + (monthRecords.get(detail.id) ?? 0),
            0,
          ) / areaDetails.length;

        areaRates[area.area_key] = rate;
        activeAreaRates.push(rate);
      }

      return {
        month,
        spiritual_rate: areaRates.spiritual,
        intellectual_rate: areaRates.intellectual,
        physical_rate: areaRates.physical,
        social_rate: areaRates.social,
        other_rate: areaRates.other,
        total_rate: MOKSILGI_AREA_KEYS.reduce((sum, key) => sum + areaRates[key], 0),
        average_rate: activeAreaRates.length > 0 ? average(activeAreaRates) : 0,
      };
    });
}

/** 1~12월 그리드 — summary 없는 월은 0 */
export function buildMoksilgiMonthRows(
  summaries: MoksilgiMonthlySummaryRates[],
): MoksilgiYearSummaryRow[] {
  const summaryByMonth = new Map(summaries.map((summary) => [summary.month, summary]));

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const summary = summaryByMonth.get(month);

    return {
      month,
      monthLabel: `${month}월`,
      spiritual_rate: summaryValue(summary, "spiritual_rate"),
      intellectual_rate: summaryValue(summary, "intellectual_rate"),
      physical_rate: summaryValue(summary, "physical_rate"),
      social_rate: summaryValue(summary, "social_rate"),
      other_rate: summaryValue(summary, "other_rate"),
      total_rate: summaryValue(summary, "total_rate"),
      average_rate: summaryValue(summary, "average_rate"),
    };
  });
}

/** 12개월 row 기준 누적 — 상세/성취표/코치 목록 공통 */
export function buildMoksilgiCumulativeRow(
  monthRows: MoksilgiYearSummaryRow[],
  activeAreaKeys: MoksilgiAreaKey[],
): MoksilgiYearSummaryRow {
  const areaRates: Record<MoksilgiAreaKey, number> = {
    spiritual: average(monthRows.map((row) => row.spiritual_rate)),
    intellectual: average(monthRows.map((row) => row.intellectual_rate)),
    physical: average(monthRows.map((row) => row.physical_rate)),
    social: average(monthRows.map((row) => row.social_rate)),
    other: average(monthRows.map((row) => row.other_rate)),
  };
  const activeRates = activeAreaKeys.map((key) => areaRates[key]);

  return {
    month: "cumulative",
    monthLabel: "누적",
    spiritual_rate: areaRates.spiritual,
    intellectual_rate: areaRates.intellectual,
    physical_rate: areaRates.physical,
    social_rate: areaRates.social,
    other_rate: areaRates.other,
    total_rate: MOKSILGI_AREA_KEYS.reduce((sum, key) => sum + areaRates[key], 0),
    average_rate: activeRates.length > 0 ? average(activeRates) : 0,
  };
}

/** 세부 목표가 있는 영역만 active — 없으면 5개 영역 전체 */
export function resolveActiveAreaKeys(
  areas: Array<{ id: string; area_key: MoksilgiAreaKey }>,
  detailGoals: Array<{ area_id: string }>,
): MoksilgiAreaKey[] {
  const keys = [
    ...new Set(
      areas
        .filter((area) => detailGoals.some((goal) => goal.area_id === area.id))
        .map((area) => area.area_key),
    ),
  ];

  return keys.length > 0 ? keys : [...MOKSILGI_AREA_KEYS];
}

/**
 * coachee당 active plan 1개 — plans는 updated_at DESC 정렬 가정.
 * updated_at 동률 시 created_at, id 순 fallback.
 */
export function pickLatestActivePlanPerProfile<
  T extends { id: string; profile_id: string; updated_at: string; created_at: string },
>(plans: T[]): T[] {
  const bestByProfile = new Map<string, T>();

  for (const plan of plans) {
    const existing = bestByProfile.get(plan.profile_id);
    if (!existing || comparePlanRecency(plan, existing) > 0) {
      bestByProfile.set(plan.profile_id, plan);
    }
  }

  return [...bestByProfile.values()];
}

function comparePlanRecency<
  T extends { id: string; updated_at: string; created_at: string },
>(candidate: T, current: T) {
  const updatedCompare = candidate.updated_at.localeCompare(current.updated_at);
  if (updatedCompare !== 0) return updatedCompare;

  const createdCompare = candidate.created_at.localeCompare(current.created_at);
  if (createdCompare !== 0) return createdCompare;

  return candidate.id.localeCompare(current.id);
}

export type MoksilgiYearSummaryMetrics = {
  monthRows: MoksilgiYearSummaryRow[];
  cumulativeRow: MoksilgiYearSummaryRow;
  summary_count: number;
  spiritual_rate: number;
  intellectual_rate: number;
  physical_rate: number;
  social_rate: number;
  other_rate: number;
  total_rate: number;
  average_rate: number;
  total_achievement_rate: number;
};

/** 월별 summary + active 영역 → 목록 카드/상세/성취표 동일 지표 */
export function computeMoksilgiYearSummaryMetrics(
  summaries: MoksilgiMonthlySummaryRates[],
  activeAreaKeys: MoksilgiAreaKey[],
): MoksilgiYearSummaryMetrics {
  const monthRows = buildMoksilgiMonthRows(summaries);
  const cumulativeRow = buildMoksilgiCumulativeRow(monthRows, activeAreaKeys);

  return {
    monthRows,
    cumulativeRow,
    summary_count: summaries.length,
    spiritual_rate: cumulativeRow.spiritual_rate,
    intellectual_rate: cumulativeRow.intellectual_rate,
    physical_rate: cumulativeRow.physical_rate,
    social_rate: cumulativeRow.social_rate,
    other_rate: cumulativeRow.other_rate,
    total_rate: cumulativeRow.total_rate,
    average_rate: cumulativeRow.average_rate,
    total_achievement_rate: cumulativeRow.average_rate,
  };
}

/**
 * 측정(카운트) 대상 세부목표인지 판별.
 * 자유 기록(monthly_comment)만 제외하고 나머지 측정 유형은 계산 대상에 포함.
 */
export function isCountableMeasurementType(type: MoksilgiMeasurementType): boolean {
  return type !== "monthly_comment";
}

/**
 * 코칭 기간 개월 수 — 시작월·종료월을 모두 포함해서 계산.
 * 예: 2026-01 ~ 2026-12 = 12, 2026-03 ~ 2026-12 = 10, 2026-05 ~ 2027-04 = 12.
 * 기간이 없거나 잘못된 경우 0을 반환(호출부에서 fallback 처리).
 */
export function calculateCoachingDurationMonths(
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
): number {
  if (!periodStart || !periodEnd) return 0;
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;

  return months > 0 ? months : 0;
}

/**
 * 현재 달성률 = 종합 ÷ 코칭 기간 개월 수.
 * 개월 수가 0 이하이거나 값이 유한하지 않으면 0을 반환(NaN/Infinity 방지).
 */
export function calculateCurrentAchievementRate(
  overallRate: number,
  durationMonths: number,
): number {
  if (!Number.isFinite(overallRate)) return 0;
  if (!Number.isFinite(durationMonths) || durationMonths <= 0) return 0;

  return overallRate / durationMonths;
}

export type MoksilgiGoalFlatRateSource = {
  detail_goal_id: string;
  month: number;
  achievement_rate?: number | null;
};

export type MoksilgiGoalFlatOverall = {
  /** month(1~12) → 그 달의 종합(측정 목표별 달성률 합 ÷ 측정 목표 수) */
  overallByMonth: Map<number, number>;
  /** 누적 종합 = 측정 목표별 (월별 달성률 합)의 평균 */
  cumulativeOverall: number;
  /** 계산에 사용된 측정 목표 수(분모) */
  countableGoalCount: number;
};

/**
 * "목표 평균" 방식 종합 계산.
 * 각 측정 목표의 월별 달성률을 합산한 뒤, 측정 목표 수로 나눔.
 * - 분모 = 측정(카운트) 대상 목표 수(영역 수가 아님)
 * - 저장된 월별 달성률을 그대로 사용(100% 초과 허용, 상한 클램프 없음)
 * - 음수 달성률만 0으로 보정
 */
/** 세부목표 목록에서 측정(카운트) 대상 목표 id 집합을 만든다. */
export function collectCountableGoalIds(
  goals: Array<{ id: string; measurement_type: MoksilgiMeasurementType }>,
): Set<string> {
  const ids = new Set<string>();
  for (const goal of goals) {
    if (isCountableMeasurementType(goal.measurement_type)) {
      ids.add(goal.id);
    }
  }
  return ids;
}

/**
 * 영역 기준 성취표 row(월별 + 누적)에 "목표 평균" 종합·현재 달성률을 덧붙인다.
 * 여러 화면(개인 요약/코치 상세/코치메이커 상세)에서 동일 계산을 재사용하기 위한 공용 헬퍼.
 */
export function decorateRowsWithGoalFlatRates<
  T extends { month: number | "cumulative" },
>(
  monthRows: T[],
  cumulativeRow: T,
  goalFlat: MoksilgiGoalFlatOverall,
  durationMonths: number,
): {
  rows: Array<T & { overallRate: number; currentRate: number }>;
  cumulativeRow: T & { overallRate: number; currentRate: number };
} {
  const rows = monthRows.map((row) => {
    const overallRate =
      typeof row.month === "number" ? goalFlat.overallByMonth.get(row.month) ?? 0 : 0;
    return {
      ...row,
      overallRate,
      currentRate: calculateCurrentAchievementRate(overallRate, durationMonths),
    };
  });

  return {
    rows,
    cumulativeRow: {
      ...cumulativeRow,
      overallRate: goalFlat.cumulativeOverall,
      currentRate: calculateCurrentAchievementRate(
        goalFlat.cumulativeOverall,
        durationMonths,
      ),
    },
  };
}

export function computeMoksilgiGoalFlatOverall(
  countableGoalIds: Set<string>,
  records: MoksilgiGoalFlatRateSource[],
): MoksilgiGoalFlatOverall {
  const goalCount = countableGoalIds.size;
  const sumByMonth = new Map<number, number>();
  let totalSum = 0;

  for (const record of records) {
    if (!countableGoalIds.has(record.detail_goal_id)) continue;
    if (!Number.isInteger(record.month) || record.month < 1 || record.month > 12) {
      continue;
    }

    const rate = Math.max(0, safeNumber(record.achievement_rate));
    sumByMonth.set(record.month, (sumByMonth.get(record.month) ?? 0) + rate);
    totalSum += rate;
  }

  const overallByMonth = new Map<number, number>();
  if (goalCount > 0) {
    for (const [month, sum] of sumByMonth) {
      overallByMonth.set(month, sum / goalCount);
    }
  }

  return {
    overallByMonth,
    cumulativeOverall: goalCount > 0 ? totalSum / goalCount : 0,
    countableGoalCount: goalCount,
  };
}

export type MoksilgiAnnualGoalSource = {
  id: string;
  annual_target: number | null;
  measurement_type: MoksilgiMeasurementType;
};

export type MoksilgiAnnualRecordSource = {
  detail_goal_id: string;
  month: number;
  actual_value?: number | null;
};

/**
 * "연간 기준(B안)" 종합 계산.
 * 각 목표의 달성률을 그 달 실적 ÷ **연간 목표(annual_target)** 로 계산한 뒤,
 * 측정 목표 수로 나눠 종합을 만든다(문서 방식).
 * - 계산 대상 = 카운트형(monthly_comment 제외) + annual_target > 0 인 목표
 * - 월별 종합 = Σ(대상 목표의 그 달 실적/연목표) ÷ 대상 목표 수
 * - 누적 종합 = Σ(대상 목표의 누적 실적/연목표) ÷ 대상 목표 수 (= 월별 종합의 합)
 * - 100% 초과 허용(상한 클램프 없음), 음수 실적만 0으로 보정
 */
export function computeMoksilgiGoalFlatOverallAnnual(
  goals: MoksilgiAnnualGoalSource[],
  records: MoksilgiAnnualRecordSource[],
): MoksilgiGoalFlatOverall {
  const annualByGoal = new Map<string, number>();
  for (const goal of goals) {
    if (
      isCountableMeasurementType(goal.measurement_type) &&
      typeof goal.annual_target === "number" &&
      goal.annual_target > 0
    ) {
      annualByGoal.set(goal.id, goal.annual_target);
    }
  }

  const goalCount = annualByGoal.size;
  const sumByMonth = new Map<number, number>();
  let totalSum = 0;

  for (const record of records) {
    const annualTarget = annualByGoal.get(record.detail_goal_id);
    if (annualTarget === undefined) continue;
    if (!Number.isInteger(record.month) || record.month < 1 || record.month > 12) {
      continue;
    }

    const rate = (Math.max(0, safeNumber(record.actual_value)) / annualTarget) * 100;
    sumByMonth.set(record.month, (sumByMonth.get(record.month) ?? 0) + rate);
    totalSum += rate;
  }

  const overallByMonth = new Map<number, number>();
  if (goalCount > 0) {
    for (const [month, sum] of sumByMonth) {
      overallByMonth.set(month, sum / goalCount);
    }
  }

  return {
    overallByMonth,
    cumulativeOverall: goalCount > 0 ? totalSum / goalCount : 0,
    countableGoalCount: goalCount,
  };
}
