import { requireCoacheePageProfile } from "@/lib/api/my-coaching/coachee-page-auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TodayAreaCard } from "@/components/coachee/TodayAreaCard";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { MoksilgiCoreValue } from "@/lib/api/my-coaching/moksilgi";
import {
  calculateTodayProgressSnapshot,
  type TodayAreaProgress,
} from "@/lib/coaching/progress";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
  getTodayDateInTimezone,
  getWeekMonthKeysFromDateKey,
  resolveTimezoneFallback,
} from "@/lib/timezone";
import type { Json, Tables } from "@/types/database";
import { revalidatePath } from "next/cache";
import { saveMyMoksilgiMonthlyRecord } from "@/lib/api/my-coaching/moksilgi-monthly";
import { TodayTodoList, type TodayTodo } from "@/components/coachee/TodayTodoList";
import { WeeklyCheckStrip } from "@/components/coachee/WeeklyCheckStrip";

export const dynamic = "force-dynamic";

type OrganizationTimezoneRow = Pick<Tables<"organizations">, "default_timezone">;
type PlanRow = Pick<Tables<"moksilgi_plans">, "id" | "title" | "core_values_json">;
type GoalAreaRow = Pick<
  Tables<"moksilgi_goal_areas">,
  "id" | "area_key" | "area_title" | "sort_order"
>;
type DetailGoalRow = Pick<
  Tables<"moksilgi_detail_goals">,
  "id" | "area_id" | "title" | "sort_order" | "measurement_type"
>;
type MonthlyRecordRow = Pick<
  Tables<"moksilgi_monthly_records">,
  "detail_goal_id" | "daily_checks_json" | "year" | "month"
>;

const FOUR_AREA_KEYS = ["spiritual", "intellectual", "physical", "social"] as const;

const FALLBACK_AREA_TITLES: Record<(typeof FOUR_AREA_KEYS)[number], string> = {
  spiritual: "영적 목표",
  intellectual: "지적 목표",
  physical: "신체적 목표",
  social: "사회적 목표",
};

