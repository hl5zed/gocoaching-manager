import { calculateCompletionRate } from "@/lib/coaching/progress";
import type { Json, Tables } from "@/types/database";

type MonthlyRecordRow = Pick<
  Tables<"moksilgi_monthly_records">,
  "detail_goal_id" | "daily_checks_json"
>;

type AreaRates = {
  spiritual: number;
  intellectual: number;
  physical: number;
  social: number;
};

export type MonthlyDailyPoint = {
  day: number;
  dateKey: string;
  completionRate: number;
};

export type MonthlyViewSummary = {
  dailyPoints: MonthlyDailyPoint[];
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  overallRate: number;
  bestAreaKey: keyof AreaRates;
  weakestAreaKey: keyof AreaRates;
};

function isRecord(value: Json | null): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChecked(value: Json | undefined) {
  return value === true;
}

function dayDateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
    day,
  ).padStart(2, "0")}`;
}

function checkedOnDay(
  dailyChecksJson: Json | null,
  dateKey: string,
  dayKey: string,
): boolean {
  if (!isRecord(dailyChecksJson)) {
    return false;
  }

  return isChecked(dailyChecksJson[dateKey]) || isChecked(dailyChecksJson[dayKey]);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function toRoundedRate(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildMonthlyViewSummary({
  year,
  month,
  records,
  areaRates,
}: {
  year: number;
  month: number;
  records: MonthlyRecordRow[];
  areaRates: AreaRates;
}): MonthlyViewSummary {
  const totalDays = daysInMonth(year, month);
  const goals = [...new Set(records.map((record) => record.detail_goal_id))];
  const totalGoals = goals.length;
  const recordByGoal = new Map(records.map((record) => [record.detail_goal_id, record]));

  const dailyPoints: MonthlyDailyPoint[] = Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const dateKey = dayDateKey(year, month, day);
    const dayKey = String(day);
    const completed = goals.reduce((count, goalId) => {
      const record = recordByGoal.get(goalId);
      if (!record) return count;
      return checkedOnDay(record.daily_checks_json, dateKey, dayKey) ? count + 1 : count;
    }, 0);

    return {
      day,
      dateKey,
      completionRate: calculateCompletionRate(completed, totalGoals),
    };
  });

  let longestStreak = 0;
  let running = 0;

  for (const point of dailyPoints) {
    if (point.completionRate > 0) {
      running += 1;
      longestStreak = Math.max(longestStreak, running);
    } else {
      running = 0;
    }
  }

  let currentStreak = 0;
  for (let index = dailyPoints.length - 1; index >= 0; index -= 1) {
    if ((dailyPoints[index]?.completionRate ?? 0) > 0) {
      currentStreak += 1;
      continue;
    }
    break;
  }

  const activeDays = dailyPoints.filter((point) => point.completionRate > 0).length;
  const overallRate = toRoundedRate(
    (areaRates.spiritual +
      areaRates.intellectual +
      areaRates.physical +
      areaRates.social) /
      4,
  );

  const sortedAreas = (Object.entries(areaRates) as Array<[keyof AreaRates, number]>).sort(
    (a, b) => b[1] - a[1],
  );

  return {
    dailyPoints,
    activeDays,
    currentStreak,
    longestStreak,
    overallRate,
    bestAreaKey: sortedAreas[0]?.[0] ?? "spiritual",
    weakestAreaKey: sortedAreas.at(-1)?.[0] ?? "spiritual",
  };
}
