import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { MoksilgiAreaKey, Tables } from "@/types/database";
import type { ActiveRoleSlim } from "@/types/profile";

const COACH_LEVEL_ROLES = new Set([
  "coach",
  "coach_maker",
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
]);
const AREA_KEYS: MoksilgiAreaKey[] = [
  "spiritual",
  "intellectual",
  "physical",
  "social",
  "other",
];

type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;
type SafeError = {
  code:
    | "UNAUTHORIZED"
    | "PROFILE_NOT_FOUND"
    | "PROFILE_QUERY_FAILED"
    | "ROLES_QUERY_FAILED"
    | "ACCESS_DENIED"
    | "MOKSILGI_QUERY_FAILED"
    | "RELATIONSHIPS_QUERY_FAILED"
    | "COACHEE_PROFILE_QUERY_FAILED"
    | "GOALS_QUERY_FAILED"
    | "SUMMARY_QUERY_FAILED"
    | "NOT_FOUND";
  message: string;
};
type ProfileIdRow = { id: string };
type CoacheeProfileRow = {
  display_name: string | null;
  full_name: string | null;
  email: string | null;
};
type PlanRow = Pick<
  Tables<"moksilgi_plans">,
  | "id"
  | "profile_id"
  | "title"
  | "subtitle"
  | "period_start"
  | "period_end"
  | "written_at"
  | "author_name"
  | "region_name"
  | "team_name"
  | "regional_leader_name"
  | "coach_name"
  | "role_label"
  | "generation_label"
  | "mission_statement"
  | "mission_bible_verse"
  | "mission_description"
  | "vision_year"
  | "vision_statement"
  | "vision_metrics"
  | "vision_target"
  | "vision_description"
  | "core_values_json"
  | "main_goal"
  | "main_goal_description"
  | "status"
  | "created_at"
  | "updated_at"
>;
export type CoachMoksilgiGoalArea = Pick<
  Tables<"moksilgi_goal_areas">,
  "id" | "area_key" | "area_title" | "area_subtitle" | "sort_order"
>;
export type CoachMoksilgiDetailGoal = Pick<
  Tables<"moksilgi_detail_goals">,
  | "id"
  | "area_id"
  | "title"
  | "description"
  | "annual_target"
  | "monthly_target"
  | "unit"
  | "measurement_type"
  | "strategies_json"
  | "sort_order"
  | "created_at"
  | "updated_at"
>;
type SummaryRow = Pick<
  Tables<"moksilgi_monthly_summaries">,
  | "month"
  | "spiritual_rate"
  | "intellectual_rate"
  | "physical_rate"
  | "social_rate"
  | "other_rate"
  | "total_rate"
  | "average_rate"
>;

export type CoachMoksilgiSummaryRow = {
  month: number | "cumulative";
  monthLabel: string;
  spiritual_rate: number;
  intellectual_rate: number;
  physical_rate: number;
  social_rate: number;
  other_rate: number;
  total_rate: number;
  average_rate: number;
};

export type CoachMoksilgiDetail = {
  plan: PlanRow;
  coachee: CoacheeProfileRow | null;
  areas: CoachMoksilgiGoalArea[];
  detailGoals: CoachMoksilgiDetailGoal[];
  summaryRows: CoachMoksilgiSummaryRow[];
  cumulativeRow: CoachMoksilgiSummaryRow;
  totalAchievementRate: number;
  hasSummaryData: boolean;
  year: number;
};

export type CoachMoksilgiDetailResult =
  | { data: CoachMoksilgiDetail; error: null }
  | { data: null; error: SafeError };

function getServiceClientResult():
  | { ok: true; serviceClient: ServiceSupabaseClient }
  | { ok: false; error: SafeError } {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    console.error("[COACH_MOKSILGI_DETAIL_SERVICE_CLIENT_UNAVAILABLE]", error);
    return {
      ok: false,
      error: {
        code: "MOKSILGI_QUERY_FAILED",
        message: "지금 목실기 상세 정보를 불러올 수 없습니다.",
      },
    };
  }

  return { ok: true, serviceClient: client };
}