function formatTodayLabel(todayDateKey: string, timezone: string) {
  const date = new Date(`${todayDateKey}T00:00:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone,
    weekday: "short",
  }).format(date);
}

function ensureFourAreas(areas: TodayAreaProgress[]): TodayAreaProgress[] {
  const areaByKey = new Map(areas.map((area) => [area.areaKey, area]));

  return FOUR_AREA_KEYS.map((key) => {
    const existing = areaByKey.get(key);

    if (existing) {
      return existing;
    }

    return {
      areaId: key,
      areaKey: key,
      areaTitle: FALLBACK_AREA_TITLES[key],
      completedGoals: 0,
      totalGoals: 0,
      completionRate: 0,
    };
  });
}

function parseCoreValues(value: Json): MoksilgiCoreValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return null;
      }

      return {
        value_name: typeof item.value_name === "string" ? item.value_name : "",
        meaning: typeof item.meaning === "string" ? item.meaning : "",
        practice_example:
          typeof item.practice_example === "string" ? item.practice_example : "",
      };
    })
    .filter((item): item is MoksilgiCoreValue => item !== null)
    .filter((item) => item.value_name.trim().length > 0);
}

const TODO_AREA_KEYS = ["spiritual", "intellectual", "physical", "social"] as const;

function isTodoAreaKey(
  value: string,
): value is (typeof TODO_AREA_KEYS)[number] {
  return (TODO_AREA_KEYS as readonly string[]).includes(value);
}

function collectCheckedDays(value: Json, year: number, month: number): Set<number> {
  const days = new Set<number>();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return days;
  }
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  for (const [key, checked] of Object.entries(value)) {
    if (!checked) {
      continue;
    }
    if (/^\d{1,2}$/.test(key)) {
      const day = Number(key);
      if (day >= 1 && day <= 31) {
        days.add(day);
      }
    } else if (key.startsWith(monthPrefix)) {
      const day = Number(key.slice(-2));
      if (day >= 1 && day <= 31) {
        days.add(day);
      }
    }
  }
  return days;
}

function buildTodayTodos({
  areas,
  detailGoals,
  records,
  year,
  month,
  todayDay,
}: {
  areas: GoalAreaRow[];
  detailGoals: DetailGoalRow[];
  records: MonthlyRecordRow[];
  year: number;
  month: number;
  todayDay: number;
}): TodayTodo[] {
  const areaById = new Map(areas.map((area) => [area.id, area]));
  const recordByGoal = new Map(
    records.map((record) => [record.detail_goal_id, record]),
  );

  const todos: TodayTodo[] = [];
  for (const goal of detailGoals) {
    if (goal.measurement_type !== "daily_check") {
      continue;
    }
    const area = areaById.get(goal.area_id);
    if (!area) {
      continue;
    }
    const areaKey = area.area_key;
    if (!isTodoAreaKey(areaKey)) {
      continue;
    }
    const record = recordByGoal.get(goal.id);
    const checkedDays = record
      ? collectCheckedDays(record.daily_checks_json, year, month)
      : new Set<number>();
    const otherCheckedDays = Array.from(checkedDays).filter(
      (day) => day !== todayDay,
    );
    todos.push({
      detailGoalId: goal.id,
      title: goal.title,
      areaKey,
      areaTitle: area.area_title,
      checkedToday: checkedDays.has(todayDay),
      otherCheckedDays,
    });
  }
  return todos;
}

async function toggleTodayCheckAction(formData: FormData) {
  "use server";

  await saveMyMoksilgiMonthlyRecord(formData);
  revalidatePath("/my-coaching");
}

export default async function MyCoachingPage() {
  const auth = await requireCoacheePageProfile("/my-coaching");

  if (!auth.ok && auth.reason === "fetch_failed") {
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            지금 오늘의 목표를 불러올 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!auth.ok && auth.reason === "no_profile") {
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-line-base bg-surface-card">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-ink-base">아직 프로필이 없어요.</p>
            <ButtonLink href="/profile" size="sm" variant="secondary">
              프로필 확인하기
            </ButtonLink>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!auth.ok) {
    return null;
  }

  const profile = auth.profile;

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[MY_COACHING_HOME_SERVICE_CLIENT_UNAVAILABLE]", serviceClientError);
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            지금 오늘의 목표를 준비할 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  const profileId = profile.id;

  const orgTimezonePromise =
    profile.organization_id && !profile.timezone
      ? serviceClient
          .from("organizations")
          .select("default_timezone")
          .eq("id", profile.organization_id)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null as OrganizationTimezoneRow | null, error: null });

  const activePlanPromise = serviceClient
    .from("moksilgi_plans")
    .select("id, title, core_values_json")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [organizationResult, activePlanResult] = await Promise.all([
    orgTimezonePromise,
    activePlanPromise,
  ]);

  const organizationTimezone =
    (organizationResult.data as OrganizationTimezoneRow | null)?.default_timezone ?? null;

  const effectiveTimezone = resolveTimezoneFallback(
    profile.timezone,
    organizationTimezone,
    null,
  );
  const todayDateKey = getTodayDateInTimezone(effectiveTimezone);
  const todayLabel = formatTodayLabel(todayDateKey, effectiveTimezone);
  const currentYear = getCurrentYearInTimezone(effectiveTimezone);
  const currentMonth = getCurrentMonthInTimezone(effectiveTimezone);
  const currentDay = Number(todayDateKey.slice(-2));

  const plan = (activePlanResult.data as PlanRow | null) ?? null;
  let areaCards = ensureFourAreas([]);
  let totalGoals = 0;
  let totalCompletedGoals = 0;
  let overallRate = 0;
  let todayTodos: TodayTodo[] = [];
  let monthlyRecords: MonthlyRecordRow[] = [];

  if (plan) {
    const weekMonthKeys = getWeekMonthKeysFromDateKey(todayDateKey);
    const recordsQuery = serviceClient
      .from("moksilgi_monthly_records")
      .select("detail_goal_id, daily_checks_json, year, month")
      .eq("plan_id", plan.id)
      .eq("profile_id", profileId)
      .is("deleted_at", null);
    const weeklyRecordsPromise =
      weekMonthKeys.length === 1
        ? recordsQuery
            .eq("year", weekMonthKeys[0].year)
            .eq("month", weekMonthKeys[0].month)
        : recordsQuery.or(
            weekMonthKeys
              .map((key) => `and(year.eq.${key.year},month.eq.${key.month})`)
              .join(","),
          );
    const [areasResult, detailGoalsResult, recordsResult] = await Promise.all([
      serviceClient
        .from("moksilgi_goal_areas")
        .select("id, area_key, area_title, sort_order")
        .eq("plan_id", plan.id)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
      serviceClient
        .from("moksilgi_detail_goals")
        .select("id, area_id, title, sort_order, measurement_type")
        .eq("plan_id", plan.id)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
      weeklyRecordsPromise,
    ]);
    const records = ((recordsResult.data ?? []) as MonthlyRecordRow[]);
    const currentMonthRecords = records.filter(
      (record) => record.year === currentYear && record.month === currentMonth,
    );

    const progress = calculateTodayProgressSnapshot({
      areas: ((areasResult.data ?? []) as GoalAreaRow[]).filter(
        (area) => area.area_key !== "other",
      ),
      detailGoals: (detailGoalsResult.data ?? []) as DetailGoalRow[],
      monthlyRecords: currentMonthRecords,
      todayDateKey,
      todayDayOfMonth: currentDay,
    });

    areaCards = ensureFourAreas(progress.areas);
    totalGoals = progress.totalGoals;
    totalCompletedGoals = progress.totalCompletedGoals;
    overallRate = progress.overallRate;
    todayTodos = buildTodayTodos({
      areas: (areasResult.data ?? []) as GoalAreaRow[],
      detailGoals: (detailGoalsResult.data ?? []) as DetailGoalRow[],
      records: currentMonthRecords,
      year: currentYear,
      month: currentMonth,
      todayDay: currentDay,
    });
    monthlyRecords = records;
  }

  const userName =
    profile.display_name ??
    profile.full_name ??
    profile.email ??
    auth.authEmail ??
    "피코치";

  const coreValues = plan ? parseCoreValues(plan.core_values_json) : [];

  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
      <section className="mx-auto w-full max-w-md space-y-4">
        <Card className="border-line-base bg-surface-card">
          <CardHeader className="border-line-soft px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Badge tone="info">오늘의 목표</Badge>
                <CardTitle className="text-xl">{userName}님의 오늘</CardTitle>
                <p className="text-xs text-ink-muted">
                  {todayLabel} · {effectiveTimezone}
                </p>
              </div>
              <LanguageSwitcher />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="rounded-control border border-line-soft bg-surface-sunken p-3">
              <p className="text-sm font-semibold text-ink-base">오늘 전체 실행률</p>
              <p className="mt-1 text-xs text-ink-muted">
                완료 {totalCompletedGoals} / 대상 {totalGoals}
              </p>
              <ProgressBar className="mt-2" showValue value={overallRate} />
            </div>

            {totalGoals > 0 && totalCompletedGoals < totalGoals ? (
              <div className="rounded-control border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-800">
                  오늘 미완료 {totalGoals - totalCompletedGoals}개가 남아 있어요
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  남은 목표를 마무리하고 오늘 기록을 완성해 보세요.
                </p>
              </div>
            ) : null}

            {totalGoals > 0 && totalCompletedGoals === totalGoals ? (
              <div className="rounded-control border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-800">
                  오늘 목표를 모두 완료했어요
                </p>
              </div>
            ) : null}

            {totalGoals === 0 ? (
              <Card className="border-line-base bg-surface-card">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-ink-base">
                    아직 목표가 없어요
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    목실기에서 4영역 목표를 먼저 작성해 주세요.
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>

        {coreValues.length > 0 ? (
          <Card className="border-line-base bg-surface-card">
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-semibold text-ink-base">
                오늘 기억할 핵심가치
              </p>
              <div className="flex flex-wrap gap-2">
                {coreValues.map((value, index) => (
                  <Badge key={`${value.value_name}-${index}`} tone="info">
                    {value.value_name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {areaCards.map((area) => (
            <TodayAreaCard area={area} key={area.areaKey} />
          ))}
        </section>

        {todayTodos.length > 0 ? (
          <TodayTodoList
            action={toggleTodayCheckAction}
            month={currentMonth}
            today={currentDay}
            todos={todayTodos}
            year={currentYear}
          />
        ) : null}

        {plan ? (
          <WeeklyCheckStrip
            records={monthlyRecords.map((record) => ({
              daily_checks_json: record.daily_checks_json,
              month: record.month,
              year: record.year,
            }))}
            todayDateKey={todayDateKey}
          />
        ) : null}

        <Card className="border-line-base bg-surface-card">
          <CardContent className="space-y-3 p-4">
            <ButtonLink
              className="w-full"
              href="/my-coaching/records/daily"
              size="md"
              variant="primary"
            >
              오늘 기록하기
            </ButtonLink>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ButtonLink
                className="w-full"
                href="/my-coaching/moksilgi/monthly"
                size="sm"
                variant="secondary"
              >
                이번 달 체크
              </ButtonLink>
              <ButtonLink
                className="w-full"
                href="/my-coaching/moksilgi/summary"
                size="sm"
                variant="secondary"
              >
                월별 요약
              </ButtonLink>
            </div>

            <ButtonLink
              className="w-full"
              href="/my-coaching/goals"
              size="sm"
              variant="secondary"
            >
              나의 성장 보기
            </ButtonLink>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
