import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { getMyCoachingMe } from "@/lib/api/my-coaching/me";
import {
  isGoalCheckedForToday,
  mergeDailyCheckStateForToday,
} from "@/lib/coaching/progress";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
  getTodayDateInTimezone,
  resolveTimezoneFallback,
} from "@/lib/timezone";
import type { Tables } from "@/types/database";
import {
  TodayCheckClient,
  type TodayCheckItem,
  type TodayCheckSaveResult,
} from "./TodayCheckClient";

export const dynamic = "force-dynamic";

type ProfileTimezoneRow = Pick<
  Tables<"profiles">,
  "id" | "timezone" | "organization_id"
>;
type OrganizationTimezoneRow = Pick<Tables<"organizations">, "default_timezone">;
type PlanRow = Pick<Tables<"moksilgi_plans">, "id">;
type GoalAreaRow = Pick<
  Tables<"moksilgi_goal_areas">,
  "id" | "area_key" | "area_title" | "sort_order"
>;
type DetailGoalRow = Pick<
  Tables<"moksilgi_detail_goals">,
  "id" | "area_id" | "title" | "sort_order" | "plan_id"
>;
type MonthlyRecordRow = Pick<
  Tables<"moksilgi_monthly_records">,
  "id" | "detail_goal_id" | "daily_checks_json" | "year" | "month" | "updated_at"
