import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import {
  computeMoksilgiYearSummaryMetrics,
  pickLatestActivePlanPerProfile,
  resolveActiveAreaKeys,
} from "@/lib/coaching/moksilgi-year-summary";
import { ensureCoachLevelAccess } from "@/lib/auth/coach-api-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { MoksilgiAreaKey, Tables } from "@/types/database";

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

type GoalAreaRow = Pick<Tables<"moksilgi_goal_areas">, "id" | "plan_id" | "area_key">;

type DetailGoalRow = Pick<Tables<"moksilgi_detail_goals">, "plan_id" | "area_id">;

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

function groupRowsByPlanId<T extends { plan_id: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const current = grouped.get(row.plan_id) ?? [];
    current.push(row);
    grouped.set(row.plan_id, current);
  }

  return grouped;
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
  const coachAccess = await ensureCoachLevelAccess(supabase, profileId);

  if (!coachAccess.ok) {
    return {
      data: null,
      error: {
        code: coachAccess.code,
        message: coachAccess.message,
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
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
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

  const allPlans = (plansResult.data ?? []) as MoksilgiPlanRow[];

  if (allPlans.length === 0) {
    return { data: [], error: null };
  }

  const assignedCoacheeIds = new Set(coacheeIds);
  const plans = pickLatestActivePlanPerProfile(
    allPlans.filter((plan) => assignedCoacheeIds.has(plan.profile_id)),
  );

  if (plans.length === 0) {
    return { data: [], error: null };
  }

  const planIds = plans.map((plan) => plan.id);
  const [summariesResult, areasResult, detailGoalsResult] = await Promise.all([
    serviceClient
      .from("moksilgi_monthly_summaries")
      .select(
        "plan_id, year, month, spiritual_rate, intellectual_rate, physical_rate, social_rate, other_rate, total_rate, average_rate",
      )
      .in("plan_id", planIds)
      .eq("year", selectedYear)
      .is("deleted_at", null)
      .order("month", { ascending: true }),
    serviceClient
      .from("moksilgi_goal_areas")
      .select("id, plan_id, area_key")
      .in("plan_id", planIds)
      .is("deleted_at", null),
    serviceClient
      .from("moksilgi_detail_goals")
      .select("plan_id, area_id")
      .in("plan_id", planIds)
      .is("deleted_at", null),
  ]);

  if (summariesResult.error || areasResult.error || detailGoalsResult.error) {
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
  const summariesByPlanId = groupRowsByPlanId((summariesResult.data ?? []) as SummaryRow[]);
  const areasByPlanId = groupRowsByPlanId((areasResult.data ?? []) as GoalAreaRow[]);
  const detailGoalsByPlanId = groupRowsByPlanId((detailGoalsResult.data ?? []) as DetailGoalRow[]);

  return {
    data: plans.map((plan) => {
      const coachee = coacheeMap.get(plan.profile_id);
      const planSummaries = summariesByPlanId.get(plan.id) ?? [];
      const planAreas = areasByPlanId.get(plan.id) ?? [];
      const planDetailGoals = detailGoalsByPlanId.get(plan.id) ?? [];
      const activeAreaKeys = resolveActiveAreaKeys(
        planAreas.map((area) => ({ id: area.id, area_key: area.area_key as MoksilgiAreaKey })),
        planDetailGoals,
      );
      const metrics = computeMoksilgiYearSummaryMetrics(planSummaries, activeAreaKeys);

      return {
        ...plan,
        coachee_display_name: coachee?.display_name ?? null,
        coachee_full_name: coachee?.full_name ?? null,
        coachee_email: coachee?.email ?? null,
        summary_year: selectedYear,
        summary_count: metrics.summary_count,
        spiritual_rate: metrics.spiritual_rate,
        intellectual_rate: metrics.intellectual_rate,
        physical_rate: metrics.physical_rate,
        social_rate: metrics.social_rate,
        other_rate: metrics.other_rate,
        total_rate: metrics.total_rate,
        average_rate: metrics.average_rate,
        total_achievement_rate: metrics.total_achievement_rate,
      };
    }),
    error: null,
  };
}
