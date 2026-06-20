import {
  calculateCompletionRate,
  isGoalCheckedForToday,
} from "@/lib/coaching/progress";
import type { Tables } from "@/types/database";

type GoalAreaRow = Pick<
  Tables<"moksilgi_goal_areas">,
  "id" | "area_key" | "area_title" | "sort_order"
>;
type DetailGoalRow = Pick<Tables<"moksilgi_detail_goals">, "id" | "area_id">;
type MonthlyRecordRow = Pick<
  Tables<"moksilgi_monthly_records">,
  "detail_goal_id" | "daily_checks_json" | "year" | "month"
>;

export type WeekDayPoint = {
  dateKey: string;
  dayLabel: string;
  completionRate: number;
};

export type WeeklyAreaPoint = {
  areaKey: "spiritual" | "intellectual" | "physical" | "social";
  areaTitle: string;
  completionRate: number;
};

export type WeeklyAggregateResult = {
  dailyPoints: WeekDayPoint[];
  areaPoints: WeeklyAreaPoint[];
  bestArea: WeeklyAreaPoint | null;
  weakestArea: WeeklyAreaPoint | null;
  nextWeekSuggestion: string;
};

const AREA_ORDER: WeeklyAreaPoint["areaKey"][] = [
  "spiritual",
  "intellectual",
  "physical",
  "social",
];

function safeDateKeyToDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function dateLabel(dateKey: string) {
  const date = safeDateKeyToDate(dateKey);

  return new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
  }).format(date);
}

function dayOfMonth(dateKey: string) {
  return Number(dateKey.slice(-2));
}

function recordMapByGoalAndMonth(records: MonthlyRecordRow[]) {
  const map = new Map<string, MonthlyRecordRow>();

  for (const record of records) {
    const key = `${record.detail_goal_id}:${record.year}:${record.month}`;
    map.set(key, record);
  }

  return map;
}

export function buildWeekDateKeys({
  weekStart,
  weekEnd,
}: {
  weekStart: string;
  weekEnd: string;
}) {
  const start = safeDateKeyToDate(weekStart);
  const end = safeDateKeyToDate(weekEnd);
  const dateKeys: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    dateKeys.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }

  return dateKeys;
}

export function calculateWeeklyAggregate({
  areas,
  detailGoals,
  monthlyRecords,
  weekDateKeys,
}: {
  areas: GoalAreaRow[];
  detailGoals: DetailGoalRow[];
  monthlyRecords: MonthlyRecordRow[];
  weekDateKeys: string[];
}): WeeklyAggregateResult {
  const targetAreas = areas
    .filter(
      (area): area is GoalAreaRow & { area_key: WeeklyAreaPoint["areaKey"] } =>
        AREA_ORDER.includes(area.area_key as WeeklyAreaPoint["areaKey"]),
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  const goalsByArea = new Map<string, DetailGoalRow[]>();
  for (const area of targetAreas) {
    goalsByArea.set(
      area.id,
      detailGoals.filter((goal) => goal.area_id === area.id),
    );
  }

  const allGoals = targetAreas.flatMap((area) => goalsByArea.get(area.id) ?? []);
  const totalGoals = allGoals.length;
  const recordMap = recordMapByGoalAndMonth(monthlyRecords);

  const dailyPoints = weekDateKeys.map((dateKey) => {
    const date = safeDateKeyToDate(dateKey);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const dayKey = String(dayOfMonth(dateKey));

    const completedCount = allGoals.reduce((count, goal) => {
      const record = recordMap.get(`${goal.id}:${year}:${month}`);
      if (!record) {
        return count;
      }

      return isGoalCheckedForToday(record.daily_checks_json, dateKey, dayKey)
        ? count + 1
        : count;
    }, 0);

    return {
      dateKey,
      dayLabel: dateLabel(dateKey),
      completionRate: calculateCompletionRate(completedCount, totalGoals),
    };
  });

  const areaPoints = targetAreas.map((area) => {
    const areaGoals = goalsByArea.get(area.id) ?? [];

    let completedChecks = 0;
    for (const dateKey of weekDateKeys) {
      const date = safeDateKeyToDate(dateKey);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const dayKey = String(dayOfMonth(dateKey));

      for (const goal of areaGoals) {
        const record = recordMap.get(`${goal.id}:${year}:${month}`);
        if (!record) {
          continue;
        }

        if (isGoalCheckedForToday(record.daily_checks_json, dateKey, dayKey)) {
          completedChecks += 1;
        }
      }
    }

    const areaTotalChecks = areaGoals.length * weekDateKeys.length;

    return {
      areaKey: area.area_key,
      areaTitle: area.area_title,
      completionRate: calculateCompletionRate(completedChecks, areaTotalChecks),
    } satisfies WeeklyAreaPoint;
  });

  const sortedByRate = [...areaPoints].sort(
    (a, b) => b.completionRate - a.completionRate,
  );
  const bestArea = sortedByRate[0] ?? null;
  const weakestArea = sortedByRate.at(-1) ?? null;

  let nextWeekSuggestion = "이번 주 흐름을 유지하며 작은 실행 한 가지를 꾸준히 이어가 보세요.";
  if (weakestArea) {
    nextWeekSuggestion = `${weakestArea.areaTitle} 영역의 목표를 하루 1개부터 체크해 보세요.`;
  }

  return {
    dailyPoints,
    areaPoints,
    bestArea,
    weakestArea,
    nextWeekSuggestion,
  };
}