function validateYear(year: number) {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summaryValue(
  summary: SummaryRow | undefined,
  key:
    | "spiritual_rate"
    | "intellectual_rate"
    | "physical_rate"
    | "social_rate"
    | "other_rate"
    | "total_rate"
    | "average_rate",
) {
  return safeNumber(summary?.[key]);
}

function buildSummaryRows(summaries: SummaryRow[]) {
  const summaryByMonth = new Map(summaries.map((summary) => [summary.month, summary]));

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const summary = summaryByMonth.get(month);

    return {
      month,
      monthLabel: `${month}월`,
      spiritual_rate: summaryValue(summary, "spiritual_rate"),
      intellectual_rate: summaryValue(summary, "intellectual_rate"),
      physical_rate: summaryValue(summary, "physical_rate"),
      social_rate: summaryValue(summary, "social_rate"),
      other_rate: summaryValue(summary, "other_rate"),
      total_rate: summaryValue(summary, "total_rate"),
      average_rate: summaryValue(summary, "average_rate"),
    } satisfies CoachMoksilgiSummaryRow;
  });
}

function buildCumulativeRow(
  rows: CoachMoksilgiSummaryRow[],
  activeAreaKeys: MoksilgiAreaKey[],
) {
  const areaRates: Record<MoksilgiAreaKey, number> = {
    spiritual: average(rows.map((row) => row.spiritual_rate)),
    intellectual: average(rows.map((row) => row.intellectual_rate)),
    physical: average(rows.map((row) => row.physical_rate)),
    social: average(rows.map((row) => row.social_rate)),
    other: average(rows.map((row) => row.other_rate)),
  };
  const activeRates = activeAreaKeys.map((key) => areaRates[key]);

  return {
    month: "cumulative",
    monthLabel: "누적",
    spiritual_rate: areaRates.spiritual,
    intellectual_rate: areaRates.intellectual,
    physical_rate: areaRates.physical,
    social_rate: areaRates.social,
    other_rate: areaRates.other,
    total_rate: AREA_KEYS.reduce((sum, key) => sum + areaRates[key], 0),
    average_rate: activeRates.length > 0 ? average(activeRates) : 0,
  } satisfies CoachMoksilgiSummaryRow;
}

