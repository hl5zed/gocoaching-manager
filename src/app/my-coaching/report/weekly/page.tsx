import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getMyCoachingMe } from "@/lib/api/my-coaching/me";
import { getMyCoachingFeedback } from "@/lib/api/my-coaching/feedback";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getCurrentWeekRangeInTimezone,
  resolveTimezoneFallback,
} from "@/lib/timezone";
import { calculateWeeklyAggregate, buildWeekDateKeys } from "@/lib/coaching/weekly-aggregate";
import type { Tables } from "@/types/database";

export const dynamic = "force-dynamic";

type ProfileTimezoneRow = Pick<Tables<"profiles">, "id" | "timezone" | "organization_id">;
type OrganizationTimezoneRow = Pick<Tables<"organizations">, "default_timezone">;
type GoalAreaRow = Pick<
  Tables<"moksilgi_goal_areas">,
  "id" | "area_key" | "area_title" | "sort_order"
>;
type DetailGoalRow = Pick<Tables<"moksilgi_detail_goals">, "id" | "area_id">;
type MonthlyRecordRow = Pick<
  Tables<"moksilgi_monthly_records">,
  "detail_goal_id" | "daily_checks_json" | "year" | "month"
>;

function formatDateRange(weekStart: string, weekEnd: string) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T00:00:00`);
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function barWidth(rate: number) {
  return `${Math.max(4, Math.min(100, rate))}%`;
}

export default async function MyCoachingWeeklyReportPage() {
  const me = await getMyCoachingMe();

  if (!me.ok && me.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Freport%2Fweekly");
  }

  if (!me.ok || !me.data.profile) {
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            주간 리포트를 불러올 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[WEEKLY_REPORT_SERVICE_CLIENT_UNAVAILABLE]", serviceClientError);
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            주간 리포트를 준비할 수 없습니다.
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
  const currentWeek = getCurrentWeekRangeInTimezone(effectiveTimezone);
  const weekDateKeys = buildWeekDateKeys({
    weekStart: currentWeek.weekStart,
    weekEnd: currentWeek.weekEnd,
  });

  const { data: activePlan } = await serviceClient
    .from("moksilgi_plans")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const planId = (activePlan as { id: string } | null)?.id ?? null;

  let aggregate = calculateWeeklyAggregate({
    areas: [],
    detailGoals: [],
    monthlyRecords: [],
    weekDateKeys,
  });

  if (planId) {
    const monthsInWeek = [
      ...new Set(
        weekDateKeys.map((dateKey) => {
          const date = new Date(`${dateKey}T00:00:00`);
          return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
          };
        }),
      ),
    ];

    const [areasResult, detailGoalsResult, recordsResult] = await Promise.all([
      serviceClient
        .from("moksilgi_goal_areas")
        .select("id, area_key, area_title, sort_order")
        .eq("plan_id", planId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
      serviceClient
        .from("moksilgi_detail_goals")
        .select("id, area_id")
        .eq("plan_id", planId)
        .is("deleted_at", null),
      Promise.all(
        monthsInWeek.map(({ year, month }) =>
          serviceClient
            .from("moksilgi_monthly_records")
            .select("detail_goal_id, daily_checks_json, year, month")
            .eq("plan_id", planId)
            .eq("profile_id", profileId)
            .eq("year", year)
            .eq("month", month)
            .is("deleted_at", null),
        ),
      ),
    ]);

    const allRecords: MonthlyRecordRow[] = recordsResult.flatMap(
      (result) => (result.data ?? []) as MonthlyRecordRow[],
    );

    aggregate = calculateWeeklyAggregate({
      areas: (areasResult.data ?? []) as GoalAreaRow[],
      detailGoals: (detailGoalsResult.data ?? []) as DetailGoalRow[],
      monthlyRecords: allRecords,
      weekDateKeys,
    });
  }

  const feedbackResult = await getMyCoachingFeedback();
  const latestFeedback =
    feedbackResult.data && feedbackResult.data.length > 0
      ? feedbackResult.data[0]
      : null;

  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
      <section className="mx-auto w-full max-w-md space-y-4">
        <Card className="border-line-base bg-surface-card">
          <CardHeader className="border-line-soft px-4 py-4">
            <Badge tone="info">주간 리포트</Badge>
            <CardTitle className="mt-2 text-xl">이번 주 실행 리포트</CardTitle>
            <p className="text-xs text-ink-muted">
              {formatDateRange(currentWeek.weekStart, currentWeek.weekEnd)} ·{" "}
              {effectiveTimezone}
            </p>
          </CardHeader>
        </Card>

        <Card className="border-line-base bg-surface-card">
          <CardHeader className="border-line-soft px-4 py-3">
            <CardTitle className="text-base">요일별 실행률</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {aggregate.dailyPoints.map((point) => (
              <div className="space-y-1" key={point.dateKey}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted">{point.dayLabel}</span>
                  <span className="font-semibold text-ink-base">
                    {point.completionRate}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-sunken">
                  <div
                    className="h-2 rounded-full bg-brand-600"
                    style={{ width: barWidth(point.completionRate) }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-line-base bg-surface-card">
          <CardHeader className="border-line-soft px-4 py-3">
            <CardTitle className="text-base">4영역 주간 실행률</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {aggregate.areaPoints.map((area) => (
              <div key={area.areaKey}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-muted">{area.areaTitle}</span>
                  <span className="font-semibold text-ink-base">
                    {area.completionRate}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-sunken">
                  <div
                    className="h-2 rounded-full bg-emerald-600"
                    style={{ width: barWidth(area.completionRate) }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-line-base bg-surface-card">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm">
              가장 잘한 영역:{" "}
              <span className="font-semibold">
                {aggregate.bestArea?.areaTitle ?? "데이터 없음"}
              </span>
            </p>
            <p className="text-sm">
              가장 부족한 영역:{" "}
              <span className="font-semibold">
                {aggregate.weakestArea?.areaTitle ?? "데이터 없음"}
              </span>
            </p>
            <p className="text-sm text-ink-muted">
              다음 주 제안: {aggregate.nextWeekSuggestion}
            </p>
          </CardContent>
        </Card>

        <Card className="border-line-base bg-surface-card">
          <CardHeader className="border-line-soft px-4 py-3">
            <CardTitle className="text-base">코치 피드백 요약</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {latestFeedback ? (
              <>
                <p className="text-sm whitespace-pre-wrap">{latestFeedback.feedback_text}</p>
                <p className="text-xs text-ink-muted">
                  격려: {latestFeedback.encouragement ?? "-"}
                </p>
                <p className="text-xs text-ink-muted">
                  다음 단계: {latestFeedback.next_step ?? "-"}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                아직 받은 코치 피드백이 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
