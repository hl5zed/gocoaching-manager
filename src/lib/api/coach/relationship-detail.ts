import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  CoachingRelationshipStatus,
  ProfileRow,
  RelationshipType,
  ScopeType,
  UserRole,
} from "@/types/database";

const COACH_LEVEL_ROLES: ReadonlySet<UserRole> = new Set([
  "coach",
  "coach_maker",
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
]);

type CoachProfile = Pick<
  ProfileRow,
  "id" | "display_name" | "full_name" | "email" | "status"
>;

type CoachRoleRow = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
};

type RelationshipRow = {
  id: string;
  coach_profile_id: string;
  coachee_profile_id: string;
  relationship_type: RelationshipType;
  status: CoachingRelationshipStatus;
  scope_type: ScopeType;
  scope_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

type PersonProjection = Pick<ProfileRow, "display_name" | "full_name" | "email">;

export type CoachRelationshipDetail = {
  id: string;
  relationshipType: RelationshipType;
  status: CoachingRelationshipStatus;
  scopeType: ScopeType;
  scopeId: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  coach: PersonProjection | null;
  coachee: PersonProjection | null;
};

export type GetCoachRelationshipDetailResult =
  | {
      ok: true;
      data: {
        profile: CoachProfile | null;
        roles: CoachRoleRow[];
        relationship: CoachRelationshipDetail | null;
      };
    }
  | {
      ok: false;
      error: {
        code: "UNAUTHORIZED" | "FORBIDDEN" | "RELATIONSHIP_DETAIL_FETCH_FAILED";
        message: string;
      };
    };

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

async function getCurrentCoachAccess() {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false as const,
      error: {
        code: "UNAUTHORIZED" as const,
        message: "로그인이 필요합니다.",
      },
    };
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ??
        "Coach relationship detail service client is unavailable.",
    );
    return {
      ok: false as const,
      error: {
        code: "RELATIONSHIP_DETAIL_FETCH_FAILED" as const,
        message: "지금 코칭 관계를 불러올 수 없습니다.",
      },
    };
  }

  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = serviceClient
    .from("profiles")
    .select("id, display_name, full_name, email, status")
    .is("deleted_at", null)
    .neq("status", "anonymized");

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError) {
    logServerError(
      "COACH_PROFILE_LOOKUP_FAILED",
      profileError.message ?? "Coach profile lookup failed.",
    );
    return {
      ok: false as const,
      error: {
        code: "RELATIONSHIP_DETAIL_FETCH_FAILED" as const,
        message: "지금 코칭 관계를 불러올 수 없습니다.",
      },
    };
  }

  if (!profile) {
    return {
      ok: true as const,
      data: {
        serviceClient,
        profile: null,
        roles: [] as CoachRoleRow[],
      },
    };
  }

  const currentProfile = profile as CoachProfile;
  const { data: roles, error: rolesError } = await serviceClient
    .from("user_roles")
    .select("role, scope_type, scope_id, status")
    .eq("profile_id", currentProfile.id)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    logServerError(
      "COACH_ROLE_LOOKUP_FAILED",
      rolesError.message ?? "Coach role lookup failed.",
    );
    return {
      ok: false as const,
      error: {
        code: "RELATIONSHIP_DETAIL_FETCH_FAILED" as const,
        message: "지금 코칭 관계를 불러올 수 없습니다.",
      },
    };
  }

  const activeRoles = (roles ?? []) as CoachRoleRow[];
  const hasCoachRole = activeRoles.some((role) => COACH_LEVEL_ROLES.has(role.role));

  if (!hasCoachRole) {
    return {
      ok: false as const,
      error: {
        code: "FORBIDDEN" as const,
        message: "코치 권한이 없습니다.",
      },
    };
  }

  return {
    ok: true as const,
    data: {
      serviceClient,
      profile: currentProfile,
      roles: activeRoles,
    },
  };
}

export async function getCoachRelationshipDetail(
  relationshipId: string,
): Promise<GetCoachRelationshipDetailResult> {
  const access = await getCurrentCoachAccess();

  if (!access.ok) {
    return access;
  }

  if (access.data.profile === null) {
    return {
      ok: true,
      data: {
        profile: null,
        roles: [],
        relationship: null,
      },
    };
  }

  const { serviceClient, profile, roles } = access.data;
  const { data: relationship, error: relationshipError } = await serviceClient
    .from("coaching_relationships")
    .select(
      "id, coach_profile_id, coachee_profile_id, relationship_type, status, scope_type, scope_id, started_at, ended_at, created_at, updated_at",
    )
    .eq("id", relationshipId)
    .eq("coach_profile_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (relationshipError) {
    logServerError(
      "COACH_RELATIONSHIP_DETAIL_FAILED",
      relationshipError.message ?? "Coach relationship detail fetch failed.",
    );
    return {
      ok: false,
      error: {
        code: "RELATIONSHIP_DETAIL_FETCH_FAILED",
        message: "지금 코칭 관계를 불러올 수 없습니다.",
      },
    };
  }

  if (!relationship) {
    return {
      ok: true,
      data: {
        profile,
        roles,
        relationship: null,
      },
    };
  }

  const relationshipRow = relationship as RelationshipRow;
  const personIds = [relationshipRow.coach_profile_id, relationshipRow.coachee_profile_id];
  const { data: people, error: peopleError } = await serviceClient
    .from("profiles")
    .select("id, display_name, full_name, email")
    .in("id", personIds)
    .is("deleted_at", null);

  if (peopleError) {
    logServerError(
      "COACH_RELATIONSHIP_PEOPLE_FAILED",
      peopleError.message ?? "Coach relationship people fetch failed.",
    );
    return {
      ok: false,
      error: {
        code: "RELATIONSHIP_DETAIL_FETCH_FAILED",
        message: "지금 코칭 관계를 불러올 수 없습니다.",
      },
    };
  }

  const peopleMap = new Map(
    ((people ?? []) as Array<PersonProjection & { id: string }>).map((person) => [
      person.id,
      {
        display_name: person.display_name,
        full_name: person.full_name,
        email: person.email,
      },
    ]),
  );

  return {
    ok: true,
    data: {
      profile,
      roles,
      relationship: {
        id: relationshipRow.id,
        relationshipType: relationshipRow.relationship_type,
        status: relationshipRow.status,
        scopeType: relationshipRow.scope_type,
        scopeId: relationshipRow.scope_id,
        startedAt: relationshipRow.started_at,
        endedAt: relationshipRow.ended_at,
        createdAt: relationshipRow.created_at,
        updatedAt: relationshipRow.updated_at,
        coach: peopleMap.get(relationshipRow.coach_profile_id) ?? null,
        coachee: peopleMap.get(relationshipRow.coachee_profile_id) ?? null,
      },
    },
  };
}
