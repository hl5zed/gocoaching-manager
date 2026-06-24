import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Tables } from "@/types/database";
import type { ActiveRoleSlim } from "@/types/profile";

const COACH_LEVEL_ROLES = new Set([
  "coach",
  "coach_maker",
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
]);

type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;

type RelationshipRow = {
  id: string;
  coachee_profile_id: string;
};

type CoacheeProfileRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
};

type MoksilgiPlanRow = Pick<
  Tables<"moksilgi_plans">,
  | "id"
  | "profile_id"
  | "title"
  | "subtitle"
  | "period_start"
  | "period_end"
  | "author_name"
  | "region_name"
  | "team_name"
  | "regional_leader_name"
  | "coach_name"
  | "role_label"
  | "generation_label"
  | "mission_statement"
  | "vision_year"
  | "vision_statement"
  | "main_goal"
  | "status"
  | "created_at"
  | "updated_at"
>;

type SummaryRow = Pick<
  Tables<"moksilgi_monthly_summaries">,
  | "plan_id"
  | "year"
  | "month"
  | "spiritual_rate"
  | "intellectual_rate"
  | "physical_rate"
  | "social_rate"
  | "other_rate"
  | "total_rate"
  | "average_rate"
>;

export type CoachMoksilgiItem = MoksilgiPlanRow & {
  coachee_display_name: string | null;
  coachee_full_name: string | null;
  coachee_email: string | null;
  summary_year: number;
  summary_count: number;
  spiritual_rate: number;
  intellectual_rate: number;
  physical_rate: number;
  social_rate: number;
  other_rate: number;
  total_rate: number;
  average_rate: number;
  total_achievement_rate: number;
};

export type GetCoachMoksilgiErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "ROLES_QUERY_FAILED"
  | "ACCESS_DENIED"
  | "RELATIONSHIPS_QUERY_FAILED"
  | "MOKSILGI_QUERY_FAILED"
  | "COACHEE_PROFILES_QUERY_FAILED";

export type GetCoachMoksilgiResult =
  | { data: CoachMoksilgiItem[]; error: null }
  | {
      data: null;
      error: { code: GetCoachMoksilgiErrorCode; message: string };
    };

