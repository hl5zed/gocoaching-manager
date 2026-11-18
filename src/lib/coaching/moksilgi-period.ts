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
