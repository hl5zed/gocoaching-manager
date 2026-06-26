import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VERIFIED_ROLES_HEADER } from "@/lib/auth/identity-headers";
import { USER_ROLES, type Database, type UserRole } from "@/types/database";

type UserRoleRow = {
  role: UserRole;
};

const VALID_USER_ROLES = new Set<string>(USER_ROLES);

export function serializeVerifiedRoles(roles: UserRole[]): string {
  return roles.join(",");
}

export function parseVerifiedRolesHeader(value: string): UserRole[] {
  if (value.length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((role) => role.trim())
    .filter((role): role is UserRole => VALID_USER_ROLES.has(role));
}

/**
 * middleware role-gated 경로에서 set한 roles.
 * undefined — header 없음(비 role-gate 경로 등) → DB fallback.
 */
export async function getVerifiedRolesFromHeaders(): Promise<UserRole[] | undefined> {
  try {
    const headerStore = await headers();
    const value = headerStore.get(VERIFIED_ROLES_HEADER);

    if (value === null) {
      return undefined;
    }

    return parseVerifiedRolesHeader(value);
  } catch {
    return undefined;
  }
}

export async function getRolesByProfileId(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<UserRole[]> {
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    throw new Error("ROLE_QUERY_FAILED");
  }

  return ((roles ?? []) as UserRoleRow[]).map((role) => role.role);
}

/** header 우선, 없으면 profile_id로 user_roles 조회 */
export async function getRolesWithHeaderFallback(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<UserRole[]> {
  const verifiedRoles = await getVerifiedRolesFromHeaders();

  if (verifiedRoles !== undefined) {
    return verifiedRoles;
  }

  return getRolesByProfileId(supabase, profileId);
}

export async function getUserRoles(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserRole[]> {
  type ProfileIdRow = {
    id: string;
  };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .neq("status", "anonymized")
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError) {
    throw new Error("ROLE_PROFILE_LOOKUP_FAILED");
  }

  if (!profile) {
    return [];
  }

  return getRolesByProfileId(supabase, (profile as ProfileIdRow).id);
}
