import {
  buildMoksilgiMonthlyRatesFromRecords,
  computeMoksilgiGoalFlatOverallAnnual,
  isCountableMeasurementType,
} from "@/lib/coaching/moksilgi-year-summary";
import type { MoksilgiAreaKey, MoksilgiMeasurementType } from "@/types/database";

/**
 * 목실기 "기간 기준" 계산 헬퍼.
 * 기획안 기본정보의 기간 시작일·종료일(moksilgi_plans.period_start / period_end)을
 * 연·월 목록으로 펼치고, 경과율과 진도 대비 달성률을 계산한다.
 * 기존 연도 기준 헬퍼(moksilgi-year-summary.ts)는 변경하지 않는다.
 */

/** 기간 표가 비정상적으로 길어지는 것을 막기 위한 상한(5년) */
const MAX_PERIOD_MONTHS = 60;

export type MoksilgiYearMonth = {
  year: number;
  month: number;
};

export type MoksilgiPeriodMonth = MoksilgiYearMonth & {
  /** 기간 안에서의 순번(1부터) */
  index: number;
  /** "2026-03" */
  key: string;
  /** "2026.03" */
  label: string;
};

export type MoksilgiPeriodStatus = "before" | "in_progress" | "ended";

function parseDateOnly(value: string | null | undefined): MoksilgiYearMonth | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function toMonthNumber({ year, month }: MoksilgiYearMonth) {
  return year * 12 + (month - 1);
}

export function formatMoksilgiPeriodKey({ year, month }: MoksilgiYearMonth) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * 기간 시작월~종료월(양 끝 포함)을 연·월 목록으로 펼친다.
 * 예: 2026-03-01 ~ 2027-02-28 → 2026.03 … 2027.02 (12칸)
 * 기간이 없거나, 종료가 시작보다 빠르거나, 상한을 넘으면 빈 배열을 반환한다.
 */
export function buildMoksilgiPeriodMonths(
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
): MoksilgiPeriodMonth[] {
  const start = parseDateOnly(periodStart);
  const end = parseDateOnly(periodEnd);
  if (!start || !end) return [];

  const startNumber = toMonthNumber(start);
  const total = toMonthNumber(end) - startNumber + 1;
  if (total <= 0 || total > MAX_PERIOD_MONTHS) return [];

  return Array.from({ length: total }, (_, offset) => {
    const monthNumber = startNumber + offset;
    const year = Math.floor(monthNumber / 12);
    const month = (monthNumber % 12) + 1;
    return {
      year,
      month,
      index: offset + 1,
      key: formatMoksilgiPeriodKey({ year, month }),
      label: `${year}.${String(month).padStart(2, "0")}`,
    };
  });
}

/** 현재 연·월까지 지난(현재 월 포함) 기간 개월 수 */
export function calculateMoksilgiElapsedMonths(
  periodMonths: MoksilgiPeriodMonth[],
  current: MoksilgiYearMonth,
): number {
  const currentNumber = toMonthNumber(current);
  return periodMonths.filter((month) => toMonthNumber(month) <= currentNumber).length;
}

export function getMoksilgiPeriodStatus(
  periodMonths: MoksilgiPeriodMonth[],
  current: MoksilgiYearMonth,
): MoksilgiPeriodStatus {
  const elapsed = calculateMoksilgiElapsedMonths(periodMonths, current);
  if (elapsed <= 0) return "before";
  if (elapsed >= periodMonths.length) return "ended";
  return "in_progress";
}

/** 경과율(%) = 경과 개월 ÷ 기간 개월 × 100 */
export function calculateMoksilgiElapsedRate(elapsedMonths: number, totalMonths: number) {
  if (!Number.isFinite(totalMonths) || totalMonths <= 0) return 0;
  const clamped = Math.min(Math.max(elapsedMonths, 0), totalMonths);
  return (clamped / totalMonths) * 100;
}

/**
 * 진도 대비 달성률(%) = 누적 달성률 ÷ 경과율 × 100.
 * 100% = 계획한 속도, 100% 미만 = 뒤처짐, 100% 초과 = 앞섬.
 * 경과율이 0(기간 시작 전)이면 계산하지 않고 null을 반환한다.
 */
export function calculateMoksilgiProgressPaceRate(
  cumulativeRate: number,
  elapsedRate: number,
): number | null {
  if (!Number.isFinite(cumulativeRate)) return null;
  if (!Number.isFinite(elapsedRate) || elapsedRate <= 0) return null;
  return (cumulativeRate / elapsedRate) * 100;
}

