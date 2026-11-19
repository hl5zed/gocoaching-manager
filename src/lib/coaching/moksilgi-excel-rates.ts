import {
  formatMoksilgiPeriodKey,
  type MoksilgiPeriodMonth,
  type MoksilgiPeriodSummary,
  type MoksilgiYearMonth,
} from "@/lib/coaching/moksilgi-period";
import {
  calculateCurrentAchievementRate,
  isCountableMeasurementType,
  type MoksilgiYearSummaryRow,
} from "@/lib/coaching/moksilgi-year-summary";
import type { MoksilgiAreaKey, MoksilgiMeasurementType } from "@/types/database";

/**
 * 목실기 "엑셀 방식" 달성률 계산 헬퍼.
 * 기준 문서: 목실기와 체크리스트(2026) — "1.김경도_목실기및체크" 탭.
 *
 * 엑셀 공식과 이 헬퍼의 대응:
 * - 세부 목표 월 달성률   D15  = 월 실적 ÷ 목표량(J11)
 * - 세부 목표 누적        D27  = Σ 월 달성률 (= 누적 실적 ÷ 목표량)
 * - 목표(영역) 종합/달성  I9   = 세부 목표 누적 달성률의 단순 평균
 * - 성취표 영역 열        E204 = 그 달 세부 목표 월 달성률의 평균
 * - 성취표 "1~4 종합"     I204 = 영역 달성률의 합계(SUM)
 * - 성취표 "평균"         J204 = 종합 ÷ 영역 수
 * - 성취표 누적 행        216  = 각 열의 월별 합계
 * - 총 달성률             J218 = 누적 행의 평균
 *
 * 프로그램 반영 시 차이:
 * - 평균의 분모는 고정 4가 아니라 "측정 세부 목표가 있는 영역 수"를 사용한다
 *   (4개 영역이 모두 채워진 경우 엑셀과 동일).
 * - "기타"(other) 영역은 엑셀 4개 영역 구조에 없으므로 제외한다(DB 값은 유지).
 * - 자유 기록(monthly_comment)·목표량 없는 세부 목표는 분모에서 제외한다.
 * - 달성률 단위는 기존 헬퍼와 같은 %(0~100+)이며, 100% 초과를 허용한다.
 * - 기간 밖 연·월의 기록은 계산에서 제외한다.
 *
 * 기존 moksilgi-period.ts / moksilgi-year-summary.ts 계산은 변경하지 않는다.
 */

export const MOKSILGI_EXCEL_AREA_KEYS = [
  "spiritual",
  "intellectual",
  "physical",
  "social",
] as const satisfies readonly MoksilgiAreaKey[];

export type MoksilgiExcelAreaKey = (typeof MOKSILGI_EXCEL_AREA_KEYS)[number];

export type MoksilgiExcelAreaRates = Record<MoksilgiExcelAreaKey, number>;

export type MoksilgiExcelAreaSource = {
  id: string;
  area_key: MoksilgiAreaKey;
};

export type MoksilgiExcelGoalSource = {
  id: string;
  area_id: string;
  measurement_type: MoksilgiMeasurementType;
  annual_target: number | null;
};

export type MoksilgiExcelRecordSource = MoksilgiYearMonth & {
  detail_goal_id: string;
  actual_value: number | null;
};

/** 세부 목표 1개의 월별·누적 달성률 (엑셀 C/D열) */
export type MoksilgiExcelGoalRates = {
  goalId: string;
  areaKey: MoksilgiExcelAreaKey;
  target: number;
  /** 기간 연·월 키 → 그 달 실적 */
  actualByKey: Map<string, number>;
  /** 기간 연·월 키 → 그 달 달성률(%) */
  rateByKey: Map<string, number>;
  cumulativeActual: number;
  cumulativeRate: number;
};

/** 성취표 1행 (엑셀 204~215행) */
export type MoksilgiExcelSummaryRow = MoksilgiPeriodMonth & {
  areaRates: MoksilgiExcelAreaRates;
  /** "1~4 종합" — 영역 달성률 합계 */
  totalRate: number;
  /** "평균" — 종합 ÷ 영역 수 */
  averageRate: number;
  /** 기간 시작월부터 이 달까지의 평균 누적 */
  cumulativeAverageRate: number;
  hasRecords: boolean;
};

/** 성취표 누적 행 (엑셀 216행) + 총 달성률 (J218) */
export type MoksilgiExcelCumulativeRow = {
  areaRates: MoksilgiExcelAreaRates;
  totalRate: number;
  averageRate: number;
};

