import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/getSession";
import type { ProfileRow, ScopeType, UserRole } from "@/types/database";

export type DashboardRole = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
};

export type DashboardProfile = Pick<
  ProfileRow,
  "id" | "email" | "full_name" | "display_name" | "status" | "created_at"
>;

export type DashboardMeResult =
  | {
      ok: true;
      data: {
        authEmail: string | null;
        profile: DashboardProfile | null;
        roles: DashboardRole[];
      };
    }
  | {
      ok: false;
      error: {
        code: "UNAUTHORIZED" | "DASHBOARD_FETCH_FAILED";
        message: string;
      };
    };

type RoleRecord = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
};

export async function getDashboardMe(): Promise<DashboardMeResult> {
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
          code: "DASHBOARD_FETCH_FAILED",
          message: "Unable to load your dashboard right now.",
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

    const profileRecord = profile as DashboardProfile;

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role, scope_type, scope_id, status")
      .eq("profile_id", profileRecord.id)
      .eq("status", "active")
      .eq("is_active", true)
      .is("deleted_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (rolesError) {
      return {
        ok: false,
        error: {
          code: "DASHBOARD_FETCH_FAILED",
          message: "Unable to load your dashboard right now.",
        },
      };
    }

    return {
      ok: true,
      data: {
        authEmail: session.user.email,
        profile: profileRecord,
        roles: (roles ?? []) as RoleRecord[],
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "DASHBOARD_FETCH_FAILED",
        message: "Unable to load your dashboard right now.",
      },
    };
  }
}