// ─────────────────────────────────────────────────────────────
// 기간 기준 성취 집계 (코치이 성취표·코치 상세 화면 공용)
// ─────────────────────────────────────────────────────────────

export type MoksilgiPeriodAreaRates = {
  spiritual_rate: number;
  intellectual_rate: number;
  physical_rate: number;
  social_rate: number;
};

export type MoksilgiPeriodSummaryRow = MoksilgiPeriodMonth &
  MoksilgiPeriodAreaRates & {
    /** 그 달 종합: 측정 목표별 (실적 ÷ 기간 목표) 합 ÷ 측정 목표 수 */
    overallRate: number;
    /** 기간 시작월부터 이 달까지의 종합 합계 */
    cumulativeRate: number;
    hasRecords: boolean;
  };

export type MoksilgiPeriodSummary = {
  rows: MoksilgiPeriodSummaryRow[];
  cumulativeAreaRates: MoksilgiPeriodAreaRates;
  cumulativeOverall: number;
  /** 기간 안 기록 수 */
  recordCount: number;
  /** 기간 밖 연·월에 저장된 기록 수(계산에서 제외) */
  outOfPeriodRecordCount: number;
};

export type MoksilgiPeriodAreaSource = {
  id: string;
  area_key: MoksilgiAreaKey;
};

export type MoksilgiPeriodGoalSource = {
  id: string;
  area_id: string;
  measurement_type: MoksilgiMeasurementType;
  annual_target: number | null;
};

export type MoksilgiPeriodRecordSource = MoksilgiYearMonth & {
  detail_goal_id: string;
  actual_value: number | null;
};

export const EMPTY_MOKSILGI_PERIOD_AREA_RATES: MoksilgiPeriodAreaRates = {
  spiritual_rate: 0,
  intellectual_rate: 0,
  physical_rate: 0,
  social_rate: 0,
};

