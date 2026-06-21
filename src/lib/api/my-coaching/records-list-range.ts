import { getTodayDateInTimezone } from "@/lib/timezone";

/** 기본 목록 조회: 최근 90일(약 3개월) */
export const RECORDS_DEFAULT_LOOKBACK_DAYS = 90;

/** 검색·필터 활성 시 확장 조회: 최근 365일 */
export const RECORDS_SEARCH_LOOKBACK_DAYS = 365;

export type RecordsListDateRange = {
  fromDate: string;
  toDate: string;
  minYear: number;
  minMonth: number;
};

function dateKeyFromUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractDaysFromDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return dateKeyFromUtcDate(date);
}

function parseYearMonthFromDateKey(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  return { year, month };
}

/**
 * records 목록 API용 날짜 범위.
 * expanded=true: 검색어·필터 활성 시 더 넓은 범위.
 */
export function buildRecordsListDateRange(
  timezone: string,
  expanded: boolean,
  referenceDate = new Date(),
): RecordsListDateRange {
  const toDate = getTodayDateInTimezone(timezone, referenceDate);
  const lookbackDays = expanded
    ? RECORDS_SEARCH_LOOKBACK_DAYS
    : RECORDS_DEFAULT_LOOKBACK_DAYS;
  const fromDate = subtractDaysFromDateKey(toDate, lookbackDays);
  const { year: minYear, month: minMonth } = parseYearMonthFromDateKey(fromDate);

  return { fromDate, toDate, minYear, minMonth };
}
