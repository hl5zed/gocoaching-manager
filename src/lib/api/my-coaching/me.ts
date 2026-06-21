import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  CoachingRelationshipStatus,
  ProfileRow,
  RelationshipType,
  ScopeType,
  UserRole,
} from "@/types/database";

export type MyCoachingRole = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
};

export type MyCoachingProfile = Pick<
  ProfileRow,
  "id" | "email" | "full_name" | "display_name" | "status" | "timezone" | "organization_id"
>;

type RoleRecord = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
};

type RelationshipRecord = {
  id: string;
  coach_profile_id: string;
  relationship_type: RelationshipType;
  status: CoachingRelationshipStatus;
  scope_type: ScopeType;
  scope_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

type CoachProfileRecord = Pick<
  ProfileRow,
  "id" | "display_name" | "full_name" | "email"
>;

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type MyCoachingRelationship = {
  id: string;
  relationshipType: RelationshipType;
  status: CoachingRelationshipStatus;
  scopeType: ScopeType;
  scopeId: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coach_display_name: string | null;
  coach_full_name: string | null;
  coach_email: string | null;
};

export type MyCoachingMeResult =
  | {
      ok: true;
      data: {
        authEmail: string | null;
        profile: MyCoachingProfile | null;
        roles: MyCoachingRole[];
        relationships: MyCoachingRelationship[];
      };
    }
  | {
      ok: false;
      error: {
        code: "UNAUTHORIZED" | "MY_COACHING_FETCH_FAILED";
        message: string;
      };
    };


export type GetMyCoachingMeOptions = {
  /** user_roles 쿼리 포함 여부 (기본: true). */
  includeRoles?: boolean;
  /** coaching_relationships 및 코치 프로필 쿼리 포함 여부 (기본: true). */
  includeRelationships?: boolean;
};

export async function getMyCoachingMe(
  options?: GetMyCoachingMeOptions,
): Promise<MyCoachingMeResult> {
  const includeRoles = options?.includeRoles ?? true;
  const includeRelationships = options?.includeRelationships ?? true;
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
      .select("id, email, full_name, display_name, status, timezone, organization_id")
      .eq("auth_user_id", session.user.id)
      .is("deleted_at", null)
      .neq("status", "anonymized")
      .maybeSingle();

    if (profileError) {
      return {
        ok: false,
        error: {
          code: "MY_COACHING_FETCH_FAILED",
          message: "Unable to load your coaching space right now.",
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
          relationships: [],
        },
      };
    }

    const profileRecord = profile as MyCoachingProfile;
    const now = new Date().toISOString();

    const [rolesResult, relationshipsResult] = await Promise.all([
      includeRoles
        ? supabase
            .from("user_roles")
            .select("role, scope_type, scope_id, status")
            .eq("profile_id", profileRecord.id)
            .eq("status", "active")
            .eq("is_active", true)
            .is("deleted_at", null)
            .or(`expires_at.is.null,expires_at.gt.${now}`)
        : Promise.resolve({ data: [] as RoleRecord[], error: null }),
      includeRelationships
        ? supabase
            .from("coaching_relationships")
            .select(
              "id, coach_profile_id, relationship_type, status, scope_type, scope_id, started_at, ended_at, created_at, updated_at",
            )
            .eq("coachee_profile_id", profileRecord.id)
            .is("deleted_at", null)
            .order("started_at", { ascending: false })
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as RelationshipRecord[], error: null }),
    ] as const);

    if (rolesResult.error) {
      return {
        ok: false,
        error: {
          code: "MY_COACHING_FETCH_FAILED",
          message: "Unable to load your coaching space right now.",
        },
      };
    }

    if (relationshipsResult.error) {
      return {
        ok: false,
        error: {
          code: "MY_COACHING_FETCH_FAILED",
          message: "Unable to load your coaching space right now.",
        },
      };
    }

    const roles = rolesResult.data;
    const relationshipRows = relationshipsResult.data;

    const rows = (relationshipRows ?? []) as RelationshipRecord[];
    const coachProfileIds = includeRelationships
      ? [
          ...new Set(
            rows
              .map((row) => row.coach_profile_id)
              .filter(
                (coachProfileId): coachProfileId is string =>
                  typeof coachProfileId === "string" && coachProfileId.length > 0,
              ),
          ),
        ]
      : [];

    const coachProfileById = new Map<
      string,
      {
        display_name: string | null;
        full_name: string | null;
        email: string | null;
      }
    >();

    if (coachProfileIds.length > 0) {
      const { client: serviceClient, error: serviceClientError } =
        createSupabaseServiceClient();

      if (!serviceClient || serviceClientError) {
        return {
          ok: false,
          error: {
            code: "MY_COACHING_FETCH_FAILED",
            message: "Unable to load your coaching space right now.",
          },
        };
      }

      const { data: coachProfiles, error: coachProfilesError } = await serviceClient
        .from("profiles")
        .select("id, display_name, full_name, email")
        .in("id", coachProfileIds)
        .is("deleted_at", null);

      if (coachProfilesError) {
        return {
          ok: false,
          error: {
            code: "MY_COACHING_FETCH_FAILED",
            message: "Unable to load your coaching space right now.",
          },
        };
      }

      for (const coachProfile of (coachProfiles ?? []) as CoachProfileRecord[]) {
        coachProfileById.set(coachProfile.id, {
          display_name: normalizeOptionalText(coachProfile.display_name),
          full_name: normalizeOptionalText(coachProfile.full_name),
          email: normalizeOptionalText(coachProfile.email),
        });
      }
    }

    return {
      ok: true,
      data: {
        authEmail: session.user.email,
        profile: profileRecord,
        roles: (roles ?? []) as RoleRecord[],
        relationships: rows.map((row) => {
          const coachProfile = coachProfileById.get(row.coach_profile_id);

          return {
            id: row.id,
            relationshipType: row.relationship_type,
            status: row.status,
            scopeType: row.scope_type,
            scopeId: row.scope_id,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            coach_display_name: coachProfile?.display_name ?? null,
            coach_full_name: coachProfile?.full_name ?? null,
            coach_email: coachProfile?.email ?? null,
          };
        }),
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "MY_COACHING_FETCH_FAILED",
        message: "Unable to load your coaching space right now.",
      },
    };
  }
}