function sumValues(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * 기간 개월 목록 기준으로 월별 영역 성취률·종합·누적을 집계한다.
 * - 달성률 = 실적 ÷ 기간 목표(annual_target) — 기존 연간 기준(B안)과 같은 공식
 * - "기타"(other) 영역과 그 목표는 리포트 집계에서 제외한다(DB 값은 유지)
 * - 기간 밖 연·월의 기록은 계산에서 제외한다
 */
export function buildMoksilgiPeriodSummary({
  periodMonths,
  areas,
  goals,
  records,
}: {
  periodMonths: MoksilgiPeriodMonth[];
  areas: MoksilgiPeriodAreaSource[];
  goals: MoksilgiPeriodGoalSource[];
  records: MoksilgiPeriodRecordSource[];
}): MoksilgiPeriodSummary {
  const reportAreas = areas.filter((area) => area.area_key !== "other");
  const reportAreaIds = new Set(reportAreas.map((area) => area.id));
  const reportGoals = goals.filter((goal) => reportAreaIds.has(goal.area_id));
  const reportGoalIds = new Set(reportGoals.map((goal) => goal.id));

  const periodKeys = new Set(periodMonths.map((month) => month.key));
  const goalRecords = records.filter((record) => reportGoalIds.has(record.detail_goal_id));
  const inPeriodRecords = goalRecords.filter((record) =>
    periodKeys.has(formatMoksilgiPeriodKey(record)),
  );

  const periodTargetByGoalId = new Map<string, number>();
  for (const goal of reportGoals) {
    if (
      isCountableMeasurementType(goal.measurement_type) &&
      typeof goal.annual_target === "number" &&
      goal.annual_target > 0
    ) {
      periodTargetByGoalId.set(goal.id, goal.annual_target);
    }
  }

  const detailGoalSources = reportGoals.map((goal) => ({ id: goal.id, area_id: goal.area_id }));
  const areaRatesByKey = new Map<string, MoksilgiPeriodAreaRates>();
  const overallByKey = new Map<string, number>();
  const recordKeys = new Set<string>();
  const years = [...new Set(periodMonths.map((month) => month.year))];

  // 기존 헬퍼는 1~12월 단위로 집계하므로, 연도별로 나눠 계산한 뒤 연·월 키로 합친다.
  for (const year of years) {
    const yearRecords = inPeriodRecords.filter((record) => record.year === year);
    if (yearRecords.length === 0) continue;

    for (const record of yearRecords) {
      recordKeys.add(formatMoksilgiPeriodKey(record));
    }

    const periodRateRecords = yearRecords.map((record) => {
      const periodTarget = periodTargetByGoalId.get(record.detail_goal_id);
      const actual =
        typeof record.actual_value === "number" && Number.isFinite(record.actual_value)
          ? Math.max(0, record.actual_value)
          : 0;
      return {
        detail_goal_id: record.detail_goal_id,
        month: record.month,
        achievement_rate: periodTarget ? (actual / periodTarget) * 100 : 0,
      };
    });

    const monthlyAreaRates = buildMoksilgiMonthlyRatesFromRecords({
      areas: reportAreas,
      detailGoals: detailGoalSources,
      records: periodRateRecords,
    });
    for (const rates of monthlyAreaRates) {
      areaRatesByKey.set(formatMoksilgiPeriodKey({ year, month: rates.month }), {
        spiritual_rate: rates.spiritual_rate ?? 0,
        intellectual_rate: rates.intellectual_rate ?? 0,
        physical_rate: rates.physical_rate ?? 0,
        social_rate: rates.social_rate ?? 0,
      });
    }

    const goalFlat = computeMoksilgiGoalFlatOverallAnnual(reportGoals, yearRecords);
    for (const [month, overall] of goalFlat.overallByMonth) {
      overallByKey.set(formatMoksilgiPeriodKey({ year, month }), overall);
    }
  }

  let runningOverall = 0;
  const rows: MoksilgiPeriodSummaryRow[] = periodMonths.map((periodMonth) => {
    const areaRates =
      areaRatesByKey.get(periodMonth.key) ?? EMPTY_MOKSILGI_PERIOD_AREA_RATES;
    const overallRate = overallByKey.get(periodMonth.key) ?? 0;
    runningOverall += overallRate;
    return {
      ...periodMonth,
      ...areaRates,
      overallRate,
      cumulativeRate: runningOverall,
      hasRecords: recordKeys.has(periodMonth.key),
    };
  });

  return {
    rows,
    cumulativeAreaRates: {
      spiritual_rate: sumValues(rows.map((row) => row.spiritual_rate)),
      intellectual_rate: sumValues(rows.map((row) => row.intellectual_rate)),
      physical_rate: sumValues(rows.map((row) => row.physical_rate)),
      social_rate: sumValues(rows.map((row) => row.social_rate)),
    },
    cumulativeOverall: runningOverall,
    recordCount: inPeriodRecords.length,
    outOfPeriodRecordCount: goalRecords.length - inPeriodRecords.length,
  };
}

export type MoksilgiPeriodProgress = {
  status: MoksilgiPeriodStatus;
  elapsedMonths: number;
  elapsedRate: number;
  /** 지금까지 누적 ÷ 지금까지 경과율 — 기간 시작 전이면 null */
  paceRate: number | null;
  /** 오늘이 기간 안이면 이번 달 row */
  currentRow: MoksilgiPeriodSummaryRow | null;
  /** 연·월 키 → 그 달까지의 진도 대비 달성률(아직 오지 않은 달은 null) */
  paceByKey: Map<string, number | null>;
};

/** 오늘 기준 경과율·진도 대비 달성률을 계산한다. */
export function calculateMoksilgiPeriodProgress(
  rows: MoksilgiPeriodSummaryRow[],
  today: MoksilgiYearMonth,
): MoksilgiPeriodProgress {
  const totalMonths = rows.length;
  const elapsedMonths = calculateMoksilgiElapsedMonths(rows, today);
  const elapsedRate = calculateMoksilgiElapsedRate(elapsedMonths, totalMonths);
  const status = getMoksilgiPeriodStatus(rows, today);
  const cumulativeToDate =
    elapsedMonths > 0 ? rows[Math.min(elapsedMonths, totalMonths) - 1].cumulativeRate : 0;

  const paceByKey = new Map<string, number | null>();
  for (const row of rows) {
    paceByKey.set(
      row.key,
      row.index > elapsedMonths
        ? null
        : calculateMoksilgiProgressPaceRate(
            row.cumulativeRate,
            calculateMoksilgiElapsedRate(row.index, totalMonths),
          ),
    );
  }

  return {
    status,
    elapsedMonths,
    elapsedRate,
    paceRate: calculateMoksilgiProgressPaceRate(cumulativeToDate, elapsedRate),
    currentRow:
      status === "in_progress" ? rows.find((row) => row.index === elapsedMonths) ?? null : null,
    paceByKey,
  };
}
