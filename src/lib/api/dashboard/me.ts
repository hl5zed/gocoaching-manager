import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import type { GetSessionResult } from "@/types/auth";
import type { ProfileRow, ScopeType, UserRole } from "@/types/database";

type DashboardPerformanceLogger = {
  mark: (stage: string, resultCount?: number) => void;
};

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

export async function getDashboardMe(
  existingSession?: GetSessionResult,
  perf?: DashboardPerformanceLogger,
): Promise<DashboardMeResult> {
  const session = existingSession ?? (await getSession());

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
    const verifiedProfileId = await getVerifiedProfileId();

    const profileQuery = supabase
      .from("profiles")
      .select("id, email, full_name, display_name, status, created_at")
      .is("deleted_at", null)
      .neq("status", "anonymized");

    const { data: profile, error: profileError } = verifiedProfileId
      ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
      : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

    perf?.mark("auth.profile_lookup", profile ? 1 : 0);

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

    perf?.mark("auth.roles_lookup", roles?.length ?? 0);

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
