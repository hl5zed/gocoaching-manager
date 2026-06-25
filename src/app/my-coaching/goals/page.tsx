import {
  GrowthAreaGoalCard,
  GrowthCoreValueCard,
  GrowthSection,
} from "@/components/coachee/GrowthSection";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardContent, CardTitle } from "@/components/ui/Card";
import { requireCoacheePageProfile } from "@/lib/api/my-coaching/coachee-page-auth";
import {
  getMyMoksilgi,
  isMoksilgiVersionType,
  MOKSILGI_VERSION_TYPE_LABELS,
  type MoksilgiCoreValue,
} from "@/lib/api/my-coaching/moksilgi";
import { getLastApprovedVersion } from "@/lib/api/my-coaching/moksilgi-versions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
  resolveTimezoneFallback,
} from "@/lib/timezone";
import type { Json, MoksilgiAreaKey, Tables } from "@/types/database";


const FOUR_AREA_KEYS = [
  "spiritual",
  "intellectual",
  "physical",
  "social",
] as const satisfies readonly MoksilgiAreaKey[];

type FourAreaKey = (typeof FOUR_AREA_KEYS)[number];

const AREA_RATE_KEY: Record<
  FourAreaKey,
  "spiritual_rate" | "intellectual_rate" | "physical_rate" | "social_rate"
> = {
  spiritual: "spiritual_rate",
  intellectual: "intellectual_rate",
  physical: "physical_rate",
  social: "social_rate",
};

function areaCompletionRate(
  areaKey: FourAreaKey,
  summary: SummaryRow | null,
) {
  if (!summary) {
    return 0;
  }

  return rateValue(summary[AREA_RATE_KEY[areaKey]]);
}

type OrganizationTimezoneRow = Pick<Tables<"organizations">, "default_timezone">;
type SummaryRow = Pick<
  Tables<"moksilgi_monthly_summaries">,
  | "spiritual_rate"
  | "intellectual_rate"
  | "physical_rate"
  | "social_rate"
  | "average_rate"
  | "updated_at"
>;

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "아직 작성되지 않았습니다.";
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
    .filter(
      (item) =>
        item.value_name.trim().length > 0 ||
        item.meaning.trim().length > 0 ||
        item.practice_example.trim().length > 0,
    );
}

function rateValue(value: number | null | undefined) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(safe)));
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, 1));
}

