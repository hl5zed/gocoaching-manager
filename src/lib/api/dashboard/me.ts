import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { getActiveAnnouncementsForCurrentUser } from "@/lib/api/admin/system-announcements";
import type { SystemAnnouncement } from "@/lib/api/admin/system-announcements";
import { isActiveLocale } from "@/lib/i18n/config";
import { setCachedProfileLocale } from "@/lib/i18n/locale-cache";
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
  | "id"
  | "email"
  | "full_name"
  | "display_name"
  | "status"
  | "created_at"
  | "preferred_locale"
>;

export type DashboardMeResult =
  | {
      ok: true;
      data: {
        authEmail: string | null;
        profile: DashboardProfile | null;
        roles: DashboardRole[];
        announcements: SystemAnnouncement[];
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

const PROFILE_SELECT =
  "id, email, full_name, display_name, status, created_at, preferred_locale";

const ROLES_SELECT = "role, scope_type, scope_id, status";

const dashboardProfileInflight = new Map<string, Promise<DashboardProfile | null>>();
const dashboardRolesInflight = new Map<string, Promise<RoleRecord[]>>();

function logDevInflightDedupeHit(stage: "auth.profile_lookup" | "auth.roles_lookup") {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info(
    `[API_PERFORMANCE] ${JSON.stringify({
      route: "/dashboard",
      stage: `${stage}.dedupe`,
      resultCount: 1,
    })}`,
  );
}

function profileInflightKey(authUserId: string, verifiedProfileId: string | null) {
  return verifiedProfileId ?? `auth:${authUserId}`;
}

function rolesQueryForProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string,
) {
  return supabase
    .from("user_roles")
    .select(ROLES_SELECT)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
}

async function loadDashboardProfile(
  authUserId: string,
  verifiedProfileId: string | null,
): Promise<DashboardProfile | null> {
  const key = profileInflightKey(authUserId, verifiedProfileId);
  const inflight = dashboardProfileInflight.get(key);

  if (inflight) {
    logDevInflightDedupeHit("auth.profile_lookup");
    return inflight;
  }

  const promise = (async () => {
    const supabase = await createSupabaseServerClient();

    const profileQuery = supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .is("deleted_at", null)
      .neq("status", "anonymized");

    const { data: profile, error: profileError } = verifiedProfileId
      ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
      : await profileQuery.eq("auth_user_id", authUserId).maybeSingle();

    if (profileError || !profile) {
      return null;
    }

    const profileRecord = profile as DashboardProfile;

    if (isActiveLocale(profileRecord.preferred_locale)) {
      setCachedProfileLocale(authUserId, profileRecord.preferred_locale);
    } else {
      setCachedProfileLocale(authUserId, null);
    }

    return profileRecord;
  })().finally(() => {
    dashboardProfileInflight.delete(key);
  });

  dashboardProfileInflight.set(key, promise);
  return promise;
}

async function loadDashboardRoles(profileId: string): Promise<RoleRecord[]> {
  const inflight = dashboardRolesInflight.get(profileId);

  if (inflight) {
    logDevInflightDedupeHit("auth.roles_lookup");
    return inflight;
  }

  const promise = (async () => {
    const supabase = await createSupabaseServerClient();
    const { data: roleRows, error: rolesError } = await rolesQueryForProfile(
      supabase,
      profileId,
    );

    if (rolesError) {
      throw new Error("DASHBOARD_ROLES_LOOKUP_FAILED");
    }

    return (roleRows ?? []) as RoleRecord[];
  })().finally(() => {
    dashboardRolesInflight.delete(profileId);
  });

  dashboardRolesInflight.set(profileId, promise);
  return promise;
}

/**
 * 요청당 1회 — dashboard SSR 내 getDashboardMe 호출 간 profile 조회 dedupe.
 * 동시 /dashboard 요청 간 dedupe는 loadDashboardProfile in-flight Map이 담당한다.
 */
export const getCachedDashboardProfile = cache(async (): Promise<DashboardProfile | null> => {
  const session = await getSession();

  if (!session.user) {
    return null;
  }

  const verifiedProfileId = await getVerifiedProfileId();
  return loadDashboardProfile(session.user.id, verifiedProfileId);
});

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
    // When the middleware has already looked up the profile (i.e. PROFILE_ID_HEADER
    // is set), we know the profile ID up front and can fire the profile-data fetch
    // and the roles fetch in parallel instead of sequentially.
    const verifiedProfileId = await getVerifiedProfileId();

    let profile: DashboardProfile | null;
    let roles: RoleRecord[];

    if (verifiedProfileId) {
      // Parallel path: profile (by PK) + roles start at the same time.
      let rolesResult: PromiseSettledResult<RoleRecord[]>;
      let profileResult: PromiseSettledResult<DashboardProfile | null>;

      [profileResult, rolesResult] = await Promise.allSettled([
        getCachedDashboardProfile(),
        loadDashboardRoles(verifiedProfileId),
      ]);

      profile = profileResult.status === "fulfilled" ? profileResult.value : null;
      perf?.mark("auth.profile_lookup", profile ? 1 : 0);

      if (!profile) {
        return {
          ok: true,
          data: {
            authEmail: session.user.email,
            profile: null,
            roles: [],
            announcements: [],
          },
        };
      }

      if (rolesResult.status === "rejected") {
        return {
          ok: false,
          error: {
            code: "DASHBOARD_FETCH_FAILED",
            message: "Unable to load your dashboard right now.",
          },
        };
      }

      roles = rolesResult.value;
      perf?.mark("auth.roles_lookup", roles.length);
    } else {
      // Sequential fallback: fetch profile first (by auth_user_id), then roles.
      profile = await getCachedDashboardProfile();
      perf?.mark("auth.profile_lookup", profile ? 1 : 0);

      if (!profile) {
        return {
          ok: true,
          data: {
            authEmail: session.user.email,
            profile: null,
            roles: [],
            announcements: [],
          },
        };
      }

      try {
        roles = await loadDashboardRoles(profile.id);
      } catch {
        return {
          ok: false,
          error: {
            code: "DASHBOARD_FETCH_FAILED",
            message: "Unable to load your dashboard right now.",
          },
        };
      }

      perf?.mark("auth.roles_lookup", roles.length);
    }

    const roleValues = roles.map((role) => role.role);
    const announcements = await getActiveAnnouncementsForCurrentUser({
      placement: "dashboard",
      roles: roleValues,
    });
    perf?.mark("dashboard.announcements_query", announcements.length);

    return {
      ok: true,
      data: {
        authEmail: session.user.email,
        profile,
        roles,
        announcements,
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
