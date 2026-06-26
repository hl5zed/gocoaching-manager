import { getSession } from "@/lib/auth/getSession";
import {
  ensureCoachLevelAccess,
  getCoachRoleRowsWithHeaderFallback,
  type CoachRoleRow,
} from "@/lib/auth/coach-api-access";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  CoachingRelationshipStatus,
  ProfileRow,
  RelationshipType,
  ScopeType,
} from "@/types/database";

const PAGE_SIZE = 50;

type CoachProfile = Pick<
  ProfileRow,
  "id" | "display_name" | "full_name" | "email" | "status"
>;

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
};

type CoacheeProfile = Pick<ProfileRow, "id" | "display_name" | "full_name" | "email">;

export type CoachRelationshipListItem = {
  id: string;
  coachId: string;
  coacheeId: string;
  relationshipType: RelationshipType;
  status: CoachingRelationshipStatus;
  scopeType: ScopeType;
  scopeId: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  coachee: {
    display_name: string | null;
    full_name: string | null;
    email: string | null;
  } | null;
};

export type CoachRelationshipsFilters = {
  q: string;
  status: "all" | CoachingRelationshipStatus;
  type: "all" | RelationshipType;
  page: number;
};

export type GetCoachRelationshipsResult =
  | {
      ok: true;
      data: {
        profile: CoachProfile | null;
        roles: CoachRoleRow[];
        relationships: CoachRelationshipListItem[];
        filters: CoachRelationshipsFilters;
        pagination: {
          page: number;
          hasNext: boolean;
        };
      };
    }
  | {
      ok: false;
      error: {
        code: "UNAUTHORIZED" | "FORBIDDEN" | "RELATIONSHIPS_FETCH_FAILED";
        message: string;
      };
    };

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizePage(value: string | string[] | undefined) {
  const parsed = Number.parseInt(getSingleValue(value), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function normalizeStatus(value: string | string[] | undefined) {
  const normalized = getSingleValue(value);

  if (
    normalized === "active" ||
    normalized === "paused" ||
    normalized === "ended" ||
    normalized === "archived"
  ) {
    return normalized;
  }

  return "all";
}

function normalizeRelationshipType(value: string | string[] | undefined) {
  const normalized = getSingleValue(value);

  if (
    normalized === "individual_coaching" ||
    normalized === "group_coaching" ||
    normalized === "leadership_coaching" ||
    normalized === "pastoral_coaching" ||
    normalized === "missionary_coaching"
  ) {
    return normalized;
  }

  return "all";
}

function normalizeSearch(value: string | string[] | undefined) {
  return getSingleValue(value).trim();
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
      serviceClientError ?? "Coach relationship service client is unavailable.",
    );
    return {
      ok: false as const,
      error: {
        code: "RELATIONSHIPS_FETCH_FAILED" as const,
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
        code: "RELATIONSHIPS_FETCH_FAILED" as const,
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
  const coachAccess = await ensureCoachLevelAccess(serviceClient, currentProfile.id);

  if (!coachAccess.ok) {
    return {
      ok: false as const,
      error: {
        code: "FORBIDDEN" as const,
        message: coachAccess.message,
      },
    };
  }

  const rolesResult = await getCoachRoleRowsWithHeaderFallback(
    serviceClient,
    currentProfile.id,
  );

  if (!rolesResult.ok) {
    logServerError(
      "COACH_ROLE_LOOKUP_FAILED",
      rolesResult.message,
    );
    return {
      ok: false as const,
      error: {
        code: "RELATIONSHIPS_FETCH_FAILED" as const,
        message: "지금 코칭 관계를 불러올 수 없습니다.",
      },
    };
  }

  return {
    ok: true as const,
    data: {
      serviceClient,
      profile: currentProfile,
      roles: rolesResult.roles,
    },
  };
}

export async function getCoachRelationships(searchParams: {
  q?: string | string[];
  status?: string | string[];
  type?: string | string[];
  page?: string | string[];
}): Promise<GetCoachRelationshipsResult> {
  const access = await getCurrentCoachAccess();

  if (!access.ok) {
    return access;
  }

  const filters: CoachRelationshipsFilters = {
    q: normalizeSearch(searchParams.q),
    status: normalizeStatus(searchParams.status),
    type: normalizeRelationshipType(searchParams.type),
    page: normalizePage(searchParams.page),
  };

  if (access.data.profile === null) {
    return {
      ok: true,
      data: {
        profile: null,
        roles: [],
        relationships: [],
        filters,
        pagination: {
          page: filters.page,
          hasNext: false,
        },
      },
    };
  }

  const { serviceClient, profile, roles } = access.data;
  const { data: relationships, error: relationshipsError } = await serviceClient
    .from("coaching_relationships")
    .select(
      "id, coach_profile_id, coachee_profile_id, relationship_type, status, scope_type, scope_id, started_at, ended_at, created_at",
    )
    .eq("coach_profile_id", profile.id)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (relationshipsError) {
    logServerError(
      "COACH_RELATIONSHIPS_FETCH_FAILED",
      relationshipsError.message ?? "Coach relationships fetch failed.",
    );
    return {
      ok: false,
      error: {
        code: "RELATIONSHIPS_FETCH_FAILED",
        message: "지금 코칭 관계를 불러올 수 없습니다.",
      },
    };
  }

  let relationshipRows = (relationships ?? []) as RelationshipRow[];

  if (filters.status !== "all") {
    relationshipRows = relationshipRows.filter(
      (relationship) => relationship.status === filters.status,
    );
  }

  if (filters.type !== "all") {
    relationshipRows = relationshipRows.filter(
      (relationship) => relationship.relationship_type === filters.type,
    );
  }

  const coacheeIds = [...new Set(relationshipRows.map((row) => row.coachee_profile_id))];
  const { data: coachees, error: coacheesError } = coacheeIds.length
    ? await serviceClient
        .from("profiles")
        .select("id, display_name, full_name, email")
        .in("id", coacheeIds)
        .is("deleted_at", null)
    : { data: [], error: null };

  if (coacheesError) {
    logServerError(
      "COACHEE_PROFILE_FETCH_FAILED",
      coacheesError.message ?? "Coachee profile fetch failed.",
    );
    return {
      ok: false,
      error: {
        code: "RELATIONSHIPS_FETCH_FAILED",
        message: "지금 코칭 관계를 불러올 수 없습니다.",
      },
    };
  }

  const coacheeMap = new Map(
    ((coachees ?? []) as CoacheeProfile[]).map((coachee) => [coachee.id, coachee]),
  );

  let listItems: CoachRelationshipListItem[] = relationshipRows.map((relationship) => {
    const coachee = coacheeMap.get(relationship.coachee_profile_id) ?? null;

    return {
      id: relationship.id,
      coachId: relationship.coach_profile_id,
      coacheeId: relationship.coachee_profile_id,
      relationshipType: relationship.relationship_type,
      status: relationship.status,
      scopeType: relationship.scope_type,
      scopeId: relationship.scope_id,
      startedAt: relationship.started_at,
      endedAt: relationship.ended_at,
      createdAt: relationship.created_at,
      coachee: coachee
        ? {
            display_name: coachee.display_name,
            full_name: coachee.full_name,
            email: coachee.email,
          }
        : null,
    };
  });

  if (filters.q) {
    const query = filters.q.toLowerCase();
    listItems = listItems.filter((relationship) => {
      const haystacks = [
        relationship.coachee?.display_name,
        relationship.coachee?.full_name,
        relationship.coachee?.email,
      ];

      return haystacks.some(
        (value) => typeof value === "string" && value.toLowerCase().includes(query),
      );
    });
  }

  const startIndex = (filters.page - 1) * PAGE_SIZE;
  const pagedItems = listItems.slice(startIndex, startIndex + PAGE_SIZE + 1);
  const hasNext = pagedItems.length > PAGE_SIZE;

  return {
    ok: true,
    data: {
      profile,
      roles,
      relationships: hasNext ? pagedItems.slice(0, PAGE_SIZE) : pagedItems,
      filters,
      pagination: {
        page: filters.page,
        hasNext,
      },
    },
  };
}
