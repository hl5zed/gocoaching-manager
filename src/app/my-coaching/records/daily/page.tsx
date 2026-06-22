import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getSession } from "@/lib/auth/getSession";
import { I18nText } from "@/lib/i18n/I18nProvider";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
  resolveTimezoneFallback,
} from "@/lib/timezone";
import type { Tables } from "@/types/database";
import { DailyRecordsClient } from "./DailyRecordsClient";

export const dynamic = "force-dynamic";

type DailyContextProfileRow = Pick<
  Tables<"profiles">,
  "id" | "timezone" | "organization_id"
>;
type OrganizationTimezoneRow = Pick<Tables<"organizations">, "default_timezone">;
type ActivePlanRow = Pick<Tables<"moksilgi_plans">, "id">;
type DailyContextSummaryRow = Pick<
  Tables<"moksilgi_monthly_summaries">,
  "total_rate" | "year" | "month"
>;

export default async function DailyRecordsPage() {
  const session = await getSession();

  if (!session.user) {
    redirect("/login?redirectTo=%2Fmy-coaching%2Frecords%2Fdaily");
  }

  let monthlyContext: { totalRate: number; year: number; month: number } | null =
    null;

  const { client: serviceClient } = createSupabaseServiceClient();

  if (serviceClient) {
    const { data: profileRow } = await serviceClient
      .from("profiles")
      .select("id, timezone, organization_id")
      .eq("auth_user_id", session.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    const profile = (profileRow as DailyContextProfileRow | null) ?? null;

    if (profile) {
      const orgTimezonePromise =
        profile.organization_id && !profile.timezone
          ? serviceClient
              .from("organizations")
              .select("default_timezone")
              .eq("id", profile.organization_id)
              .is("deleted_at", null)
              .maybeSingle()
          : Promise.resolve({
              data: null as OrganizationTimezoneRow | null,
              error: null,
            });

      const activePlanPromise = serviceClient
        .from("moksilgi_plans")
        .select("id")
        .eq("profile_id", profile.id)
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
        (organizationResult.data as OrganizationTimezoneRow | null)?.default_timezone ??
        null;

      const timezone = resolveTimezoneFallback(
        profile.timezone ?? null,
        organizationTimezone,
        null,
      );
      const year = getCurrentYearInTimezone(timezone);
      const month = getCurrentMonthInTimezone(timezone);

      const plan = (activePlanResult.data as ActivePlanRow | null) ?? null;

      if (plan) {
        const { data: summaryRow } = await serviceClient
          .from("moksilgi_monthly_summaries")
          .select("total_rate, year, month")
          .eq("plan_id", plan.id)
          .eq("profile_id", profile.id)
          .eq("year", year)
          .eq("month", month)
          .is("deleted_at", null)
          .maybeSingle();

        const summary = (summaryRow as DailyContextSummaryRow | null) ?? null;

        if (summary) {
          monthlyContext = {
            totalRate: summary.total_rate,
            year,
            month,
          };
        }
      }
    }
  }

  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
      <section className="mx-auto w-full max-w-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
              <I18nText k="myCoaching.records.dailyPage.badge" fallback="오늘 기록" />
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              <I18nText k="myCoaching.records.dailyPage.title" fallback="오늘 기록하기" />
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              <I18nText
                k="myCoaching.records.dailyPage.description"
                fallback="짧게 기록하고 코치 공유 여부를 선택할 수 있어요."
              />
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <LanguageSwitcher />
          </div>
        </div>

        {monthlyContext ? (
          <div className="mt-4 rounded-control border border-line-soft bg-surface-sunken p-3">
            <p className="text-sm font-semibold text-ink-base">
              이번 달 누적 실행률 {monthlyContext.totalRate.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {monthlyContext.year}년 {monthlyContext.month}월 기준 · 오늘 기록이 이
              수치에 반영됩니다.
            </p>
          </div>
        ) : null}

        <DailyRecordsClient mode="today" returnTo="/my-coaching" />
      </section>
    </main>
  );
}
