import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getRolesByProfileId,
  getVerifiedRolesFromHeaders,
} from "@/lib/auth/get-user-roles";
import type { Database, ScopeType, UserRole } from "@/types/database";

export const COACH_LEVEL_ROLES: ReadonlySet<UserRole> = new Set([
  "coach",
  "coach_maker",
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
]);

export type CoachRoleRow = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
};

export type CoachAccessErrorCode = "ROLES_QUERY_FAILED" | "ACCESS_DENIED";

export async function ensureCoachLevelAccess(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<
  | { ok: true }
  | { ok: false; code: CoachAccessErrorCode; message: string }
> {
  const verifiedRoles = await getVerifiedRolesFromHeaders();

  if (verifiedRoles !== undefined) {
    if (verifiedRoles.some((role) => COACH_LEVEL_ROLES.has(role))) {
      return { ok: true };
    }

    return {
      ok: false,
      code: "ACCESS_DENIED",
      message: "코치 권한이 없습니다.",
    };
  }

  try {
    const roles = await getRolesByProfileId(supabase, profileId);

    if (roles.some((role) => COACH_LEVEL_ROLES.has(role))) {
      return { ok: true };
    }

    return {
      ok: false,
      code: "ACCESS_DENIED",
      message: "코치 권한이 없습니다.",
    };
  } catch {
    return {
      ok: false,
      code: "ROLES_QUERY_FAILED",
      message: "역할 정보를 조회하는 중 오류가 발생했습니다.",
    };
  }
}

/** middleware verified roles header 우선, 없으면 user_roles 전체 행 조회 */
export async function getCoachRoleRowsWithHeaderFallback(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<
  | { ok: true; roles: CoachRoleRow[] }
  | { ok: false; code: "ROLES_QUERY_FAILED"; message: string }
> {
  const verifiedRoles = await getVerifiedRolesFromHeaders();

  if (verifiedRoles !== undefined) {
    return {
      ok: true,
      roles: verifiedRoles.map((role) => ({
        role,
        scope_type: "global",
        scope_id: null,
        status: "active" as const,
      })),
    };
  }

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, scope_type, scope_id, status")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    return {
      ok: false,
      code: "ROLES_QUERY_FAILED",
      message: "역할 정보를 조회하는 중 오류가 발생했습니다.",
    };
  }

  return {
    ok: true,
    roles: (roles ?? []) as CoachRoleRow[],
  };
}
