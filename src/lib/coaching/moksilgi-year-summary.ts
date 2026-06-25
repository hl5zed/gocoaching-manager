import type { MoksilgiAreaKey } from "@/types/database";

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
