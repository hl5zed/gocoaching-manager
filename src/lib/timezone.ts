export const DEFAULT_TIMEZONE = "Asia/Bangkok";
export const TIMEZONE_OPTIONS = [
  "Asia/Bangkok",
  "Asia/Seoul",
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
] as const;

type DateParts = {
  day: number;
  month: number;
  year: number;
};

export function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(timezone?: string | null) {
  const trimmed = timezone?.trim();
  return trimmed && isValidTimezone(trimmed) ? trimmed : null;
}

export function getEffectiveTimezone(profileTimezone?: string | null) {
  return normalizeTimezone(profileTimezone) ?? DEFAULT_TIMEZONE;
}

export function resolveTimezoneFallback(
  profileTimezone?: string | null,
  organizationTimezone?: string | null,
  systemTimezone?: string | null,
) {
  return (
    normalizeTimezone(profileTimezone) ??
    normalizeTimezone(organizationTimezone) ??
    normalizeTimezone(systemTimezone) ??
    DEFAULT_TIMEZONE
  );
}

export function getClientTimezone() {
  if (typeof Intl === "undefined") return DEFAULT_TIMEZONE;

  return getEffectiveTimezone(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
}

function getDatePartsInTimezone(date: Date, timezone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: getEffectiveTimezone(timezone),
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    day: value("day"),
    month: value("month"),
    year: value("year"),
  };
}

function dateKeyFromParts(parts: DateParts) {
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyFromUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateInTimezone(
  timezone: string,
  referenceDate = new Date(),
) {
  return dateKeyFromParts(
    getDatePartsInTimezone(referenceDate, getEffectiveTimezone(timezone)),
  );
}

export function getCurrentYearInTimezone(
  timezone: string,
  referenceDate = new Date(),
) {
  return getDatePartsInTimezone(referenceDate, getEffectiveTimezone(timezone)).year;
}

export function getCurrentMonthInTimezone(
  timezone: string,
  referenceDate = new Date(),
) {
  return getDatePartsInTimezone(referenceDate, getEffectiveTimezone(timezone)).month;
}

export function getCurrentWeekRangeInTimezone(
  timezone: string,
  referenceDate = new Date(),
) {
  const today = getDatePartsInTimezone(referenceDate, getEffectiveTimezone(timezone));
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day));
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(date);
  weekStart.setUTCDate(date.getUTCDate() + diffToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  return {
    weekEnd: dateKeyFromUtcDate(weekEnd),
    weekStart: dateKeyFromUtcDate(weekStart),
  };
}

/** YYYY-MM-DD 달력 날짜 기준 월~일 7일 date key (서버 TZ와 무관한 UTC 달력 연산). */
export function getWeekDateKeysFromDateKey(dateKey: string): string[] {
  const parsed = parseDateOnly(dateKey);
  if (!parsed) {
    return [];
  }

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12));
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);

  const keys: string[] = [];
  for (let index = 0; index < 7; index += 1) {
    const cursor = new Date(monday);
    cursor.setUTCDate(monday.getUTCDate() + index);
    keys.push(dateKeyFromUtcDate(cursor));
  }

  return keys;
}

/** 이번 주(월~일)에 걸치는 year/month 목록 — 주간 records fetch용. */
export function getWeekMonthKeysFromDateKey(
  dateKey: string,
): Array<{ year: number; month: number }> {
  const monthKeys = new Map<string, { year: number; month: number }>();

  for (const key of getWeekDateKeysFromDateKey(dateKey)) {
    const parsed = parseDateOnly(key);
    if (!parsed) {
      continue;
    }
    monthKeys.set(`${parsed.year}-${parsed.month}`, {
      year: parsed.year,
      month: parsed.month,
    });
  }

  return [...monthKeys.values()];
}

function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
}

function dateFromValue(value: string | Date) {
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateInTimezone(
  value: string | Date | null | undefined,
  timezone: string,
) {
  if (!value) return "-";

  if (typeof value === "string") {
    const dateOnly = parseDateOnly(value);
    if (dateOnly) {
      return new Intl.DateTimeFormat("ko-KR", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
        year: "numeric",
      }).format(new Date(Date.UTC(dateOnly.year, dateOnly.month - 1, dateOnly.day)));
    }
  }

  const date = dateFromValue(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "short",
    timeZone: getEffectiveTimezone(timezone),
    year: "numeric",
  }).format(date);
}

export function formatDateTimeInTimezone(
  value: string | Date | null | undefined,
  timezone: string,
) {
  if (!value) return "-";

  const date = dateFromValue(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: getEffectiveTimezone(timezone),
    year: "numeric",
  }).format(date);
}
