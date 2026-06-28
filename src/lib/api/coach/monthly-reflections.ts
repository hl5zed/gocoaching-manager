import { getSession } from "@/lib/auth/getSession";
import { ensureCoachLevelAccess } from "@/lib/auth/coach-api-access";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type CoachMonthlyReflectionEntry = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  year: number;
  month: number;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
  created_at: string;
  coachee_display_name: string | null;
  coachee_full_name: string | null;
  coachee_email: string | null;
  relationship_type: string | null;
};

export type GetCoachMonthlyReflectionsErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "ACCESS_DENIED"
  | "ROLES_QUERY_FAILED"
  | "RELATIONSHIPS_QUERY_FAILED"
  | "REFLECTIONS_QUERY_FAILED"
  | "COACHEE_PROFILES_QUERY_FAILED";

export type GetCoachMonthlyReflectionsError = {
  code: GetCoachMonthlyReflectionsErrorCode;
  message: string;
};

export type GetCoachMonthlyReflectionsResult =
  | { data: CoachMonthlyReflectionEntry[]; error: null }
  | { data: null; error: GetCoachMonthlyReflectionsError };

type RelationshipRow = {
  id: string;
  coachee_profile_id: string;
  relationship_type: string | null;
};

type MonthlyReflectionRow = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  year: number;
  month: number;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
  created_at: string;
};

type CoacheeProfileRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
};

export async function getCoachMonthlyReflections(): Promise<GetCoachMonthlyReflectionsResult> {
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
    console.error("[COACH_MONTHLY_REFLECTIONS_SERVICE_CLIENT_UNAVAILABLE]", serviceClientError);
    return {
      data: null,
      error: {
        code: "REFLECTIONS_QUERY_FAILED",
        message: "월간 회고를 조회하는 중 오류가 발생했습니다.",
      },
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

  const { data: reflections, error: reflectionsError } = await serviceClient
    .from("monthly_reflections")
    .select(
      "id, profile_id, relationship_id, year, month, status, submitted_at, reviewed_at, updated_at, created_at",
    )
    .in("profile_id", coacheeIds)
    .eq("shared_with_coach", true)
    .eq("visibility", "coach")
    .is("deleted_at", null)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("created_at", { ascending: false });

  if (reflectionsError) {
    return {
      data: null,
      error: {
        code: "REFLECTIONS_QUERY_FAILED",
        message: "월간 회고를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const monthlyData = (reflections ?? []) as MonthlyReflectionRow[];

  if (monthlyData.length === 0) {
    return { data: [], error: null };
  }

  const uniqueCoacheeIds = [...new Set(monthlyData.map((r) => r.profile_id))];
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
    data: monthlyData.map((reflection) => {
      const coachee = coacheeMap.get(reflection.profile_id);
      const rel = relByCoacheeId.get(reflection.profile_id);
      return {
        id: reflection.id,
        profile_id: reflection.profile_id,
        relationship_id: reflection.relationship_id,
        year: reflection.year,
        month: reflection.month,
        status: reflection.status,
        submitted_at: reflection.submitted_at,
        reviewed_at: reflection.reviewed_at,
        updated_at: reflection.updated_at,
        created_at: reflection.created_at,
        coachee_display_name: coachee?.display_name ?? null,
        coachee_full_name: coachee?.full_name ?? null,
        coachee_email: coachee?.email ?? null,
        relationship_type: rel?.relationship_type ?? null,
      };
    }),
    error: null,
  };
}
