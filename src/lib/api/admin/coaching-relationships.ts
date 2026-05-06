import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireAdminProfile } from "@/lib/auth/require-admin-profile";
import {
  RELATIONSHIP_TYPES,
  SCOPE_TYPES,
  type CoachingRelationshipStatus,
  type Database,
  type InsertDto,
  type ProfileRow,
  type RelationshipType,
  type ScopeType,
  type UserRole,
} from "@/types/database";

const COACH_SELECTOR_ROLES: UserRole[] = [
  "coach",
  "coach_maker",
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
];

const COACHEE_SELECTOR_ROLES: UserRole[] = ["coachee"];

const allowedRelationshipTypes = new Set<RelationshipType>(RELATIONSHIP_TYPES);
const allowedScopeTypes = new Set<ScopeType>(SCOPE_TYPES);

type PostgrestErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

type RelationshipProfileOptionRow = Pick<
  ProfileRow,
  "id" | "display_name" | "full_name" | "email"
>;

type UserRoleLookupRow = {
  profile_id: string;
};

type CoachingRelationshipInsert = InsertDto<"coaching_relationships">;
type CreatedCoachingRelationshipRow = {
  id: string;
  status: CoachingRelationshipStatus;
};

export type RelationshipProfileOption = {
  id: string;
  displayName: string | null;
  fullName: string | null;
  email: string | null;
};

export type AdminCoachingRelationshipOptionsResult =
  | {
      ok: true;
      data: {
        coaches: RelationshipProfileOption[];
        coachees: RelationshipProfileOption[];
      };
    }
  | {
      ok: false;
      error: {
        status: 401 | 403 | 500;
        code:
          | "AUTH_REQUIRED"
          | "ADMIN_PROFILE_REQUIRED"
          | "ADMIN_ROLE_REQUIRED"
          | "SERVICE_CLIENT_UNAVAILABLE"
          | "COACHING_RELATIONSHIP_OPTIONS_FAILED";
        message: string;
      };
    };

export type CreateAdminCoachingRelationshipResult =
  | {
      ok: true;
      data: {
        relationshipId: string;
        status: CoachingRelationshipStatus;
      };
    }
  | {
      ok: false;
      error: {
        status: 400 | 401 | 403 | 409 | 500;
        code: string;
        message: string;
      };
    };

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

function formatProfileLabel(profile: RelationshipProfileOption) {
  return profile.displayName || profile.fullName || profile.email || profile.id;
}

function sortProfiles(profiles: RelationshipProfileOption[]) {
  return [...profiles].sort((left, right) =>
    formatProfileLabel(left).localeCompare(formatProfileLabel(right)),
  );
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeStartedAt(value: unknown) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return {
      ok: true as const,
      value: null,
    };
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return {
      ok: false as const,
      error: "올바른 시작일을 입력해 주세요.",
    };
  }

  return {
    ok: true as const,
    value: date.toISOString(),
  };
}

function isDuplicateRelationshipError(error: PostgrestErrorLike | null) {
  if (!error) {
    return false;
  }

  const errorText = `${error.message ?? ""} ${error.details ?? ""}`;

  return (
    error.code === "23505" &&
    (errorText.includes("uq_coaching_relationships_active_global") ||
      errorText.includes("uq_coaching_relationships_active_scoped"))
  );
}

function createCoachingRelationshipsTable(
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>["client"]>,
) {
  return serviceClient.from("coaching_relationships") as unknown as {
    insert: (
      values: CoachingRelationshipInsert,
    ) => {
      select: (
        columns: string,
      ) => {
        single: () => Promise<{
          data: CreatedCoachingRelationshipRow | null;
          error: PostgrestErrorLike | null;
        }>;
      };
    };
  };
}

async function getEligibleProfileIdsForRoles(
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>["client"]>,
  roles: UserRole[],
) {
  const { data, error } = await serviceClient
    .from("user_roles")
    .select("profile_id")
    .in("role", roles)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) {
    return {
      ids: [] as string[],
      error,
    };
  }

  const ids = [...new Set(((data ?? []) as UserRoleLookupRow[]).map((row) => row.profile_id))];

  return {
    ids,
    error: null,
  };
}

