export const DEFAULT_TIMEZONE = "Asia/Bangkok";

type DateParts = {
  day: number;
  month: number;
  year: number;
};

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function getEffectiveTimezone(profileTimezone?: string | null) {
  const timezone = profileTimezone?.trim();
  return timezone && isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
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
