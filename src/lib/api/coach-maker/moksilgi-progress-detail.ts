import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { calculateCoachingDurationMonths } from "@/lib/coaching/moksilgi-year-summary";
import {
  buildMoksilgiExcelSummary,
  toMoksilgiExcelYearSummaryRows,
  toMoksilgiPeriodSummary,
} from "@/lib/coaching/moksilgi-excel-rates";
import {
  buildMoksilgiPeriodMonths,
  type MoksilgiPeriodMonth,
  type MoksilgiPeriodSummary,
} from "@/lib/coaching/moksilgi-period";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Tables, UserRole } from "@/types/database";
import type { ActiveRoleSlim } from "@/types/profile";

const ALLOWED_ROLES = new Set<UserRole>([
  "coach_maker",
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
]);
const BROAD_ACCESS_ROLES = new Set<UserRole>([
  "organization_admin",
  "country_admin",
  "super_admin",
]);

type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;
type ProfileIdRow = { id: string };
type RelationshipRow = { coachee_profile_id: string };
type PersonProfileRow = {
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
export type CoachMakerMoksilgiProgressGoalArea = Pick<
  Tables<"moksilgi_goal_areas">,
  "id" | "area_key" | "area_title" | "area_subtitle" | "sort_order"
>;
export type CoachMakerMoksilgiProgressDetailGoal = Pick<
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

export type CoachMakerMoksilgiProgressSummaryRow = {
  month: number | "cumulative";
  monthLabel: string;
  spiritual_rate: number;
  intellectual_rate: number;
  physical_rate: number;
  social_rate: number;
  other_rate: number;
  total_rate: number;
  average_rate: number;
  /** 엑셀 "평균": 영역 달성률 합(total_rate) ÷ 목표가 있는 영역 수 */
  overallRate: number;
  /** 현재 달성률: 평균 ÷ 코칭 기간 개월 수 */
  currentRate: number;
};

export type CoachMakerMoksilgiProgressDetail = {
  plan: PlanRow;
  person: PersonProfileRow | null;
  areas: CoachMakerMoksilgiProgressGoalArea[];
  detailGoals: CoachMakerMoksilgiProgressDetailGoal[];
  summaryRows: CoachMakerMoksilgiProgressSummaryRow[];
  cumulativeRow: CoachMakerMoksilgiProgressSummaryRow;
  totalAchievementRate: number;
  durationMonths: number;
  hasSummaryData: boolean;
  year: number;
  scopeMode: "all" | "direct_coaching_relationships";
  /** 기획안 기간 기준 집계 — 기간이 없거나 잘못된 경우 null */
  periodSummary: CoachMakerMoksilgiPeriodSummary | null;
};

export type CoachMakerMoksilgiPeriodSummary = MoksilgiPeriodSummary & {
  periodMonths: MoksilgiPeriodMonth[];
};

type PeriodRecordRow = Pick<
  Tables<"moksilgi_monthly_records">,
  "detail_goal_id" | "year" | "month" | "actual_value"
>;

/** 코칭 기간 미설정 시 사용하는 기본 개월 수 */
const DEFAULT_DURATION_MONTHS = 12;

type MonthlyRecordRateRow = Pick<
  Tables<"moksilgi_monthly_records">,
  "detail_goal_id" | "month" | "actual_value"
>;

type SafeError = {
  code:
    | "UNAUTHORIZED"
    | "PROFILE_NOT_FOUND"
    | "PROFILE_QUERY_FAILED"
    | "ROLES_QUERY_FAILED"
    | "ACCESS_DENIED"
    | "RELATIONSHIPS_QUERY_FAILED"
    | "MOKSILGI_QUERY_FAILED"
    | "PERSON_PROFILE_QUERY_FAILED"
    | "GOALS_QUERY_FAILED"
    | "SUMMARY_QUERY_FAILED"
    | "NOT_FOUND";
  message: string;
};

export type GetCoachMakerMoksilgiProgressDetailResult =
  | { data: CoachMakerMoksilgiProgressDetail; error: null }
  | { data: null; error: SafeError };

function getServiceClientResult():
  | { ok: true; serviceClient: ServiceSupabaseClient }
  | { ok: false; error: SafeError } {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    console.error("[COACH_MAKER_MOKSILGI_PROGRESS_DETAIL_SERVICE_CLIENT_UNAVAILABLE]", error);
    return {
      ok: false,
      error: {
        code: "MOKSILGI_QUERY_FAILED",
        message: "지금 목실기 상세 현황을 불러올 수 없습니다.",
      },
    };
  }

  return { ok: true, serviceClient: client };
}

