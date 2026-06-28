import { getSession } from "@/lib/auth/getSession";
import { ensureCoachLevelAccess } from "@/lib/auth/coach-api-access";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type CoachDailyLogEntry = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  record_date: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  created_at: string;
  coachee_display_name: string | null;
  coachee_full_name: string | null;
  coachee_email: string | null;
  relationship_type: string | null;
};

export type GetCoachDailyLogsErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "ACCESS_DENIED"
  | "ROLES_QUERY_FAILED"
  | "RELATIONSHIPS_QUERY_FAILED"
  | "LOGS_QUERY_FAILED"
  | "COACHEE_PROFILES_QUERY_FAILED";

export type GetCoachDailyLogsError = {
  code: GetCoachDailyLogsErrorCode;
  message: string;
};

export type GetCoachDailyLogsResult =
  | { data: CoachDailyLogEntry[]; error: null }
  | { data: null; error: GetCoachDailyLogsError };

type RelationshipRow = {
  id: string;
  coachee_profile_id: string;
  relationship_type: string | null;
};

type DailyLogRow = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  record_date: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  created_at: string;
};

type CoacheeProfileRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
};

export async function getCoachDailyLogs(): Promise<GetCoachDailyLogsResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      data: null,
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
    };
  }

  const supabase = await createSupabaseServerClient();
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = supabase.from("profiles").select("id");
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
      error: { code: "PROFILE_NOT_FOUND", message: "아직 프로필이 생성되지 않았습니다." },
    };
  }

  const profileId = (profile as { id: string }).id;
  const coachAccess = await ensureCoachLevelAccess(supabase, profileId);

  if (!coachAccess.ok) {
    return {
      data: null,
      error: { code: coachAccess.code, message: coachAccess.message },
    };
  }

  const { client: serviceClient, error: serviceClientError } = createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[COACH_DAILY_LOGS_SERVICE_CLIENT_UNAVAILABLE]", serviceClientError);
    return {
      data: null,
      error: { code: "LOGS_QUERY_FAILED", message: "하루 기록을 조회하는 중 오류가 발생했습니다." },
    };
  }

  const { data: relationships, error: relationshipError } = await serviceClient
    .from("coaching_relationships")
    .select("id, coachee_profile_id, relationship_type")
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

  const coacheeIds = rels.map((r) => r.coachee_profile_id);

  const { data: logs, error: logsError } = await serviceClient
    .from("daily_records")
    .select(
      "id, profile_id, relationship_id, record_date, status, submitted_at, updated_at, created_at",
    )
    .in("profile_id", coacheeIds)
    .eq("shared_with_coach", true)
    .eq("visibility", "coach")
    .is("deleted_at", null)
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (logsError) {
    return {
      data: null,
      error: {
        code: "LOGS_QUERY_FAILED",
        message: "하루 기록을 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const dailyLogs = (logs ?? []) as DailyLogRow[];

  if (dailyLogs.length === 0) {
    return { data: [], error: null };
  }

  const uniqueCoacheeIds = [...new Set(dailyLogs.map((l) => l.profile_id))];
  const { data: coachees, error: coacheesError } = await serviceClient
    .from("profiles")
    .select("id, display_name, full_name, email")
    .in("id", uniqueCoacheeIds)
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
    ((coachees ?? []) as CoacheeProfileRow[]).map((c) => [c.id, c]),
  );
  const relByCoacheeId = new Map(rels.map((r) => [r.coachee_profile_id, r]));

  return {
    data: dailyLogs.map((log) => {
      const coachee = coacheeMap.get(log.profile_id);
      const rel = relByCoacheeId.get(log.profile_id);
      return {
        id: log.id,
        profile_id: log.profile_id,
        relationship_id: log.relationship_id,
        record_date: log.record_date,
        status: log.status,
        submitted_at: log.submitted_at,
        updated_at: log.updated_at,
        created_at: log.created_at,
        coachee_display_name: coachee?.display_name ?? null,
        coachee_full_name: coachee?.full_name ?? null,
        coachee_email: coachee?.email ?? null,
        relationship_type: rel?.relationship_type ?? null,
      };
    }),
    error: null,
  };
}
