import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getMyCoachingFeedback } from "@/lib/api/my-coaching/feedback";
import { getMyCoachingMe } from "@/lib/api/my-coaching/me";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { resolveTimezoneFallback } from "@/lib/timezone";
import { buildMonthlyViewSummary } from "@/lib/coaching/monthly-view";
import type { Tables } from "@/types/database";

export const dynamic = "force-dynamic";

type SummaryRow = Pick<
  Tables<"moksilgi_monthly_summaries">,
  | "year"
  | "month"
  | "spiritual_rate"
  | "intellectual_rate"
  | "physical_rate"
  | "social_rate"
  | "average_rate"
  | "updated_at"
>;
type OrganizationTimezoneRow = Pick<Tables<"organizations">, "default_timezone">;
type RecordRow = Pick<Tables<"moksilgi_monthly_records">, "detail_goal_id" | "daily_checks_json">;

const AREA_LABEL: Record<"spiritual" | "intellectual" | "physical" | "social", string> = {
  spiritual: "영적",
  intellectual: "지적",
  physical: "육체적",
  social: "사회적",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function monthStartDate(year: number, month: number) {
  return new Date(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01T00:00:00`);
}

function parseYearMonth(
  timezone: string,
  params: Record<string, string | string[] | undefined>,
) {
  const now = new Date();
  const localFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  });
  const parts = localFormatter.formatToParts(now);
  const currentYear = Number(parts.find((part) => part.type === "year")?.value ?? now.getFullYear());
  const currentMonth = Number(parts.find((part) => part.type === "month")?.value ?? now.getMonth() + 1);

  const parsedYear = Number(firstParam(params.year) ?? currentYear);
  const parsedMonth = Number(firstParam(params.month) ?? currentMonth);

  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : currentYear;
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : currentMonth;

  return { year, month };
}

function monthNavigation(year: number, month: number) {
  const current = monthStartDate(year, month);
  const previous = new Date(current);
  previous.setMonth(previous.getMonth() - 1);
  const next = new Date(current);
  next.setMonth(next.getMonth() + 1);

  return {
    prevYear: previous.getFullYear(),
    prevMonth: previous.getMonth() + 1,
    nextYear: next.getFullYear(),
    nextMonth: next.getMonth() + 1,
  };
}

function rateValue(value: number | null | undefined) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(safe)));
}

function heatColor(rate: number) {
  if (rate >= 80) return "bg-emerald-600";
  if (rate >= 60) return "bg-emerald-500";
  if (rate >= 40) return "bg-emerald-400";
  if (rate > 0) return "bg-emerald-200";
  return "bg-surface-sunken";
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(monthStartDate(year, month));
}

function toReflectionLink(year: number, month: number) {
  return `/my-coaching/records/monthly?year=${encodeURIComponent(String(year))}&month=${encodeURIComponent(String(month))}`;
}

export default async function MyCoachingMonthlyReportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMyCoachingMe({
    includeRoles: false,
    includeRelationships: false,
  });
  if (!me.ok && me.error.code === "UNAUTHORIZED") {
    redirect("/login?redirectTo=%2Fmy-coaching%2Freport%2Fmonthly");
  }

  if (!me.ok || !me.data.profile) {
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            월간 리포트를 불러올 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();
  if (!serviceClient) {
    console.error("[MONTHLY_REPORT_SERVICE_CLIENT_UNAVAILABLE]", serviceClientError);
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            월간 리포트를 준비할 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  const profile = me.data.profile;
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
    .select("id")
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

  const timezone = resolveTimezoneFallback(
    profile.timezone ?? null,
    organizationTimezone,
    null,
  );
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { year, month } = parseYearMonth(timezone, resolvedSearchParams);
  const nav = monthNavigation(year, month);
  const planId = (activePlanResult.data as { id: string } | null)?.id ?? null;

  let summary: SummaryRow | null = null;
  let records: RecordRow[] = [];

  if (planId) {
    const [summaryResult, recordsResult] = await Promise.all([
      serviceClient
        .from("moksilgi_monthly_summaries")
        .select(
          "year, month, spiritual_rate, intellectual_rate, physical_rate, social_rate, average_rate, updated_at",
        )
        .eq("plan_id", planId)
        .eq("profile_id", profileId)
        .eq("year", year)
        .eq("month", month)
        .is("deleted_at", null)
        .maybeSingle(),
      serviceClient
        .from("moksilgi_monthly_records")
        .select("detail_goal_id, daily_checks_json")
        .eq("plan_id", planId)
        .eq("profile_id", profileId)
        .eq("year", year)
        .eq("month", month)
        .is("deleted_at", null),
    ]);

    summary = (summaryResult.data as SummaryRow | null) ?? null;
    records = (recordsResult.data ?? []) as RecordRow[];
  }

  const rates = {
    spiritual: rateValue(summary?.spiritual_rate),
    intellectual: rateValue(summary?.intellectual_rate),
    physical: rateValue(summary?.physical_rate),
    social: rateValue(summary?.social_rate),
  };

  const monthlyView = buildMonthlyViewSummary({
    year,
    month,
    records,
    areaRates: rates,
  });

  const feedbackResult = await getMyCoachingFeedback({ knownProfileId: profileId });
  const feedbackList = (feedbackResult.data ?? []).slice(0, 5);

  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
      <section className="mx-auto w-full max-w-md space-y-4">
        <Card className="border-line-base bg-surface-card">
          <CardHeader className="border-line-soft px-4 py-4">
            <Badge tone="info">월간 리포트</Badge>
            <CardTitle className="mt-2 text-xl">{monthLabel(year, month)}</CardTitle>
            <p className="text-xs text-ink-muted">기준 시간대: {timezone}</p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Link
                className="rounded border border-line-base px-2 py-1"
                href={`/my-coaching/report/monthly?year=${nav.prevYear}&month=${nav.prevMonth}`}
              >
                이전 달
              </Link>
              <Link
                className="rounded border border-line-base px-2 py-1"
                href={`/my-coaching/report/monthly?year=${nav.nextYear}&month=${nav.nextMonth}`}
              >
                다음 달
              </Link>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-line-base bg-surface-card">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm">
              월간 전체 실행률:{" "}
              <span className="font-semibold">{monthlyView.overallRate}%</span>
            </p>
            <p className="text-xs text-ink-muted">
              집계 최신 시각: {summary?.updated_at ? new Date(summary.updated_at).toLocaleString("ko-KR") : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-line-base bg-surface-card">
          <CardHeader className="border-line-soft px-4 py-3">
            <CardTitle className="text-base">4영역별 실행률</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {(Object.entries(rates) as Array<[keyof typeof rates, number]>).map(([key, rate]) => (
              <ProgressBar
                key={key}
                label={AREA_LABEL[key]}
                showValue
                value={rate}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="border-line-base bg-surface-card">
          <CardHeader className="border-line-soft px-4 py-3">
            <CardTitle className="text-base">일자별 실행률</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1">
              {monthlyView.dailyPoints.map((point) => (
                <div
                  className={`h-6 rounded ${heatColor(point.completionRate)}`}
                  key={point.dateKey}
                  title={`${point.day}일 ${point.completionRate}%`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">짙을수록 실행률이 높습니다.</p>
          </CardContent>
        </Card>

        <Card className="border-line-base bg-surface-card">
          <CardContent className="space-y-2 p-4 text-sm">
            <p>
              연속 실행일(현재):{" "}
              <span className="font-semibold">{monthlyView.currentStreak}일</span>
            </p>
            <p>
              연속 실행일(최장):{" "}
              <span className="font-semibold">{monthlyView.longestStreak}일</span>
            </p>
            <p>
              가장 꾸준한 영역:{" "}
              <span className="font-semibold">{AREA_LABEL[monthlyView.bestAreaKey]}</span>
            </p>
            <p>
              보완 필요 영역:{" "}
              <span className="font-semibold">{AREA_LABEL[monthlyView.weakestAreaKey]}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-line-base bg-surface-card">
          <CardHeader className="border-line-soft px-4 py-3">
            <CardTitle className="text-base">코치 피드백</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {feedbackList.length === 0 ? (
              <p className="text-sm text-ink-muted">아직 코치 피드백이 없습니다.</p>
            ) : (
              feedbackList.map((feedback) => (
                <article className="rounded border border-line-base p-3" key={feedback.id}>
                  <p className="text-sm whitespace-pre-wrap">{feedback.feedback_text}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    다음 단계: {feedback.next_step ?? "-"}
                  </p>
                </article>
              ))
            )}
          </CardContent>
        </Card>

        <ButtonLink
          className="w-full"
          href={toReflectionLink(year, month)}
          size="lg"
          variant="primary"
        >
          월간 회고 작성
        </ButtonLink>
      </section>
    </main>
  );
}