export type MoksilgiExcelSummary = {
  /** 측정 세부 목표가 있는 영역(평균의 분모) */
  activeAreaKeys: MoksilgiExcelAreaKey[];
  goals: MoksilgiExcelGoalRates[];
  rows: MoksilgiExcelSummaryRow[];
  cumulative: MoksilgiExcelCumulativeRow;
  /** 총 달성률 (= 누적 행 평균) */
  totalAchievementRate: number;
  recordCount: number;
  outOfPeriodRecordCount: number;
};

export const EMPTY_MOKSILGI_EXCEL_AREA_RATES: MoksilgiExcelAreaRates = {
  spiritual: 0,
  intellectual: 0,
  physical: 0,
  social: 0,
};

function isExcelAreaKey(key: MoksilgiAreaKey): key is MoksilgiExcelAreaKey {
  return (MOKSILGI_EXCEL_AREA_KEYS as readonly MoksilgiAreaKey[]).includes(key);
}

function safeActual(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 엑셀 D열: 실적 ÷ 목표량 × 100 (목표량이 0 이하이면 0) */
export function calculateMoksilgiExcelGoalRate(actual: number, target: number) {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return (safeActual(actual) / target) * 100;
}

/** 엑셀 I/J열: 영역 달성률 → 종합(합계)·평균 */
export function summarizeMoksilgiExcelAreaRates(
  areaRates: MoksilgiExcelAreaRates,
  activeAreaKeys: MoksilgiExcelAreaKey[],
): { totalRate: number; averageRate: number } {
  const totalRate = activeAreaKeys.reduce((sum, key) => sum + areaRates[key], 0);
  return {
    totalRate,
    averageRate: activeAreaKeys.length > 0 ? totalRate / activeAreaKeys.length : 0,
  };
}

/**
 * 기간 개월 목록 기준으로 엑셀 성취표와 같은 값을 계산한다.
 */
export function buildMoksilgiExcelSummary({
  periodMonths,
  areas,
  goals,
  records,
}: {
  periodMonths: MoksilgiPeriodMonth[];
  areas: MoksilgiExcelAreaSource[];
  goals: MoksilgiExcelGoalSource[];
  records: MoksilgiExcelRecordSource[];
}): MoksilgiExcelSummary {
  const areaKeyById = new Map<string, MoksilgiExcelAreaKey>();
  for (const area of areas) {
    if (isExcelAreaKey(area.area_key)) {
      areaKeyById.set(area.id, area.area_key);
    }
  }

  // 측정 대상 세부 목표: 4개 영역 소속 + 카운트형 + 목표량 > 0
  const goalRates: MoksilgiExcelGoalRates[] = [];
  const goalRatesById = new Map<string, MoksilgiExcelGoalRates>();
  for (const goal of goals) {
    const areaKey = areaKeyById.get(goal.area_id);
    if (!areaKey) continue;
    if (!isCountableMeasurementType(goal.measurement_type)) continue;
    if (typeof goal.annual_target !== "number" || !(goal.annual_target > 0)) continue;

    const entry: MoksilgiExcelGoalRates = {
      goalId: goal.id,
      areaKey,
      target: goal.annual_target,
      actualByKey: new Map(),
      rateByKey: new Map(),
      cumulativeActual: 0,
      cumulativeRate: 0,
    };
    goalRates.push(entry);
    goalRatesById.set(goal.id, entry);
  }

  const periodKeys = new Set(periodMonths.map((month) => month.key));
  const recordKeys = new Set<string>();
  let recordCount = 0;
  let outOfPeriodRecordCount = 0;

  for (const record of records) {
    const entry = goalRatesById.get(record.detail_goal_id);
    if (!entry) continue;

    const key = formatMoksilgiPeriodKey(record);
    if (!periodKeys.has(key)) {
      outOfPeriodRecordCount += 1;
      continue;
    }

    recordCount += 1;
    recordKeys.add(key);
    entry.actualByKey.set(key, (entry.actualByKey.get(key) ?? 0) + safeActual(record.actual_value));
  }

  for (const entry of goalRates) {
    for (const [key, actual] of entry.actualByKey) {
      entry.rateByKey.set(key, calculateMoksilgiExcelGoalRate(actual, entry.target));
      entry.cumulativeActual += actual;
    }
    entry.cumulativeRate = calculateMoksilgiExcelGoalRate(entry.cumulativeActual, entry.target);
  }

  const goalsByArea = new Map<MoksilgiExcelAreaKey, MoksilgiExcelGoalRates[]>();
  for (const entry of goalRates) {
    const list = goalsByArea.get(entry.areaKey) ?? [];
    list.push(entry);
    goalsByArea.set(entry.areaKey, list);
  }
  const activeAreaKeys = MOKSILGI_EXCEL_AREA_KEYS.filter((key) => goalsByArea.has(key));

  const areaRatesFor = (pick: (entry: MoksilgiExcelGoalRates) => number) => {
    const rates: MoksilgiExcelAreaRates = { ...EMPTY_MOKSILGI_EXCEL_AREA_RATES };
    for (const key of activeAreaKeys) {
      rates[key] = average((goalsByArea.get(key) ?? []).map(pick));
    }
    return rates;
  };

  let runningAverage = 0;
  const rows: MoksilgiExcelSummaryRow[] = periodMonths.map((periodMonth) => {
    const areaRates = areaRatesFor((entry) => entry.rateByKey.get(periodMonth.key) ?? 0);
    const { totalRate, averageRate } = summarizeMoksilgiExcelAreaRates(areaRates, activeAreaKeys);
    runningAverage += averageRate;
    return {
      ...periodMonth,
      areaRates,
      totalRate,
      averageRate,
      cumulativeAverageRate: runningAverage,
      hasRecords: recordKeys.has(periodMonth.key),
    };
  });

  // 누적 행: 영역 = 세부 목표 누적 달성률 평균 (= 월별 영역 달성률 합계)
  const cumulativeAreaRates = areaRatesFor((entry) => entry.cumulativeRate);
  const cumulative: MoksilgiExcelCumulativeRow = {
    areaRates: cumulativeAreaRates,
    ...summarizeMoksilgiExcelAreaRates(cumulativeAreaRates, activeAreaKeys),
  };

  return {
    activeAreaKeys,
    goals: goalRates,
    rows,
    cumulative,
    totalAchievementRate: cumulative.averageRate,
    recordCount,
    outOfPeriodRecordCount,
  };
}

// ─────────────────────────────────────────────────────────────
// 화면 공용 변환 — 기존 화면 타입(기간 요약 / 연간 성취표 row)에 맞춘다.
// ─────────────────────────────────────────────────────────────

/**
 * 엑셀 요약 → 기존 기간 요약 타입.
 * overallRate = 엑셀 "평균", cumulativeRate = 평균 누적, cumulativeOverall = 총 달성률.
 */
export function toMoksilgiPeriodSummary(excel: MoksilgiExcelSummary): MoksilgiPeriodSummary {
  const cumulativeAreas = excel.cumulative.areaRates;
  return {
    rows: excel.rows.map((row) => ({
      year: row.year,
      month: row.month,
      index: row.index,
      key: row.key,
      label: row.label,
      spiritual_rate: row.areaRates.spiritual,
      intellectual_rate: row.areaRates.intellectual,
      physical_rate: row.areaRates.physical,
      social_rate: row.areaRates.social,
      overallRate: row.averageRate,
      cumulativeRate: row.cumulativeAverageRate,
      hasRecords: row.hasRecords,
    })),
    cumulativeAreaRates: {
      spiritual_rate: cumulativeAreas.spiritual,
      intellectual_rate: cumulativeAreas.intellectual,
      physical_rate: cumulativeAreas.physical,
      social_rate: cumulativeAreas.social,
    },
    cumulativeOverall: excel.totalAchievementRate,
    recordCount: excel.recordCount,
    outOfPeriodRecordCount: excel.outOfPeriodRecordCount,
  };
}

export type MoksilgiExcelYearSummaryRow = MoksilgiYearSummaryRow & {
  /** 엑셀 "평균" */
  overallRate: number;
  /** 현재 달성률: 평균 ÷ 코칭 기간 개월 수 */
  currentRate: number;
};

/**
 * 엑셀 요약(1~12월) → 기존 연간 성취표 row 타입.
 * total_rate = 엑셀 "1~4 종합", average_rate·overallRate = 엑셀 "평균".
 */
export function toMoksilgiExcelYearSummaryRows(
  excel: MoksilgiExcelSummary,
  durationMonths: number,
): { rows: MoksilgiExcelYearSummaryRow[]; cumulativeRow: MoksilgiExcelYearSummaryRow } {
  const toRow = (
    month: number | "cumulative",
    monthLabel: string,
    areaRates: MoksilgiExcelAreaRates,
    totalRate: number,
    averageRate: number,
  ): MoksilgiExcelYearSummaryRow => ({
    month,
    monthLabel,
    spiritual_rate: areaRates.spiritual,
    intellectual_rate: areaRates.intellectual,
    physical_rate: areaRates.physical,
    social_rate: areaRates.social,
    other_rate: 0,
    total_rate: totalRate,
    average_rate: averageRate,
    overallRate: averageRate,
    currentRate: calculateCurrentAchievementRate(averageRate, durationMonths),
  });

  return {
    rows: excel.rows.map((row) =>
      toRow(row.month, `${row.month}월`, row.areaRates, row.totalRate, row.averageRate),
    ),
    cumulativeRow: toRow(
      "cumulative",
      "누적",
      excel.cumulative.areaRates,
      excel.cumulative.totalRate,
      excel.cumulative.averageRate,
    ),
  };
}