function validateYear(year: number) {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

async function getAccessibleProfileIds(
  serviceClient: ServiceSupabaseClient,
  profileId: string,
  roleValues: UserRole[],
): Promise<
  | { ok: true; profileIds: string[] | null; scopeMode: "all" | "direct_coaching_relationships" }
  | { ok: false; error: SafeError }
> {
  const hasBroadAccess = roleValues.some((role) => BROAD_ACCESS_ROLES.has(role));

  if (hasBroadAccess) {
    return { ok: true, profileIds: null, scopeMode: "all" };
  }

  const { data: relationships, error: relationshipsError } = await serviceClient
    .from("coaching_relationships")
    .select("coachee_profile_id")
    .eq("coach_profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (relationshipsError) {
    return {
      ok: false,
      error: {
        code: "RELATIONSHIPS_QUERY_FAILED",
        message: "코칭 관계를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  return {
    ok: true,
    profileIds: [
      ...new Set(
        ((relationships ?? []) as RelationshipRow[]).map(
          (relationship) => relationship.coachee_profile_id,
        ),
      ),
    ],
    scopeMode: "direct_coaching_relationships",
  };
}

export async function getCoachMakerMoksilgiProgressDetail(
  planId: string,
  year: number,
): Promise<GetCoachMakerMoksilgiProgressDetailResult> {
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
    .eq("status", "active");
  const buildRolesQuery = (rolesProfileId: string) =>
    supabase
      .from("user_roles")
      .select("id, role, scope_type, scope_id, granted_at, expires_at")
      .eq("profile_id", rolesProfileId)
      .eq("status", "active")
      .eq("is_active", true)
      .is("deleted_at", null);

  // 미들웨어가 검증한 profile id가 있으면 profile과 roles를 동시에 조회한다.
  const [profileResult, earlyRolesResult] = await Promise.all([
    verifiedProfileId
      ? profileQuery.eq("id", verifiedProfileId).maybeSingle()
      : profileQuery.eq("auth_user_id", session.user.id).maybeSingle(),
    verifiedProfileId ? buildRolesQuery(verifiedProfileId) : Promise.resolve(null),
  ]);
  const { data: profile, error: profileError } = profileResult;

  if (profileError) {
    return { data: null, error: { code: "PROFILE_QUERY_FAILED", message: "프로필을 조회하는 중 오류가 발생했습니다." } };
  }

  if (!profile) {
    return { data: null, error: { code: "PROFILE_NOT_FOUND", message: "아직 프로필이 생성되지 않았습니다." } };
  }

  const profileId = (profile as ProfileIdRow).id;
  const { data: roles, error: rolesError } =
    earlyRolesResult ?? (await buildRolesQuery(profileId));

  if (rolesError) {
    return { data: null, error: { code: "ROLES_QUERY_FAILED", message: "역할 정보를 조회하는 중 오류가 발생했습니다." } };
  }

  const roleValues = ((roles ?? []) as ActiveRoleSlim[]).map((role) => role.role);
  const hasAllowedRole = roleValues.some((role) => ALLOWED_ROLES.has(role));

  if (!hasAllowedRole) {
    return { data: null, error: { code: "ACCESS_DENIED", message: "코치메이커 권한이 없습니다." } };
  }

  const serviceClientResult = getServiceClientResult();

  if (!serviceClientResult.ok) {
    return { data: null, error: serviceClientResult.error };
  }

  const { serviceClient } = serviceClientResult;
  const accessibleResult = await getAccessibleProfileIds(
    serviceClient,
    profileId,
    roleValues,
  );

  if (!accessibleResult.ok) {
    return { data: null, error: accessibleResult.error };
  }

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

  if (
    accessibleResult.profileIds !== null &&
    !accessibleResult.profileIds.includes(planRow.profile_id)
  ) {
    return { data: null, error: { code: "NOT_FOUND", message: "해당 목실기를 찾을 수 없습니다." } };
  }

  const periodMonths = buildMoksilgiPeriodMonths(planRow.period_start, planRow.period_end);

  const [
    personResult,
    areasResult,
    detailGoalsResult,
    summariesResult,
    recordsResult,
    periodRecordsResult,
  ] =
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
      serviceClient
        .from("moksilgi_monthly_records")
        .select("detail_goal_id, month, actual_value")
        .eq("plan_id", planRow.id)
        .eq("profile_id", planRow.profile_id)
        .eq("year", selectedYear)
        .is("deleted_at", null),
      // 기간 기준 진도 계산용: 기간이 걸친 연도 전체의 실적
      periodMonths.length > 0
        ? serviceClient
            .from("moksilgi_monthly_records")
            .select("detail_goal_id, year, month, actual_value")
            .eq("plan_id", planRow.id)
            .eq("profile_id", planRow.profile_id)
            .gte("year", periodMonths[0].year)
            .lte("year", periodMonths[periodMonths.length - 1].year)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] as PeriodRecordRow[], error: null }),
    ]);

  if (personResult.error) {
    return { data: null, error: { code: "PERSON_PROFILE_QUERY_FAILED", message: "작성자 정보를 조회하는 중 오류가 발생했습니다." } };
  }

  if (areasResult.error || detailGoalsResult.error) {
    return { data: null, error: { code: "GOALS_QUERY_FAILED", message: "목실기 목표를 조회하는 중 오류가 발생했습니다." } };
  }

  if (summariesResult.error || recordsResult.error || periodRecordsResult.error) {
    return { data: null, error: { code: "SUMMARY_QUERY_FAILED", message: "목실기 요약을 조회하는 중 오류가 발생했습니다." } };
  }

  const areas = (areasResult.data ?? []) as CoachMakerMoksilgiProgressGoalArea[];
  const detailGoals = (detailGoalsResult.data ?? []) as CoachMakerMoksilgiProgressDetailGoal[];
  const summaries = (summariesResult.data ?? []) as SummaryRow[];
  const records = (recordsResult.data ?? []) as MonthlyRecordRateRow[];
  const durationMonths =
    calculateCoachingDurationMonths(planRow.period_start, planRow.period_end) ||
    DEFAULT_DURATION_MONTHS;

  // 엑셀 목실기 성취표 방식: 선택 연도 1~12월 실적 ÷ 목표량 → 영역 평균 → 종합(합) / 평균
  const yearExcelSummary = buildMoksilgiExcelSummary({
    periodMonths: buildMoksilgiPeriodMonths(`${selectedYear}-01-01`, `${selectedYear}-12-31`),
    areas,
    goals: detailGoals,
    records: records.map((record) => ({ ...record, year: selectedYear })),
  });
  const { rows: summaryRows, cumulativeRow } = toMoksilgiExcelYearSummaryRows(
    yearExcelSummary,
    durationMonths,
  );

  return {
    data: {
      plan: planRow,
      person: (personResult.data ?? null) as PersonProfileRow | null,
      areas,
      detailGoals,
      summaryRows,
      cumulativeRow,
      totalAchievementRate: cumulativeRow.average_rate,
      durationMonths,
      hasSummaryData: summaries.length > 0,
      year: selectedYear,
      scopeMode: accessibleResult.scopeMode,
      periodSummary:
        periodMonths.length > 0
          ? {
              periodMonths,
              ...toMoksilgiPeriodSummary(
                buildMoksilgiExcelSummary({
                  periodMonths,
                  areas,
                  goals: detailGoals,
                  records: (periodRecordsResult.data ?? []) as PeriodRecordRow[],
                }),
              ),
            }
          : null,
    },
    error: null,
  };
}
