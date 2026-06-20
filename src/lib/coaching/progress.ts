import type { Json, MoksilgiAreaKey, Tables } from "@/types/database";

type GoalAreaRow = Pick<
  Tables<"moksilgi_goal_areas">,
  "id" | "area_key" | "area_title" | "sort_order"
>;
type DetailGoalRow = Pick<
  Tables<"moksilgi_detail_goals">,
  "id" | "area_id" | "title" | "sort_order"
>;
type MonthlyRecordRow = Pick<
  Tables<"moksilgi_monthly_records">,
  "detail_goal_id" | "daily_checks_json"
>;

type SupportedAreaKey = Extract<
  MoksilgiAreaKey,
  "spiritual" | "intellectual" | "physical" | "social"
>;

export type TodayAreaProgress = {
  areaId: string;
  areaKey: SupportedAreaKey;
  areaTitle: string;
  completedGoals: number;
  totalGoals: number;
  completionRate: number;
};

export type TodayProgressSnapshot = {
  totalCompletedGoals: number;
  totalGoals: number;
  overallRate: number;
  areas: TodayAreaProgress[];
};

export function calculateCompletionRate(
  completedGoals: number,
  totalGoals: number,
) {
  if (totalGoals <= 0) {
    return 0;
  }

  return Math.round((completedGoals / totalGoals) * 100);
}

function isRecord(value: Json | null): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChecked(value: Json | undefined) {
  return value === true;
}

export function isGoalCheckedForToday(
  dailyChecksJson: Json | null,
  todayDateKey: string,
  todayDayKey: string,
) {
  if (!isRecord(dailyChecksJson)) {
    return false;
  }

  return (
    isChecked(dailyChecksJson[todayDateKey]) || isChecked(dailyChecksJson[todayDayKey])
  );
}

export function mergeDailyCheckStateForToday(
  dailyChecksJson: Json | null,
  todayDateKey: string,
  todayDayKey: string,
  checked: boolean,
): Json {
  const base = isRecord(dailyChecksJson) ? { ...dailyChecksJson } : {};
  const nextValue: Json = checked;

  return {
    ...base,
    [todayDateKey]: nextValue,
    [todayDayKey]: nextValue,
  };
}

const AREA_KEYS: SupportedAreaKey[] = [
  "spiritual",
  "intellectual",
  "physical",
  "social",
];

export function calculateTodayProgressSnapshot({
  areas,
  detailGoals,
  monthlyRecords,
  todayDateKey,
  todayDayOfMonth,
}: {
  areas: GoalAreaRow[];
  detailGoals: DetailGoalRow[];
  monthlyRecords: MonthlyRecordRow[];
  todayDateKey: string;
  todayDayOfMonth: number;
}): TodayProgressSnapshot {
  const todayDayKey = String(todayDayOfMonth);
  const recordByDetailGoalId = new Map(
    monthlyRecords.map((record) => [record.detail_goal_id, record]),
  );

  const areaProgress = areas
    .filter((area): area is GoalAreaRow & { area_key: SupportedAreaKey } =>
      AREA_KEYS.includes(area.area_key as SupportedAreaKey),
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((area) => {
      const goals = detailGoals
        .filter((goal) => goal.area_id === area.id)
        .sort((a, b) => a.sort_order - b.sort_order);

      const completedGoals = goals.reduce((count, goal) => {
        const record = recordByDetailGoalId.get(goal.id);

        if (
          record &&
          isGoalCheckedForToday(record.daily_checks_json, todayDateKey, todayDayKey)
        ) {
          return count + 1;
        }

        return count;
      }, 0);

      return {
        areaId: area.id,
        areaKey: area.area_key,
        areaTitle: area.area_title,
        completedGoals,
        totalGoals: goals.length,
        completionRate: calculateCompletionRate(completedGoals, goals.length),
      } satisfies TodayAreaProgress;
    });

  const totalGoals = areaProgress.reduce((sum, area) => sum + area.totalGoals, 0);
  const totalCompletedGoals = areaProgress.reduce(
    (sum, area) => sum + area.completedGoals,
    0,
  );

  return {
    totalCompletedGoals,
    totalGoals,
    overallRate: calculateCompletionRate(totalCompletedGoals, totalGoals),
    areas: areaProgress,
  };
}
