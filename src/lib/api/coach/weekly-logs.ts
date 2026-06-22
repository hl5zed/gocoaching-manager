import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { ActiveRoleSlim } from "@/types/profile";

export type CoachWeeklyLogEntry = {
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
  coachee_display_name: string | null;
  coachee_full_name: string | null;
  coachee_email: string | null;
  relationship_type: string | null;
  relationship_status: string | null;
  scope_type: string | null;
  scope_id: string | null;
};

export type GetCoachWeeklyLogsErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "ROLES_QUERY_FAILED"
  | "ACCESS_DENIED"
  | "RELATIONSHIPS_QUERY_FAILED"
  | "LOGS_QUERY_FAILED"
  | "COACHEE_PROFILES_QUERY_FAILED";

export type GetCoachWeeklyLogsError = {
  code: GetCoachWeeklyLogsErrorCode;
  message: string;
};

export type GetCoachWeeklyLogsResult =
  | { data: CoachWeeklyLogEntry[]; error: null }
  | { data: null; error: GetCoachWeeklyLogsError };

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
  relationship_type: string | null;
  status: string | null;
  scope_type: string | null;
  scope_id: string | null;
};

type WeeklyLogRow = {
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
};

type CoacheeProfileRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
};

function getServiceClientResult():
  | { ok: true; serviceClient: ServiceSupabaseClient }
  | { ok: false; error: GetCoachWeeklyLogsError } {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    console.error("[COACH_WEEKLY_LOGS_SERVICE_CLIENT_UNAVAILABLE]", error);
    return {
      ok: false,
      error: {
        code: "LOGS_QUERY_FAILED",
        message: "주간 기록을 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  return { ok: true, serviceClient: client };
}

export async function getCoachWeeklyLogs(): Promise<GetCoachWeeklyLogsResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      data: null,
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
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
  const { data: relationships, error: relationshipError } = await serviceClient
    .from("coaching_relationships")
    .select(
      "id, coachee_profile_id, relationship_type, status, scope_type, scope_id",
    )
    .eq("coach_profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (relationshipError) {
    return {
      data: null,
      error: {
        code: "RELATIONSHIPS_QUERY_FAILED",
        message: "코칭 관계를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const rels = (relationships ?? []) as RelationshipRow[];

  if (rels.length === 0) {
    return { data: [], error: null };
  }

  const relationshipIds = rels.map((relationship) => relationship.id);
  const { data: logs, error: logsError } = await serviceClient
    .from("weekly_logs")
    .select(
      "id, relationship_id, coachee_profile_id, week_start, week_end, status, version, submitted_at, created_at, updated_at",
    )
    .in("relationship_id", relationshipIds)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (logsError) {
    return {
      data: null,
      error: {
        code: "LOGS_QUERY_FAILED",
        message: "주간 기록을 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const weeklyLogs = (logs ?? []) as WeeklyLogRow[];

  if (weeklyLogs.length === 0) {
    return { data: [], error: null };
  }

  const coacheeIds = [...new Set(weeklyLogs.map((log) => log.coachee_profile_id))];
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
  const relationshipMap = new Map(rels.map((relationship) => [relationship.id, relationship]));

  return {
    data: weeklyLogs.map((log) => {
      const relationship = relationshipMap.get(log.relationship_id);
      const coachee = coacheeMap.get(log.coachee_profile_id);

      return {
        id: log.id,
        relationship_id: log.relationship_id,
        coachee_profile_id: log.coachee_profile_id,
        week_start: log.week_start,
        week_end: log.week_end,
        status: log.status,
        version: log.version,
        submitted_at: log.submitted_at,
        created_at: log.created_at,
        updated_at: log.updated_at,
        coachee_display_name: coachee?.display_name ?? null,
        coachee_full_name: coachee?.full_name ?? null,
        coachee_email: coachee?.email ?? null,
        relationship_type: relationship?.relationship_type ?? null,
        relationship_status: relationship?.status ?? null,
        scope_type: relationship?.scope_type ?? null,
        scope_id: relationship?.scope_id ?? null,
      };
    }),
    error: null,
  };
}