export default async function MyCoachingGrowthPage() {
  const auth = await requireCoacheePageProfile("/my-coaching/goals");

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            나의 성장 화면을 불러올 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  const profile = auth.profile;
  const profileId = profile.id;

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[GROWTH_PAGE_SERVICE_CLIENT_UNAVAILABLE]", serviceClientError);
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            나의 성장 화면을 준비할 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  const orgTimezonePromise =
    profile.organization_id && !profile.timezone
      ? serviceClient
          .from("organizations")
          .select("default_timezone")
          .eq("id", profile.organization_id)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null as OrganizationTimezoneRow | null, error: null });

  const [moksilgi, organizationResult] = await Promise.all([
    getMyMoksilgi(profileId),
    orgTimezonePromise,
  ]);

  if (!moksilgi.ok) {
    return (
      <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            목실기 정보를 불러올 수 없습니다.
          </CardContent>
        </Card>
      </main>
    );
  }

  const plan = moksilgi.data.plan;
  const coreValues = plan ? parseCoreValues(plan.core_values_json) : [];
  const editHref = "/my-coaching/moksilgi";

  const organizationTimezone =
    (organizationResult.data as OrganizationTimezoneRow | null)?.default_timezone ?? null;

  const timezone = resolveTimezoneFallback(
    profile.timezone,
    organizationTimezone,
    null,
  );
  const year = getCurrentYearInTimezone(timezone);
  const month = getCurrentMonthInTimezone(timezone);

  const [summaryResult, lastApprovedResult] = await Promise.all([
    plan
      ? serviceClient
          .from("moksilgi_monthly_summaries")
          .select(
            "spiritual_rate, intellectual_rate, physical_rate, social_rate, average_rate, updated_at",
          )
          .eq("plan_id", plan.id)
          .eq("profile_id", profileId)
          .eq("year", year)
          .eq("month", month)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null as SummaryRow | null, error: null }),
    plan
      ? getLastApprovedVersion(plan.id)
      : Promise.resolve({ ok: true as const, data: null }),
  ]);

  const summary: SummaryRow | null = (summaryResult.data as SummaryRow | null) ?? null;

  const lastApproved = lastApprovedResult.ok ? lastApprovedResult.data : null;

  const currentVersionType = isMoksilgiVersionType(plan?.version_type)
    ? plan.version_type
    : null;

  const targetAreas = moksilgi.data.areas
    .filter(
      (area): area is (typeof moksilgi.data.areas)[number] & { area_key: FourAreaKey } =>
        FOUR_AREA_KEYS.includes(area.area_key as FourAreaKey),
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  const goalsByArea = new Map<string, string[]>();
  for (const goal of moksilgi.data.detailGoals) {
    const current = goalsByArea.get(goal.area_id) ?? [];
    current.push(goal.title);
    goalsByArea.set(goal.area_id, current);
  }

  return (
    <main className="min-h-screen bg-surface-app px-4 py-5 text-ink-base">
      <section className="mx-auto w-full max-w-md space-y-4">
        {/* 헤더 */}
        <Card className="border-line-base bg-surface-card">
          <CardContent className="p-4">
            <Badge tone="info">나의 성장</Badge>
            <CardTitle className="mt-2 text-xl text-ink-strong">삶의 방향과 실천</CardTitle>
            <p className="mt-1 text-xs text-ink-muted">
              {monthLabel(year, month)} 실행률 기준 · {timezone}
            </p>
          </CardContent>
        </Card>

        {!plan ? (
          /* 계획 없음 */
          <Card className="border-line-base bg-surface-card">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-ink-base">
                아직 목실기 계획이 없습니다. 먼저 삶의 방향과 목표를 작성해 주세요.
              </p>
              <ButtonLink href={editHref} size="sm" variant="primary">
                목표 설계 시작하기
              </ButtonLink>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 안내 + 수정 CTA (단일 진입점) */}
            <Card className="border-line-base bg-surface-card">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm leading-6 text-ink-muted">
                  미션·비전·핵심가치·목표를 <span className="font-medium text-ink-base">기억하고 확인하는 곳</span>이에요.{" "}
                  내용을 고칠 때는 목표 설계 화면에서 수정해 주세요.
                </p>
                <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                  <svg aria-hidden className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                    <path d="M5 11h14v10H5z" />
                  </svg>
                  코치도 이 내용을 확인할 수 있어요
                </p>
                {currentVersionType && currentVersionType !== "approved" ? (
                  <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <span aria-hidden>⚠️</span>
                    현재 상태:{" "}
                    <span className="font-semibold">
                      {MOKSILGI_VERSION_TYPE_LABELS[currentVersionType]}
                    </span>
                    {lastApproved ? ` · 코치 승인본: v${lastApproved.version_number}` : ""}
                  </p>
                ) : currentVersionType === "approved" && lastApproved ? (
                  <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    <span aria-hidden>✓</span>
                    코치 승인 완료{" "}
                    <span className="font-semibold">v{lastApproved.version_number}</span>
                    {lastApproved.approved_at
                      ? ` · ${new Date(lastApproved.approved_at).toLocaleDateString("ko-KR")}`
                      : ""}
                  </p>
                ) : null}
                <ButtonLink className="w-full" href={editHref} size="sm" variant="primary">
                  목표 설계 화면 열기
                </ButtonLink>
              </CardContent>
            </Card>

            <GrowthSection title="미션">
              <p className="whitespace-pre-wrap">{displayValue(plan.mission_statement)}</p>
              {plan.mission_description?.trim() ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-ink-muted">
                  {plan.mission_description}
                </p>
              ) : null}
            </GrowthSection>

            <GrowthSection title="비전">
              <p className="whitespace-pre-wrap">{displayValue(plan.vision_statement)}</p>
              {plan.vision_description?.trim() ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-ink-muted">
                  {plan.vision_description}
                </p>
              ) : null}
            </GrowthSection>

            <GrowthSection title="핵심가치">
              {coreValues.length === 0 ? (
                <p className="text-ink-muted">등록된 핵심가치가 없습니다.</p>
              ) : (
                <div className="grid gap-3">
                  {coreValues.map((value, index) => (
                    <GrowthCoreValueCard
                      key={`${value.value_name}-${index}`}
                      meaning={value.meaning}
                      practiceExample={value.practice_example}
                      valueName={value.value_name || `핵심가치 ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </GrowthSection>

            <GrowthSection title="장기 목표">
              <p className="whitespace-pre-wrap">{displayValue(plan.main_goal)}</p>
              {plan.main_goal_description?.trim() ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-ink-muted">
                  {plan.main_goal_description}
                </p>
              ) : null}
            </GrowthSection>

            <GrowthSection title="4영역 목표와 실행률">
              <p className="mb-3 text-xs text-ink-muted">
                방향(목표)과 이번 달 실천(실행률)을 함께 확인합니다.
                {summary?.updated_at
                  ? ` 집계 최신: ${new Date(summary.updated_at).toLocaleString("ko-KR")}`
                  : ""}
              </p>
              <div className="space-y-3">
                {targetAreas.map((area) => (
                  <GrowthAreaGoalCard
                    areaSubtitle={area.area_subtitle}
                    areaTitle={area.area_title}
                    completionRate={areaCompletionRate(area.area_key, summary)}
                    detailGoalTitles={goalsByArea.get(area.id) ?? []}
                    key={area.id}
                  />
                ))}
              </div>
            </GrowthSection>
          </>
        )}
      </section>
    </main>
  );
}
