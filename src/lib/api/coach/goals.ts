import { getSession } from "@/lib/auth/getSession";
import {
  ensureCoachLevelAccess,
  getCoachRoleRowsWithHeaderFallback,
  type CoachRoleRow,
} from "@/lib/auth/coach-api-access";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { GoalPriority, GoalStatus, Tables } from "@/types/database";

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

export type CoachGoalItem = Pick<
  Tables<"goals">,
  | "id"
  | "profile_id"
  | "relationship_id"
  | "title"
  | "description"
  | "category"
  | "target_value"
  | "current_value"
  | "unit"
  | "status"
  | "priority"
  | "start_date"
  | "due_date"
  | "completed_at"
  | "created_at"
  | "updated_at"
> & {
  coachee_display_name: string | null;
  coachee_full_name: string | null;
  coachee_email: string | null;
};

export type GetCoachGoalsErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "ROLES_QUERY_FAILED"
  | "ACCESS_DENIED"
  | "RELATIONSHIPS_QUERY_FAILED"
  | "GOALS_QUERY_FAILED"
  | "COACHEE_PROFILES_QUERY_FAILED";

export type GetCoachGoalsResult =
  | { data: CoachGoalItem[]; error: null }
  | {
      data: null;
      error: { code: GetCoachGoalsErrorCode; message: string };
    };

type GoalRow = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  status: GoalStatus;
  priority: GoalPriority;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
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
    console.error("[COACH_GOALS_SERVICE_CLIENT_UNAVAILABLE]", error);
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

export async function getCoachGoals(): Promise<GetCoachGoalsResult> {
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
  const { data: goals, error: goalsError } = await serviceClient
    .from("goals")
    .select(
      "id, profile_id, relationship_id, title, description, category, target_value, current_value, unit, status, priority, start_date, due_date, completed_at, created_at, updated_at",
    )
    .in("profile_id", coacheeIds)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (goalsError) {
    return {
      data: null,
      error: {
        code: "GOALS_QUERY_FAILED",
        message: "코치이 목표를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const goalRows = (goals ?? []) as GoalRow[];

  if (goalRows.length === 0) {
    return { data: [], error: null };
  }

  const { data: coachees, error: coacheesError } = await serviceClient
    .from("profiles")
    .select("id, display_name, full_name, email")
    .in("id", coacheeIds)
    .is("deleted_at", null);

  if (coacheesError) {
    return {
      data: null,
      error: {
        code: "COACHEE_PROFILES_QUERY_FAILED",
        message: "코치이 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const coacheeMap = new Map(
    ((coachees ?? []) as CoacheeProfileRow[]).map((coachee) => [coachee.id, coachee]),
  );
  const assignedCoacheeIds = new Set(coacheeIds);

  return {
    data: goalRows
      .filter((goal) => assignedCoacheeIds.has(goal.profile_id))
      .map((goal) => {
        const coachee = coacheeMap.get(goal.profile_id);

        return {
          id: goal.id,
          profile_id: goal.profile_id,
          relationship_id: goal.relationship_id,
          title: goal.title,
          description: goal.description,
          category: goal.category,
          target_value: goal.target_value,
          current_value: goal.current_value,
          unit: goal.unit,
          status: goal.status,
          priority: goal.priority,
          start_date: goal.start_date,
          due_date: goal.due_date,
          completed_at: goal.completed_at,
          created_at: goal.created_at,
          updated_at: goal.updated_at,
          coachee_display_name: coachee?.display_name ?? null,
          coachee_full_name: coachee?.full_name ?? null,
          coachee_email: coachee?.email ?? null,
        };
      }),
    error: null,
  };
}
