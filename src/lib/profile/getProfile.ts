import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActiveRoleSlim, MeResponse, SafeProfile } from "@/types/profile";
import type { User } from "@/types/auth";

export type GetProfileErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "ROLES_QUERY_FAILED";

export type GetProfileError = {
  code: GetProfileErrorCode;
  message: string;
  detail?: string;
};

export type GetProfileResult =
  | {
      data: MeResponse;
      user: User;
      error: null;
    }
  | {
      data: null;
      user: User | null;
      error: GetProfileError;
    };

const profileSelectFields = [
  "id",
  "full_name",
  "display_name",
  "email",
  "phone",
  "primary_role",
  "growth_level_id",
  "generation_number",
  "status",
  "preferred_language",
  "timezone",
  "country_id",
  "region_id",
  "organization_id",
  "church_id",
  "group_id",
  "cohort_id",
  "created_at",
  "updated_at",
].join(", ");

export async function getProfile(): Promise<GetProfileResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      data: null,
      user: null,
      error: {
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
        detail: session.error ?? undefined,
      },
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelectFields)
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      data: null,
      user: session.user,
      error: {
        code: "PROFILE_QUERY_FAILED",
        message: "프로필을 조회하는 중 오류가 발생했습니다.",
        detail: profileError.message,
      },
    };
  }

  if (!profile) {
    return {
      data: null,
      user: session.user,
      error: {
        code: "PROFILE_NOT_FOUND",
        message: "프로필이 아직 생성되지 않았습니다.",
      },
    };
  }

  const safeProfile = profile as SafeProfile;

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("id, role, scope_type, scope_id, granted_at, expires_at")
    .eq("profile_id", safeProfile.id)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (rolesError) {
    return {
      data: null,
      user: session.user,
      error: {
        code: "ROLES_QUERY_FAILED",
        message: "사용자 역할을 조회하는 중 오류가 발생했습니다.",
        detail: rolesError.message,
      },
    };
  }

  return {
    data: {
      profile: safeProfile,
      roles: (roles ?? []) as ActiveRoleSlim[],
    },
    user: session.user,
    error: null,
  };
}