export async function getCoachMoksilgiDetail(
  planId: string,
  year: number,
): Promise<CoachMoksilgiDetailResult> {
  const selectedYear = validateYear(year) ? year : new Date().getFullYear();
  const session = await getSession();

  if (!session.user) {
    return { data: null, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } };
  }

  const supabase = await createSupabaseServerClient();
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = supabase
    .from("profiles")
    .select("id")
    .is("deleted_at", null)
    .neq("status", "anonymized");

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError) {
    return { data: null, error: { code: "PROFILE_QUERY_FAILED", message: "프로필을 조회하는 중 오류가 발생했습니다." } };
  }

  if (!profile) {
    return { data: null, error: { code: "PROFILE_NOT_FOUND", message: "아직 프로필이 생성되지 않았습니다." } };
  }

  const profileId = (profile as ProfileIdRow).id;
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("id, role, scope_type, scope_id, granted_at, expires_at")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (rolesError) {
    return { data: null, error: { code: "ROLES_QUERY_FAILED", message: "역할 정보를 조회하는 중 오류가 발생했습니다." } };
  }

  const hasCoachAccess = ((roles ?? []) as ActiveRoleSlim[]).some((role) =>
    COACH_LEVEL_ROLES.has(role.role),
  );

  if (!hasCoachAccess) {
    return { data: null, error: { code: "ACCESS_DENIED", message: "코치 권한이 없습니다." } };
  }

  const serviceClientResult = getServiceClientResult();

  if (!serviceClientResult.ok) {
    return { data: null, error: serviceClientResult.error };
  }

  const { serviceClient } = serviceClientResult;
  const { data: plan, error: planError } = await serviceClient
    .from("moksilgi_plans")
    .select(
      "id, profile_id, title, subtitle, period_start, period_end, written_at, author_name, region_name, team_name, regional_leader_name, coach_name, role_label, generation_label, mission_statement, mission_bible_verse, mission_description, vision_year, vision_statement, vision_metrics, vision_target, vision_description, core_values_json, main_goal, main_goal_description, status, created_at, updated_at",
    )
    .eq("id", planId)
    .is("deleted_at", null)
    .maybeSingle();

  if (planError) {
    return { data: null, error: { code: "MOKSILGI_QUERY_FAILED", message: "목실기를 조회하는 중 오류가 발생했습니다." } };
  }

  if (!plan) {
    return { data: null, error: { code: "NOT_FOUND", message: "해당 목실기를 찾을 수 없습니다." } };
  }

  const planRow = plan as PlanRow;
  const { data: relationship, error: relationshipError } = await serviceClient
    .from("coaching_relationships")
    .select("id")
    .eq("coach_profile_id", profileId)
    .eq("coachee_profile_id", planRow.profile_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (relationshipError) {
    return { data: null, error: { code: "RELATIONSHIPS_QUERY_FAILED", message: "코칭 관계를 조회하는 중 오류가 발생했습니다." } };
  }

  if (!relationship) {
    return { data: null, error: { code: "NOT_FOUND", message: "해당 목실기를 찾을 수 없습니다." } };
  }

  const [coacheeResult, areasResult, detailGoalsResult, summariesResult] =
    await Promise.all([
      serviceClient
        .from("profiles")
        .select("display_name, full_name, email")
        .eq("id", planRow.profile_id)
        .is("deleted_at", null)
        .maybeSingle(),
      serviceClient
        .from("moksilgi_goal_areas")
        .select("id, area_key, area_title, area_subtitle, sort_order")
        .eq("plan_id", planRow.id)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
      serviceClient
        .from("moksilgi_detail_goals")
        .select("id, area_id, title, description, annual_target, monthly_target, unit, measurement_type, strategies_json, sort_order, created_at, updated_at")
        .eq("plan_id", planRow.id)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
      serviceClient
        .from("moksilgi_monthly_summaries")
        .select("month, spiritual_rate, intellectual_rate, physical_rate, social_rate, other_rate, total_rate, average_rate")
        .eq("plan_id", planRow.id)
        .eq("profile_id", planRow.profile_id)
        .eq("year", selectedYear)
        .is("deleted_at", null)
        .order("month", { ascending: true }),
    ]);

  if (coacheeResult.error) {
    return { data: null, error: { code: "COACHEE_PROFILE_QUERY_FAILED", message: "코치이 정보를 조회하는 중 오류가 발생했습니다." } };
  }

  if (areasResult.error || detailGoalsResult.error) {
    return { data: null, error: { code: "GOALS_QUERY_FAILED", message: "목실기 목표를 조회하는 중 오류가 발생했습니다." } };
  }

  if (summariesResult.error) {
    return { data: null, error: { code: "SUMMARY_QUERY_FAILED", message: "목실기 요약을 조회하는 중 오류가 발생했습니다." } };
  }

  const areas = (areasResult.data ?? []) as CoachMoksilgiGoalArea[];
  const detailGoals = (detailGoalsResult.data ?? []) as CoachMoksilgiDetailGoal[];
  const summaries = (summariesResult.data ?? []) as SummaryRow[];
  const activeAreaKeys = [
    ...new Set(
      areas
        .filter((area) => detailGoals.some((goal) => goal.area_id === area.id))
        .map((area) => area.area_key),
    ),
  ];
  const summaryRows = buildSummaryRows(summaries);
  const cumulativeRow = buildCumulativeRow(
    summaryRows,
    activeAreaKeys.length > 0 ? activeAreaKeys : AREA_KEYS,
  );

  return {
    data: {
      plan: planRow,
      coachee: (coacheeResult.data ?? null) as CoacheeProfileRow | null,
      areas,
      detailGoals,
      summaryRows,
      cumulativeRow,
      totalAchievementRate: cumulativeRow.average_rate,
      hasSummaryData: summaries.length > 0,
      year: selectedYear,
    },
    error: null,
  };
}