>;
type MonthlyRecordInsert = {
  plan_id: string;
  area_id: string;
  detail_goal_id: string;
  profile_id: string;
  year: number;
  month: number;
  achievement_rate: number;
  daily_checks_json: Tables<"moksilgi_monthly_records">["daily_checks_json"];
  weekly_counts_json: Tables<"moksilgi_monthly_records">["weekly_counts_json"];
  deleted_at: null;
};
type MonthlyRecordUpdate = {
  daily_checks_json: Tables<"moksilgi_monthly_records">["daily_checks_json"];
  updated_at: string;
};
type MonthlyRecordsTable = {
  insert: (values: MonthlyRecordInsert) => {
    select: (columns: "id") => {
      single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
    };
  };
  update: (values: MonthlyRecordUpdate) => {
    eq: (column: "id", value: string) => {
      eq: (column: "updated_at", value: string) => {
        select: (columns: "id") => {
          maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    };
  };
};

const FOUR_AREA_KEYS = ["spiritual", "intellectual", "physical", "social"] as const;

export default async function MyCoachingTodayCheckPage() {
  const me = await getMyCoachingMe();

  if (!me.ok && me.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Fcheck");
  }

  if (!me.ok || !me.data.profile) {
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            지금 오늘 실행 체크를 불러올 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[TODAY_CHECK_SERVICE_CLIENT_UNAVAILABLE]", serviceClientError);
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            오늘 실행 체크를 준비할 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  const profileId = me.data.profile.id;
  const { data: profileRow } = await serviceClient
    .from("profiles")
    .select("id, timezone, organization_id")
    .eq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  const profile = (profileRow as ProfileTimezoneRow | null) ?? null;
  let organizationTimezone: string | null = null;

  if (profile?.organization_id) {
    const { data: organizationRow } = await serviceClient
      .from("organizations")
      .select("default_timezone")
      .eq("id", profile.organization_id)
      .is("deleted_at", null)
      .maybeSingle();

    organizationTimezone =
      (organizationRow as OrganizationTimezoneRow | null)?.default_timezone ?? null;
  }

  const effectiveTimezone = resolveTimezoneFallback(
    profile?.timezone ?? null,
    organizationTimezone,
    null,
  );
  const todayDateKey = getTodayDateInTimezone(effectiveTimezone);
  const currentYear = getCurrentYearInTimezone(effectiveTimezone);
  const currentMonth = getCurrentMonthInTimezone(effectiveTimezone);
  const todayDayOfMonth = Number(todayDateKey.slice(-2));

  const { data: activePlan } = await serviceClient
    .from("moksilgi_plans")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = (activePlan as PlanRow | null) ?? null;

  if (!plan) {
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-line-base bg-surface-card">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">아직 목표가 없어요</p>
            <p className="mt-1 text-xs text-ink-muted">
              먼저 목실기에서 세부 목표를 작성해 주세요.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }
  const planId = plan.id;

  const monthlyRecordsTable = () =>
    serviceClient.from("moksilgi_monthly_records") as unknown as MonthlyRecordsTable;

  const [areasResult, detailGoalsResult, recordsResult] = await Promise.all([
    serviceClient
      .from("moksilgi_goal_areas")
      .select("id, area_key, area_title, sort_order")
      .eq("plan_id", planId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    serviceClient
      .from("moksilgi_detail_goals")
      .select("id, area_id, title, sort_order")
      .eq("plan_id", planId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    serviceClient
      .from("moksilgi_monthly_records")
      .select("id, detail_goal_id, daily_checks_json, year, month")
      .eq("plan_id", planId)
      .eq("profile_id", profileId)
      .eq("year", currentYear)
      .eq("month", currentMonth)
      .is("deleted_at", null),
  ]);

  const areas = ((areasResult.data ?? []) as GoalAreaRow[])
    .filter((area) => FOUR_AREA_KEYS.includes(area.area_key as (typeof FOUR_AREA_KEYS)[number]))
    .sort((a, b) => a.sort_order - b.sort_order);
  const detailGoals = (detailGoalsResult.data ?? []) as DetailGoalRow[];
  const records = (recordsResult.data ?? []) as MonthlyRecordRow[];
  const recordByGoalId = new Map(records.map((record) => [record.detail_goal_id, record]));

  const initialItems: TodayCheckItem[] = areas.flatMap((area) =>
    detailGoals
      .filter((goal) => goal.area_id === area.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((goal) => {
        const record = recordByGoalId.get(goal.id);

        return {
          areaKey: area.area_key as TodayCheckItem["areaKey"],
          areaTitle: area.area_title,
          goalId: goal.id,
          goalTitle: goal.title,
          isChecked: isGoalCheckedForToday(
            record?.daily_checks_json ?? null,
            todayDateKey,
            String(todayDayOfMonth),
          ),
          monthlyRecordId: record?.id ?? null,
        };
      }),
  );

  async function saveTodayCheckAction(input: {
    detailGoalId: string;
    checked: boolean;
  }): Promise<TodayCheckSaveResult> {
    "use server";

    const { client, error } = createSupabaseServiceClient();

    if (!client) {
      console.error("[TODAY_CHECK_SAVE_CLIENT_UNAVAILABLE]", error);
      return { ok: false, message: "저장할 수 없습니다. 잠시 후 다시 시도해 주세요." };
    }

    const { data: goalRow, error: goalError } = await client
      .from("moksilgi_detail_goals")
      .select("id, area_id, plan_id")
      .eq("id", input.detailGoalId)
      .eq("plan_id", planId)
      .is("deleted_at", null)
      .maybeSingle();

    const goal = (goalRow as DetailGoalRow | null) ?? null;
    if (goalError || !goal) {
      return { ok: false, message: "저장 대상 목표를 찾을 수 없습니다." };
    }

    const { data: existingRow, error: existingError } = await client
      .from("moksilgi_monthly_records")
      .select("id, detail_goal_id, daily_checks_json, year, month, updated_at")
      .eq("plan_id", planId)
      .eq("profile_id", profileId)
      .eq("detail_goal_id", goal.id)
      .eq("year", currentYear)
      .eq("month", currentMonth)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) {
      return { ok: false, message: "기존 체크 정보를 불러오지 못했습니다." };
    }

    const existing = (existingRow as MonthlyRecordRow | null) ?? null;
    const nextDailyChecksJson = mergeDailyCheckStateForToday(
      existing?.daily_checks_json ?? null,
      todayDateKey,
      String(todayDayOfMonth),
      input.checked,
    );

    if (!existing) {
      const { data: insertedRow, error: insertError } = await monthlyRecordsTable()
        .insert({
          plan_id: planId,
          area_id: goal.area_id,
          detail_goal_id: goal.id,
          profile_id: profileId,
          year: currentYear,
          month: currentMonth,
          achievement_rate: 0,
          daily_checks_json: nextDailyChecksJson,
          weekly_counts_json: {},
          deleted_at: null,
        })
        .select("id")
        .single();

      if (insertError || !insertedRow?.id) {
        return { ok: false, message: "저장에 실패했습니다. 다시 시도해 주세요." };
      }

      return {
        ok: true,
        message: "저장됨",
        monthlyRecordId: insertedRow.id,
      };
    }

    const now = new Date().toISOString();
    const updateWithVersion = async (
      recordId: string,
      updatedAt: string,
      dailyChecksJson: Tables<"moksilgi_monthly_records">["daily_checks_json"],
    ) =>
      monthlyRecordsTable()
        .update({
          daily_checks_json: dailyChecksJson,
          updated_at: now,
        })
        .eq("id", recordId)
        .eq("updated_at", updatedAt)
        .select("id")
        .maybeSingle();

    const firstTry = await updateWithVersion(
      existing.id,
      existing.updated_at,
      nextDailyChecksJson,
    );

    if (firstTry.error) {
      return { ok: false, message: "저장에 실패했습니다. 다시 시도해 주세요." };
    }

    if (firstTry.data?.id) {
      return { ok: true, message: "저장됨", monthlyRecordId: existing.id };
    }

    const { data: latestRow, error: latestError } = await client
      .from("moksilgi_monthly_records")
      .select("id, detail_goal_id, daily_checks_json, year, month, updated_at")
      .eq("id", existing.id)
      .is("deleted_at", null)
      .maybeSingle();

    const latest = (latestRow as MonthlyRecordRow | null) ?? null;
    if (latestError || !latest) {
      return { ok: false, message: "저장 충돌이 발생했습니다. 다시 시도해 주세요." };
    }

    const mergedWithLatest = mergeDailyCheckStateForToday(
      latest.daily_checks_json,
      todayDateKey,
      String(todayDayOfMonth),
      input.checked,
    );

    const secondTry = await updateWithVersion(
      latest.id,
      latest.updated_at,
      mergedWithLatest,
    );

    if (secondTry.error || !secondTry.data?.id) {
      return { ok: false, message: "저장 충돌이 발생했습니다. 다시 시도해 주세요." };
    }

    return { ok: true, message: "저장됨", monthlyRecordId: latest.id };
  }

  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
      <TodayCheckClient
        initialItems={initialItems}
        todayDateKey={todayDateKey}
        timezone={effectiveTimezone}
        onSaveCheck={saveTodayCheckAction}
      />
    </main>
  );
}
