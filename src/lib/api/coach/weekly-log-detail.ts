import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { WeeklyLogRow } from "@/types/database";
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

type ProfileIdRow = {
  id: string;
};

type RelationshipRow = {
  id: string;
  relationship_type: string | null;
  status: string | null;
  scope_type: string | null;
  scope_id: string | null;
};

type CoacheeProfileRow = {
  display_name: string | null;
  full_name: string | null;
  email: string | null;
};

type SafeWeeklyLogRow = Pick<
  WeeklyLogRow,
  | "id"
  | "relationship_id"
  | "coachee_profile_id"
  | "week_start"
  | "week_end"
  | "gratitude"
  | "prayer_request"
  | "progress_summary"
  | "difficulty"
  | "message_to_coach"
  | "status"
  | "version"
  | "submitted_at"
  | "created_at"
  | "updated_at"
>;

export type CoachWeeklyLogDetail = {
  id: string;
  relationship_id: string;
  coachee_profile_id: string;
  week_start: string;
  week_end: string;
  status: string;
  version: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  gratitude: string | null;
  prayer_request: string | null;
  progress_summary: string | null;
  difficulty: string | null;
  message_to_coach: string | null;
  coachee_display_name: string | null;
  coachee_full_name: string | null;
  coachee_email: string | null;
  relationship_type: string | null;
  relationship_status: string | null;
  scope_type: string | null;
  scope_id: string | null;
};

export type GetCoachWeeklyLogDetailErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "ROLES_QUERY_FAILED"
  | "ACCESS_DENIED"
  | "RELATIONSHIPS_QUERY_FAILED"
  | "LOG_QUERY_FAILED"
  | "NOT_FOUND";

export type GetCoachWeeklyLogDetailResult =
  | { data: CoachWeeklyLogDetail; error: null }
  | {
      data: null;
      error: {
        code: GetCoachWeeklyLogDetailErrorCode;
        message: string;
      };
    };

function getServiceClientResult():
  | { ok: true; serviceClient: ServiceSupabaseClient }
  | {
      ok: false;
      error: {
        code: GetCoachWeeklyLogDetailErrorCode;
        message: string;
      };
    } {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    console.error("[COACH_WEEKLY_LOG_DETAIL_SERVICE_CLIENT_UNAVAILABLE]", error);
    return {
      ok: false,
      error: {
        code: "LOG_QUERY_FAILED",
        message: "주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  return { ok: true, serviceClient: client };
}

export async function getCoachWeeklyLogDetail(
  logId: string,
): Promise<GetCoachWeeklyLogDetailResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      data: null,
      error: {
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
      },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      data: null,
      error: {
        code: "PROFILE_QUERY_FAILED",
        message: "프로필을 불러올 수 없습니다.",
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

  const profileId = (profile as ProfileIdRow).id;
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
        message: "역할 정보를 불러올 수 없습니다.",
      },
    };
  }

  const hasCoachAccess = ((roles ?? []) as ActiveRoleSlim[]).some((role) =>
    COACH_LEVEL_ROLES.has(role.role),
  );

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
  const { data: weeklyLog, error: weeklyLogError } = await serviceClient
    .from("weekly_logs")
    .select(
      "id, relationship_id, coachee_profile_id, week_start, week_end, gratitude, prayer_request, progress_summary, difficulty, message_to_coach, status, version, submitted_at, created_at, updated_at",
    )
    .eq("id", logId)
    .is("deleted_at", null)
    .maybeSingle();

  if (weeklyLogError) {
    return {
      data: null,
      error: {
        code: "LOG_QUERY_FAILED",
        message: "주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  if (!weeklyLog) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "해당 주간 기록을 찾을 수 없습니다.",
      },
    };
  }

  const weeklyLogRow = weeklyLog as SafeWeeklyLogRow;
  const { data: relationship, error: relationshipsError } = await serviceClient
    .from("coaching_relationships")
    .select("id, relationship_type, status, scope_type, scope_id")
    .eq("id", weeklyLogRow.relationship_id)
    .eq("coach_profile_id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (relationshipsError) {
    return {
      data: null,
      error: {
        code: "RELATIONSHIPS_QUERY_FAILED",
        message: "코칭 관계를 불러올 수 없습니다.",
      },
    };
  }

  if (!relationship) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "해당 주간 기록을 찾을 수 없습니다.",
      },
    };
  }

  const relationshipRow = relationship as RelationshipRow;
  const { data: coacheeProfile, error: coacheeProfileError } = await serviceClient
    .from("profiles")
    .select("display_name, full_name, email")
    .eq("id", weeklyLogRow.coachee_profile_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (coacheeProfileError) {
    return {
      data: null,
      error: {
        code: "LOG_QUERY_FAILED",
        message: "주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  const coachee = (coacheeProfile ?? null) as CoacheeProfileRow | null;

  return {
    data: {
      id: weeklyLogRow.id,
      relationship_id: weeklyLogRow.relationship_id,
      coachee_profile_id: weeklyLogRow.coachee_profile_id,
      week_start: weeklyLogRow.week_start,
      week_end: weeklyLogRow.week_end,
      status: weeklyLogRow.status,
      version: weeklyLogRow.version,
      submitted_at: weeklyLogRow.submitted_at,
      created_at: weeklyLogRow.created_at,
      updated_at: weeklyLogRow.updated_at,
      gratitude: weeklyLogRow.gratitude,
      prayer_request: weeklyLogRow.prayer_request,
      progress_summary: weeklyLogRow.progress_summary,
      difficulty: weeklyLogRow.difficulty,
      message_to_coach: weeklyLogRow.message_to_coach,
      coachee_display_name: coachee?.display_name ?? null,
      coachee_full_name: coachee?.full_name ?? null,
      coachee_email: coachee?.email ?? null,
      relationship_type: relationshipRow.relationship_type,
      relationship_status: relationshipRow.status,
      scope_type: relationshipRow.scope_type,
      scope_id: relationshipRow.scope_id,
    },
    error: null,
  };
}
