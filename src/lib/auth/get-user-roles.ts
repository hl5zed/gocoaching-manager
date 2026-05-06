import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/database";

type ProfileIdRow = {
  id: string;
};

type UserRoleRow = {
  role: UserRole;
};

export async function getUserRoles(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserRole[]> {
  // This project stores role ownership in user_roles.profile_id, not auth.users.id.
  // Existing code resolves auth.users.id -> profiles.id -> user_roles.profile_id.
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

  const profileRecord = profile as ProfileIdRow;
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("profile_id", profileRecord.id)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    throw new Error("ROLE_QUERY_FAILED");
  }

  return ((roles ?? []) as UserRoleRow[]).map((role) => role.role);
}