function getServiceClientResult():
  | { ok: true; serviceClient: ServiceSupabaseClient }
  | {
      ok: false;
      error: {
        code: "RELATIONSHIPS_QUERY_FAILED";
        message: string;
      };
    } {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    console.error("[COACH_MOKSILGI_SERVICE_CLIENT_UNAVAILABLE]", error);
    return {
      ok: false,
      error: {
        code: "RELATIONSHIPS_QUERY_FAILED",
        message: "코칭 관계를 조회하는 중 오류가 발생했습니다.",
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

function summaryAverage(summaries: SummaryRow[], key: keyof SummaryRow) {
  const values = summaries
    .map((summary) => summary[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return average(values);
}

export async function getCoachMoksilgi(year: number): Promise<GetCoachMoksilgiResult> {
  const selectedYear = validateYear(year) ? year : new Date().getFullYear();
  const session = await getSession();

  if (!session.user) {
    return {
      data: null,
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
    };
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
    return {
      data: null,
      error: {
        code: "PROFILE_QUERY_FAILED",
        message: "프로필을 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  if (!profile) {
    return {
      data: null,
      error: {
        code: "PROFILE_NOT_FOUND",
        message: "아직 프로필이 생성되지 않았습니다.",
      },
    };
  }

  const profileId = (profile as { id: string }).id;
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("id, role, scope_type, scope_id, granted_at, expires_at")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (rolesError) {
    return {
      data: null,
      error: {
        code: "ROLES_QUERY_FAILED",
        message: "역할 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const activeRoles = (roles ?? []) as ActiveRoleSlim[];
  const hasCoachAccess = activeRoles.some((role) => COACH_LEVEL_ROLES.has(role.role));

  if (!hasCoachAccess) {
    return {
      data: null,
      error: {
        code: "ACCESS_DENIED",
        message: "코치 권한이 없습니다.",
      },
    };
  }

  const serviceClientResult = getServiceClientResult();

  if (!serviceClientResult.ok) {
    return { data: null, error: serviceClientResult.error };
  }

  const { serviceClient } = serviceClientResult;
  const { data: relationships, error: relationshipsError } = await serviceClient
    .from("coaching_relationships")
    .select("id, coachee_profile_id")
    .eq("coach_profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (relationshipsError) {
    return {
      data: null,
      error: {
        code: "RELATIONSHIPS_QUERY_FAILED",
        message: "코칭 관계를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const relationshipRows = (relationships ?? []) as RelationshipRow[];

  if (relationshipRows.length === 0) {
    return { data: [], error: null };
  }

  const coacheeIds = [
    ...new Set(relationshipRows.map((relationship) => relationship.coachee_profile_id)),
  ];
  const [plansResult, coacheesResult] = await Promise.all([
    serviceClient
      .from("moksilgi_plans")
      .select(
        "id, profile_id, title, subtitle, period_start, period_end, author_name, region_name, team_name, regional_leader_name, coach_name, role_label, generation_label, mission_statement, vision_year, vision_statement, main_goal, status, created_at, updated_at",
      )
      .in("profile_id", coacheeIds)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    serviceClient
      .from("profiles")
      .select("id, display_name, full_name, email")
      .in("id", coacheeIds)
      .is("deleted_at", null),
  ]);

  if (plansResult.error) {
    return {
      data: null,
      error: {
        code: "MOKSILGI_QUERY_FAILED",
        message: "코치이 목실기를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  if (coacheesResult.error) {
    return {
      data: null,
      error: {
        code: "COACHEE_PROFILES_QUERY_FAILED",
        message: "코치이 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const plans = (plansResult.data ?? []) as MoksilgiPlanRow[];

  if (plans.length === 0) {
    return { data: [], error: null };
  }

  const assignedCoacheeIds = new Set(coacheeIds);
  const planIds = plans.map((plan) => plan.id);
  const { data: summaries, error: summariesError } = await serviceClient
    .from("moksilgi_monthly_summaries")
    .select(
      "plan_id, year, month, spiritual_rate, intellectual_rate, physical_rate, social_rate, other_rate, total_rate, average_rate",
    )
    .in("plan_id", planIds)
    .eq("year", selectedYear)
    .is("deleted_at", null)
    .order("month", { ascending: true });

  if (summariesError) {
    return {
      data: null,
      error: {
        code: "MOKSILGI_QUERY_FAILED",
        message: "코치이 목실기 요약을 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const coacheeMap = new Map(
    ((coacheesResult.data ?? []) as CoacheeProfileRow[]).map((coachee) => [
      coachee.id,
      coachee,
    ]),
  );
  const summariesByPlanId = new Map<string, SummaryRow[]>();

  for (const summary of (summaries ?? []) as SummaryRow[]) {
    const current = summariesByPlanId.get(summary.plan_id) ?? [];
    current.push(summary);
    summariesByPlanId.set(summary.plan_id, current);
  }

  return {
    data: plans
      .filter((plan) => assignedCoacheeIds.has(plan.profile_id))
      .map((plan) => {
        const coachee = coacheeMap.get(plan.profile_id);
        const planSummaries = summariesByPlanId.get(plan.id) ?? [];
        const averageRate = average(planSummaries.map((summary) => safeNumber(summary.average_rate)));

        return {
          ...plan,
          coachee_display_name: coachee?.display_name ?? null,
          coachee_full_name: coachee?.full_name ?? null,
          coachee_email: coachee?.email ?? null,
          summary_year: selectedYear,
          summary_count: planSummaries.length,
          spiritual_rate: summaryAverage(planSummaries, "spiritual_rate"),
          intellectual_rate: summaryAverage(planSummaries, "intellectual_rate"),
          physical_rate: summaryAverage(planSummaries, "physical_rate"),
          social_rate: summaryAverage(planSummaries, "social_rate"),
          other_rate: summaryAverage(planSummaries, "other_rate"),
          total_rate: summaryAverage(planSummaries, "total_rate"),
          average_rate: averageRate,
          total_achievement_rate: averageRate,
        };
      }),
    error: null,
  };
}
