import { Card, CardContent } from "@/components/ui/Card";
import { getWeekDateKeysFromDateKey } from "@/lib/timezone";
import type { Json } from "@/types/database";

type Props = {
  /** 오늘 날짜 (YYYY-MM-DD) */
  todayDateKey: string;
  /** 이번 주에 포함될 수 있는 월의 상세목표 daily_checks_json 배열 */
  records: Array<{ daily_checks_json: unknown; year: number; month: number }>;
};

type DayState = "done" | "today" | "todayDone" | "missed" | "future";

type WeekDayItem = {
  dateKey: string;
  dayOfMonth: number;
  weekdayLabel: string;
  state: DayState;
};

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

function isRecord(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChecked(value: Json | undefined): boolean {
  return value === true;
}

function isDayCheckedInRecord(
  dailyChecksJson: unknown,
  dateKey: string,
  dayKey: string,
  year: number,
  month: number,
): boolean {
  if (!isRecord(dailyChecksJson)) {
    return false;
  }

  if (isChecked(dailyChecksJson[dateKey])) {
    return true;
  }

  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  if (dateKey.startsWith(monthPrefix) && isChecked(dailyChecksJson[dayKey])) {
    return true;
  }

  return false;
}

function isAnyRecordCheckedForDay(
  records: Array<{ daily_checks_json: unknown; year: number; month: number }>,
  dateKey: string,
  dayKey: string,
): boolean {
  return records.some((record) =>
    isDayCheckedInRecord(
      record.daily_checks_json,
      dateKey,
      dayKey,
      record.year,
      record.month,
    ),
  );
}

function getWeekDays(todayDateKey: string): Array<{ dateKey: string; dayOfMonth: number }> {
  return getWeekDateKeysFromDateKey(todayDateKey).map((dateKey) => ({
    dateKey,
    dayOfMonth: Number(dateKey.slice(8, 10)),
  }));
}

function resolveDayState(
  dateKey: string,
  todayDateKey: string,
  checked: boolean,
): DayState {
  if (dateKey === todayDateKey) {
    return checked ? "todayDone" : "today";
  }
  if (dateKey > todayDateKey) {
    return "future";
  }
  if (checked) {
    return "done";
  }
  return "missed";
}

function dayButtonClassName(state: DayState): string {
  const base = "flex h-10 w-full items-center justify-center rounded-control text-xs font-semibold";

  switch (state) {
    case "done":
      return `${base} bg-emerald-500 text-white`;
    case "todayDone":
      return `${base} bg-emerald-500 text-white ring-2 ring-[#1a2744] ring-offset-2 ring-offset-surface-card`;
    case "today":
      return `${base} bg-[#1a2744] text-white`;
    case "missed":
      return `${base} bg-surface-sunken text-ink-muted`;
    case "future":
      return `${base} bg-surface-sunken text-ink-muted opacity-50`;
  }
}

function dayButtonLabel(state: DayState): string {
  switch (state) {
    case "done":
      return "✓";
    case "todayDone":
      return "오늘 완료";
    case "today":
      return "오늘";
    case "missed":
    case "future":
      return "";
  }
}

function dayStatusLabel(state: DayState): string {
  switch (state) {
    case "done":
      return "완료";
    case "todayDone":
      return "오늘 완료";
    case "today":
      return "오늘";
    case "future":
      return "예정";
    case "missed":
      return "미완료";
  }
}

export function WeeklyCheckStrip({ todayDateKey, records }: Props) {
  const weekDays = getWeekDays(todayDateKey);

  const items: WeekDayItem[] = weekDays.map((day, index) => {
    const dayKey = String(day.dayOfMonth);
    const checked = isAnyRecordCheckedForDay(
      records,
      day.dateKey,
      dayKey,
    );

    return {
      dateKey: day.dateKey,
      dayOfMonth: day.dayOfMonth,
      weekdayLabel: WEEKDAY_LABELS[index],
      state: resolveDayState(day.dateKey, todayDateKey, checked),
    };
  });

  return (
    <Card className="border-line-base bg-surface-card">
      <CardContent className="p-4">
        <p className="text-sm font-semibold text-ink-base">이번 주 일일 점검</p>
        <div className="mt-3 flex gap-1">
          {items.map((item) => (
            <div key={item.dateKey} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                aria-label={`${item.weekdayLabel} ${item.dayOfMonth}일 ${dayStatusLabel(item.state)}`}
                className={dayButtonClassName(item.state)}
                role="img"
              >
                {dayButtonLabel(item.state)}
                <span className="sr-only">{dayStatusLabel(item.state)}</span>
              </div>
              <span className="text-xs text-ink-muted">{item.weekdayLabel}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