async function getActiveProfilesByIds(
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>["client"]>,
  profileIds: string[],
) {
  if (profileIds.length === 0) {
    return {
      profiles: [] as RelationshipProfileOption[],
      error: null as PostgrestErrorLike | null,
    };
  }

  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, display_name, full_name, email")
    .in("id", profileIds)
    .eq("status", "active")
    .is("deleted_at", null);

  if (error) {
    return {
      profiles: [] as RelationshipProfileOption[],
      error,
    };
  }

  return {
    profiles: sortProfiles(
      ((data ?? []) as RelationshipProfileOptionRow[]).map((profile) => ({
        id: profile.id,
        displayName: profile.display_name,
        fullName: profile.full_name,
        email: profile.email,
      })),
    ),
    error: null as PostgrestErrorLike | null,
  };
}

async function isEligibleProfile(
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>["client"]>,
  profileId: string,
  roles: UserRole[],
) {
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false as const,
      error: profileError,
    };
  }

  const { data: role, error: roleError } = await serviceClient
    .from("user_roles")
    .select("profile_id")
    .eq("profile_id", profileId)
    .in("role", roles)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1)
    .maybeSingle();

  return {
    ok: !roleError && !!role,
    error: roleError,
  };
}

export async function getAdminCoachingRelationshipOptions(): Promise<AdminCoachingRelationshipOptionsResult> {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return {
      ok: false,
      error: {
        status: admin.status,
        code: admin.code,
        message: admin.message,
      },
    };
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ??
        "Coaching relationship service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message: "코칭 관계 서비스를 지금 사용할 수 없습니다.",
      },
    };
  }

  const coachIdsResult = await getEligibleProfileIdsForRoles(
    serviceClient,
    COACH_SELECTOR_ROLES,
  );

  if (coachIdsResult.error) {
    logServerError(
      "COACH_OPTIONS_LOOKUP_FAILED",
      coachIdsResult.error.message ??
        "Coach role lookup failed for coaching relationship options.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "COACHING_RELATIONSHIP_OPTIONS_FAILED",
        message: "지금 코칭 관계 생성 옵션을 불러올 수 없습니다.",
      },
    };
  }

  const coacheeIdsResult = await getEligibleProfileIdsForRoles(
    serviceClient,
    COACHEE_SELECTOR_ROLES,
  );

  if (coacheeIdsResult.error) {
    logServerError(
      "COACHEE_OPTIONS_LOOKUP_FAILED",
      coacheeIdsResult.error.message ??
        "Coachee role lookup failed for coaching relationship options.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "COACHING_RELATIONSHIP_OPTIONS_FAILED",
        message: "지금 코칭 관계 생성 옵션을 불러올 수 없습니다.",
      },
    };
  }

  const [coachesResult, coacheesResult] = await Promise.all([
    getActiveProfilesByIds(serviceClient, coachIdsResult.ids),
    getActiveProfilesByIds(serviceClient, coacheeIdsResult.ids),
  ]);

  if (coachesResult.error || coacheesResult.error) {
    logServerError(
      "PROFILE_OPTIONS_LOOKUP_FAILED",
      coachesResult.error?.message ??
        coacheesResult.error?.message ??
        "Profile lookup failed for coaching relationship options.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "COACHING_RELATIONSHIP_OPTIONS_FAILED",
        message: "지금 코칭 관계 생성 옵션을 불러올 수 없습니다.",
      },
    };
  }

  return {
    ok: true,
    data: {
      coaches: coachesResult.profiles,
      coachees: coacheesResult.profiles,
    },
  };
}

