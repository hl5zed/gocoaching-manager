import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth/getSession";
import { hasRole } from "@/lib/auth/has-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, UserRole } from "@/types/database";

export const ADMIN_WRITE_ROLES: UserRole[] = [
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
];

type AdminProfile = {
  id: string;
  email: string | null;
};

type ProfileLookupRow = {
  id: string;
  email: string | null;
};

export type RequireAdminProfileResult =
  | {
      ok: true;
      supabase: SupabaseClient<Database>;
      authUserId: string;
      profile: AdminProfile;
      roles: UserRole[];
    }
  | {
      ok: false;
      status: 401 | 403;
      code: "AUTH_REQUIRED" | "ADMIN_PROFILE_REQUIRED" | "ADMIN_ROLE_REQUIRED";
      message: string;
    };

export async function requireAdminProfile(): Promise<RequireAdminProfileResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false,
      status: 401,
      code: "AUTH_REQUIRED",
      message: "Authentication is required.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("auth_user_id", session.user.id)
    .neq("status", "anonymized")
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError || !profileData) {
    return {
      ok: false,
      status: 403,
      code: "ADMIN_PROFILE_REQUIRED",
      message: "Admin profile could not be resolved.",
    };
  }

  const profileRecord = profileData as ProfileLookupRow;

  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("profile_id", profileRecord.id)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    return {
      ok: false,
      status: 403,
      code: "ADMIN_ROLE_REQUIRED",
      message: "You do not have permission to perform this admin action.",
    };
  }

  type UserRoleRow = { role: UserRole };
  const roles: UserRole[] = ((rolesData ?? []) as UserRoleRow[]).map(
    (r) => r.role,
  );

  if (!hasRole(roles, ADMIN_WRITE_ROLES)) {
    return {
      ok: false,
      status: 403,
      code: "ADMIN_ROLE_REQUIRED",
      message: "You do not have permission to perform this admin action.",
    };
  }

  return {
    ok: true,
    supabase,
    authUserId: session.user.id,
    profile: {
      id: profileRecord.id,
      email: profileRecord.email,
    },
    roles,
  };
}
