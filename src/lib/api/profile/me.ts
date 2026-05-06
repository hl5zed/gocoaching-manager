import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/getSession";
import type { ProfileRow, ScopeType, UserRole } from "@/types/database";

export type MyProfileRole = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
  assigned_at: string;
};

export type MyProfileData = {
  authEmail: string | null;
  profile:
    | Pick<
        ProfileRow,
        "id" | "email" | "full_name" | "display_name" | "status" | "created_at"
      >
    | null;
  roles: MyProfileRole[];
};

export type MyProfileResult =
  | {
      ok: true;
      data: MyProfileData;
    }
  | {
      ok: false;
      error: {
        code: "UNAUTHORIZED" | "PROFILE_FETCH_FAILED";
        message: string;
      };
    };

type ProfileRecord = Pick<
  ProfileRow,
  "id" | "email" | "full_name" | "display_name" | "status" | "created_at"
>;

type RoleRecord = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
  granted_at: string;
};

export async function getMyProfile(): Promise<MyProfileResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
      },
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, display_name, status, created_at")
      .eq("auth_user_id", session.user.id)
      .is("deleted_at", null)
      .neq("status", "anonymized")
      .maybeSingle();

    if (profileError) {
      return {
        ok: false,
        error: {
          code: "PROFILE_FETCH_FAILED",
          message: "Unable to load your profile right now.",
        },
      };
    }

    if (!profile) {
      return {
        ok: true,
        data: {
          authEmail: session.user.email,
          profile: null,
          roles: [],
        },
      };
    }

    const profileRecord = profile as ProfileRecord;
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role, scope_type, scope_id, status, granted_at")
      .eq("profile_id", profileRecord.id)
      .eq("status", "active")
      .eq("is_active", true)
      .is("deleted_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (rolesError) {
      return {
        ok: false,
        error: {
          code: "PROFILE_FETCH_FAILED",
          message: "Unable to load your profile right now.",
        },
      };
    }

    return {
      ok: true,
      data: {
        authEmail: session.user.email,
        profile: profileRecord,
        roles: ((roles ?? []) as RoleRecord[]).map((role) => ({
          role: role.role,
          scope_type: role.scope_type,
          scope_id: role.scope_id,
          status: role.status,
          assigned_at: role.granted_at,
        })),
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "PROFILE_FETCH_FAILED",
        message: "Unable to load your profile right now.",
      },
    };
  }
}