export async function createAdminCoachingRelationship(input: {
  coach_profile_id?: unknown;
  coachee_profile_id?: unknown;
  relationship_type?: unknown;
  scope_type?: unknown;
  scope_id?: unknown;
  started_at?: unknown;
}): Promise<CreateAdminCoachingRelationshipResult> {
  const admin = await requireAdminProfile();

  if (!admin.ok) {
    return {
      ok: false,
      error: {
        status: admin.status,
        code: admin.code,
        message: admin.message,
      },
    };
  }

  const coachProfileId = normalizeText(input.coach_profile_id);
  const coacheeProfileId = normalizeText(input.coachee_profile_id);
  const relationshipType = normalizeText(input.relationship_type);
  const scopeType = normalizeText(input.scope_type);
  const scopeId = normalizeNullableText(input.scope_id);
  const startedAtResult = normalizeStartedAt(input.started_at);

  if (!coachProfileId) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "MISSING_COACH_PROFILE",
        message: "코치를 선택해 주세요.",
      },
    };
  }

  if (!coacheeProfileId) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "MISSING_COACHEE_PROFILE",
        message: "코치이를 선택해 주세요.",
      },
    };
  }

  if (coachProfileId === coacheeProfileId) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_RELATIONSHIP_PARTICIPANTS",
        message: "코치와 코치이는 서로 달라야 합니다.",
      },
    };
  }

  if (!allowedRelationshipTypes.has(relationshipType as RelationshipType)) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_RELATIONSHIP_TYPE",
        message: "올바른 관계 유형을 선택해 주세요.",
      },
    };
  }

  if (!allowedScopeTypes.has(scopeType as ScopeType)) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_SCOPE_TYPE",
        message: "올바른 범위 유형을 선택해 주세요.",
      },
    };
  }

  if (!startedAtResult.ok) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_STARTED_AT",
        message: startedAtResult.error,
      },
    };
  }

  const normalizedScopeId = scopeType === "global" ? null : scopeId;

  if (scopeType === "global" && scopeId !== null) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_SCOPE_ID",
        message: "전체 범위 관계에는 범위 ID를 넣을 수 없습니다.",
      },
    };
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ??
        "Coaching relationship service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message: "코칭 관계 서비스를 지금 사용할 수 없습니다.",
      },
    };
  }

  const [coachEligibility, coacheeEligibility] = await Promise.all([
    isEligibleProfile(serviceClient, coachProfileId, COACH_SELECTOR_ROLES),
    isEligibleProfile(serviceClient, coacheeProfileId, COACHEE_SELECTOR_ROLES),
  ]);

  if (coachEligibility.error || coacheeEligibility.error) {
    logServerError(
      "RELATIONSHIP_PARTICIPANT_LOOKUP_FAILED",
      coachEligibility.error?.message ??
        coacheeEligibility.error?.message ??
        "Coaching relationship participant lookup failed.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "RELATIONSHIP_PARTICIPANT_LOOKUP_FAILED",
        message: "지금 관계 참여자를 확인할 수 없습니다.",
      },
    };
  }

  if (!coachEligibility.ok) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_COACH_PROFILE",
        message: "올바른 코치 프로필을 선택해 주세요.",
      },
    };
  }

  if (!coacheeEligibility.ok) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_COACHEE_PROFILE",
        message: "올바른 코치이 프로필을 선택해 주세요.",
      },
    };
  }

  const now = new Date().toISOString();
  const relationshipInsert: CoachingRelationshipInsert = {
    coach_profile_id: coachProfileId,
    coachee_profile_id: coacheeProfileId,
    relationship_type: relationshipType as RelationshipType,
    status: "active",
    scope_type: scopeType as ScopeType,
    scope_id: normalizedScopeId,
    started_at: startedAtResult.value ?? now,
    created_at: now,
    updated_at: now,
  };

  const coachingRelationshipsTable =
    createCoachingRelationshipsTable(serviceClient);
  const { data, error } = await coachingRelationshipsTable
    .insert(relationshipInsert)
    .select("id, status")
    .single();

  if (error || !data) {
    if (isDuplicateRelationshipError(error)) {
      return {
        ok: false,
        error: {
          status: 409,
          code: "DUPLICATE_ACTIVE_RELATIONSHIP",
          message: "비슷한 활성 코칭 관계가 이미 있습니다.",
        },
      };
    }

    logServerError(
      "COACHING_RELATIONSHIP_CREATE_FAILED",
      error?.message ?? "Coaching relationship create failed.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "COACHING_RELATIONSHIP_CREATE_FAILED",
        message: "지금 코칭 관계를 생성할 수 없습니다.",
      },
    };
  }

  return {
    ok: true,
    data: {
      relationshipId: data.id,
      status: data.status,
    },
  };
}
