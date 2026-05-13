import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  CoachingRelationshipStatus,
  InsertDto,
  ScopeType,
  UpdateDto,
  UserRole,
} from "@/types/database";

type PostgrestErrorLike = {
  code?: string;
  details?: string | null;
  message: string;
};
type CoachingRelationshipInsert = InsertDto<"coaching_relationships">;
type ProfileUpdate = UpdateDto<"profiles">;
type InsertedRelationshipId = { id: string };

type AuthRoleScope = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
};

type ProfileLookupRow = {
  id: string;
};

type UserRoleScopeRow = AuthRoleScope & {
  expires_at: string | null;
};

type RelationshipRow = {
  id: string;
  coach_profile_id: string;
  coachee_profile_id: string;
  status: CoachingRelationshipStatus;
  scope_type: ScopeType;
  scope_id: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  primary_role: UserRole | null;
  ministry_position: string | null;
  status: string;
  country_id: string | null;
  region_id: string | null;
  organization_id: string | null;
  church_id: string | null;
  generation_number: number | null;
};

type CountryRow = {
  id: string;
  name: string;
  code: string;
};

type RegionRow = {
  id: string;
  name: string;
  country_id: string | null;
};

type NameRow = {
  id: string;
  name: string;
};

type CandidateRoleRow = {
  profile_id: string;
  role: UserRole;
};

type GenerationOptionRow = {
  generation_number: number;
  label: string;
};

type GenerationHistoryRow = {
  id: string;
  profile_id: string;
  old_generation_number: number | null;
  new_generation_number: number | null;
  changed_by_auth_user_id: string | null;
  changed_by_profile_id: string | null;
  change_source: string;
  reason: string | null;
  created_at: string;
};

type HistoryRoleRow = {
  profile_id: string;
  role: UserRole;
};

function createAssignRelationshipTable(client: ServiceClient) {
  return client.from("coaching_relationships") as unknown as {
    insert: (values: CoachingRelationshipInsert) => {
      select: (columns: string) => {
        single: () => Promise<{
          data: InsertedRelationshipId | null;
          error: PostgrestErrorLike | null;
        }>;
      };
    };
  };
}

function createAssignProfileTable(client: ServiceClient) {
  return client.from("profiles") as unknown as {
    update: (values: ProfileUpdate) => {
      in: (
        column: "id",
        values: string[],
      ) => Promise<{
        error: PostgrestErrorLike | null;
      }>;
    };
  };
}

export type GenealogyNode = {
  id: string;
  label: string;
  generationNumber: number | null;
  primaryRole: UserRole | null;
  ministryPosition: string | null;
  status: string;
  countryId: string | null;
  countryName: string | null;
  countryCode: string | null;
  organizationId: string | null;
  organizationName: string | null;
  churchId: string | null;
  churchName: string | null;
  activeCoachCount: number;
  activeCoacheeCount: number;
};

export type GenealogyEdge = {
  id: string;
  source: string;
  target: string;
  relationshipId: string;
  status: CoachingRelationshipStatus;
  scopeType: ScopeType;
  scopeId: string | null;
};

export type GenealogySummaryStats = {
  totalCoaches: number;
  totalCoachees: number;
  totalActiveRelationships: number;
  maxGeneration: number;
  totalCountries: number;
  totalOrganizations: number;
  totalChurches: number;
};

export type GenerationBreakdownItem = {
  generationNumber: number | null;
  label: string;
  profileCount: number;
};

export type GenerationStat = {
  generationNumber: number | null;
  label: string;
  profileCount: number;
  coachCount: number;
  coacheeCount: number;
  relationshipCount: number;
};

export type CountryStat = {
  countryId: string | null;
  countryName: string;
  countryCode: string | null;
  profileCount: number;
  coachCount: number;
  coacheeCount: number;
  relationshipCount: number;
  generationBreakdown: GenerationBreakdownItem[];
};

export type RegionStat = {
  regionId: string;
  regionName: string;
  profileCount: number;
  relationshipCount: number;
};

export type ChurchStat = {
  churchId: string | null;
  churchName: string;
  profileCount: number;
  coachCount: number;
  coacheeCount: number;
  relationshipCount: number;
  generationBreakdown: GenerationBreakdownItem[];
};

export type MapMarker = {
  markerType: "country" | "region" | "church";
  id: string | null;
  name: string;
  code: string | null;
  latitude: number | null;
  longitude: number | null;
  profileCount: number;
  coachCount: number;
  coacheeCount: number;
  relationshipCount: number;
  generationBreakdown: GenerationBreakdownItem[];
};

export type CircularRelationshipWarning = {
  relationshipId: string;
  source: string;
  target: string;
};

export type MissingGenerationProfile = {
  profileId: string;
  label: string;
};

export type GenerationMismatchWarning = {
  relationshipId: string;
  coachProfileId: string;
  coachLabel: string;
  coachGenerationNumber: number;
  coacheeProfileId: string;
  coacheeLabel: string;
  coacheeGenerationNumber: number;
  expectedCoacheeGenerationNumber: number;
};

export type GenealogyDiagnostics = {
  circularRelationships: CircularRelationshipWarning[];
  missingGenerationProfiles: MissingGenerationProfile[];
  generationMismatchWarnings: GenerationMismatchWarning[];
};

export type GenealogyFilters = {
  countryId: string | null;
  regionId: string | null;
  organizationId: string | null;
  churchId: string | null;
  generationNumber: number | null;
  coachProfileId: string | null;
  q: string | null;
  role: UserRole | "all";
  status: CoachingRelationshipStatus;
};

export type AssignCandidate = {
  profileId: string;
  label: string;
  email: string | null;
  generationNumber: number | null;
  primaryRole: UserRole | null;
  roles: UserRole[];
  countryId: string | null;
  countryName: string | null;
  countryCode: string | null;
  organizationId: string | null;
  organizationName: string | null;
  churchId: string | null;
  churchName: string | null;
  activeCoacheeCount: number;
  currentCoachId: string | null;
  currentCoachLabel: string | null;
  assignmentStatus: "assigned_to_selected_coach" | "assigned" | "unassigned";
};

export type AssignRelationship = {
  relationshipId: string;
  coachProfileId: string;
  coachLabel: string;
  coacheeProfileId: string;
  coacheeLabel: string;
  coachGenerationNumber: number | null;
  coacheeGenerationNumber: number | null;
  countryName: string | null;
  countryCode: string | null;
  churchName: string | null;
  status: CoachingRelationshipStatus;
  scopeType: ScopeType;
  scopeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssignGenerationOption = {
  generationNumber: number;
  label: string;
};

export type GenealogyAssignData = {
  coaches: AssignCandidate[];
  coachees: AssignCandidate[];
  relationships: AssignRelationship[];
  generationOptions: AssignGenerationOption[];
};

export type CoachingGenealogyData = {
  nodes: GenealogyNode[];
  edges: GenealogyEdge[];
  summaryStats: GenealogySummaryStats;
  generationStats: GenerationStat[];
  countryStats: CountryStat[];
  regionStats: RegionStat[];
  churchStats: ChurchStat[];
  mapMarkers: MapMarker[];
  filters: GenealogyFilters;
  diagnostics: GenealogyDiagnostics;
  assignData: GenealogyAssignData;
};

export type CoachingGenealogyResult =
  | {
      ok: true;
      data: CoachingGenealogyData;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      error: {
        code:
          | "AUTH_REQUIRED"
          | "PROFILE_REQUIRED"
          | "ADMIN_ROLE_REQUIRED"
          | "SERVICE_CLIENT_UNAVAILABLE"
          | "GENEALOGY_QUERY_FAILED";
        message: string;
      };
    };

export type AssignCoachingGenealogyInput = {
  coachProfileId?: unknown;
  coacheeProfileIds?: unknown;
  generationNumber?: unknown;
  scopeType?: unknown;
  scopeId?: unknown;
};

export type AssignResultItem = {
  coacheeProfileId: string;
  relationshipId?: string;
  message: string;
};

export type AssignCoachingGenealogyResult =
  | {
      ok: true;
      data: {
        success: boolean;
        created: AssignResultItem[];
        updatedGenerations: Array<{
          profileId: string;
          generationNumber: number;
        }>;
        skipped: AssignResultItem[];
        errors: AssignResultItem[];
      };
    }
  | {
      ok: false;
      status: 400 | 401 | 403 | 500;
      error: {
        code:
          | "AUTH_REQUIRED"
          | "PROFILE_REQUIRED"
          | "ADMIN_ROLE_REQUIRED"
          | "SERVICE_CLIENT_UNAVAILABLE"
          | "INVALID_INPUT"
          | "ASSIGNMENT_FAILED";
        message: string;
      };
    };

export type GenerationHistoryFilters = {
  profileId: string | null;
  changedByProfileId: string | null;
  countryId: string | null;
  organizationId: string | null;
  churchId: string | null;
  oldGenerationNumber: number | null;
  newGenerationNumber: number | null;
  generationNumber: number | null;
  changeSource: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string | null;
  page: number;
  pageSize: number;
};

export type GenerationHistoryItem = {
  id: string;
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  oldGenerationNumber: number | null;
  newGenerationNumber: number | null;
  oldGenerationLabel: string;
  newGenerationLabel: string;
  changedByAuthUserId: string | null;
  changedByProfileId: string | null;
  changedByName: string;
  changeSource: string;
  reason: string | null;
  createdAt: string;
  countryName: string;
  countryCode: string | null;
  organizationName: string;
  churchName: string;
  currentRoleSummary: string;
  currentStatus: string;
};

export type GenerationHistorySummary = {
  totalChanges: number;
  last7DaysChanges: number;
  last30DaysChanges: number;
  mostChangedGeneration: string;
  changedProfileCount: number;
};

export type GenerationHistoryData = {
  items: GenerationHistoryItem[];
  summary: GenerationHistorySummary;
  filters: GenerationHistoryFilters;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  options: {
    changedByProfiles: Array<{ id: string; label: string }>;
    changeSources: string[];
  };
};

export type GenerationHistoryResult =
  | {
      ok: true;
      data: GenerationHistoryData;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      error: {
        code:
          | "AUTH_REQUIRED"
          | "PROFILE_REQUIRED"
          | "ADMIN_ROLE_REQUIRED"
          | "SERVICE_CLIENT_UNAVAILABLE"
          | "GENERATION_HISTORY_QUERY_FAILED";
        message: string;
      };
    };

const GENEALOGY_ACCESS_ROLES: UserRole[] = [
  "super_admin",
  "country_admin",
  "organization_admin",
  "church_admin",
  "coach_maker",
];

const COUNTRY_COORDINATES: Record<string, { latitude: number; longitude: number }> =
  {
    AU: { latitude: -25.2744, longitude: 133.7751 },
    CA: { latitude: 56.1304, longitude: -106.3468 },
    CN: { latitude: 35.8617, longitude: 104.1954 },
    DE: { latitude: 51.1657, longitude: 10.4515 },
    FR: { latitude: 46.2276, longitude: 2.2137 },
    GB: { latitude: 55.3781, longitude: -3.436 },
    ID: { latitude: -0.7893, longitude: 113.9213 },
    IN: { latitude: 20.5937, longitude: 78.9629 },
    JP: { latitude: 36.2048, longitude: 138.2529 },
    KH: { latitude: 12.5657, longitude: 104.991 },
    KR: { latitude: 35.9078, longitude: 127.7669 },
    LA: { latitude: 19.8563, longitude: 102.4955 },
    MM: { latitude: 21.9162, longitude: 95.956 },
    MY: { latitude: 4.2105, longitude: 101.9758 },
    NZ: { latitude: -40.9006, longitude: 174.886 },
    PH: { latitude: 12.8797, longitude: 121.774 },
    SG: { latitude: 1.3521, longitude: 103.8198 },
    TH: { latitude: 15.87, longitude: 100.9925 },
    US: { latitude: 37.0902, longitude: -95.7129 },
    VN: { latitude: 14.0583, longitude: 108.2772 },
  };

function normalizeText(value: string | null) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function normalizeId(value: string | null) {
  return normalizeText(value);
}

function normalizeUuidFilter(value: string | null) {
  const normalized = normalizeText(value);

  if (!normalized || normalized === "all") {
    return null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized,
  )
    ? normalized
    : null;
}

function parseGenerationNumber(value: string | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeStatus(value: string | null): CoachingRelationshipStatus {
  if (
    value === "active" ||
    value === "paused" ||
    value === "ended" ||
    value === "archived"
  ) {
    return value;
  }

  return "active";
}

function normalizeRoleFilter(value: string | null): UserRole | "all" {
  if (
    value === "super_admin" ||
    value === "country_admin" ||
    value === "organization_admin" ||
    value === "church_admin" ||
    value === "group_leader" ||
    value === "coach_maker" ||
    value === "coach" ||
    value === "coachee"
  ) {
    return value;
  }

  return "all";
}

function normalizeScopeType(value: unknown): ScopeType | null {
  if (
    value === "global" ||
    value === "country" ||
    value === "region" ||
    value === "organization" ||
    value === "church" ||
    value === "group" ||
    value === "cohort" ||
    value === "coach"
  ) {
    return value;
  }

  return null;
}

function parsePageNumber(value: string | null) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value: string | null) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 20;
  }

  return Math.min(parsed, 100);
}

function normalizeDateFilter(value: string | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return normalized;
}

export function parseGenerationHistoryFilters(
  searchParams: URLSearchParams,
): GenerationHistoryFilters {
  return {
    profileId: normalizeUuidFilter(searchParams.get("profileId")),
    changedByProfileId: normalizeUuidFilter(
      searchParams.get("changedByProfileId"),
    ),
    countryId: normalizeUuidFilter(searchParams.get("countryId")),
    organizationId: normalizeUuidFilter(searchParams.get("organizationId")),
    churchId: normalizeUuidFilter(searchParams.get("churchId")),
    oldGenerationNumber: parseGenerationNumber(
      searchParams.get("oldGenerationNumber"),
    ),
    newGenerationNumber: parseGenerationNumber(
      searchParams.get("newGenerationNumber"),
    ),
    generationNumber: parseGenerationNumber(searchParams.get("generationNumber")),
    changeSource: normalizeText(searchParams.get("changeSource")),
    dateFrom: normalizeDateFilter(searchParams.get("dateFrom")),
    dateTo: normalizeDateFilter(searchParams.get("dateTo")),
    search: normalizeText(searchParams.get("search")),
    page: parsePageNumber(searchParams.get("page")),
    pageSize: parsePageSize(searchParams.get("pageSize")),
  };
}

export function parseGenealogyFilters(
  searchParams: URLSearchParams,
): GenealogyFilters {
  return {
    countryId: normalizeId(searchParams.get("countryId")),
    regionId: normalizeId(searchParams.get("regionId")),
    organizationId: normalizeId(searchParams.get("organizationId")),
    churchId: normalizeId(searchParams.get("churchId")),
    generationNumber: parseGenerationNumber(searchParams.get("generationNumber")),
    coachProfileId: normalizeId(searchParams.get("coachProfileId")),
    q: normalizeText(searchParams.get("q")),
    role: normalizeRoleFilter(searchParams.get("role")),
    status: normalizeStatus(searchParams.get("status")),
  };
}

function emptyData(filters: GenealogyFilters): CoachingGenealogyData {
  return {
    nodes: [],
    edges: [],
    summaryStats: {
      totalCoaches: 0,
      totalCoachees: 0,
      totalActiveRelationships: 0,
      maxGeneration: 0,
      totalCountries: 0,
      totalOrganizations: 0,
      totalChurches: 0,
    },
    generationStats: [],
    countryStats: [],
    regionStats: [],
    churchStats: [],
    mapMarkers: [],
    filters,
    diagnostics: {
      circularRelationships: [],
      missingGenerationProfiles: [],
      generationMismatchWarnings: [],
    },
    assignData: {
      coaches: [],
      coachees: [],
      relationships: [],
      generationOptions: [],
    },
  };
}

function uniqueValues(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function labelForProfile(profile: ProfileRow) {
  return (
    normalizeText(profile.display_name) ??
    normalizeText(profile.full_name) ??
    normalizeText(profile.email) ??
    `profile-${profile.id.slice(0, 8)}`
  );
}

function generationLabel(generationNumber: number | null) {
  return generationNumber && Number.isFinite(generationNumber)
    ? `${generationNumber}세대`
    : "미지정";
}

function makeBreakdown(nodes: GenealogyNode[]) {
  const map = new Map<number | "missing", GenerationBreakdownItem>();

  for (const node of nodes) {
    const key = node.generationNumber ?? "missing";
    const current = map.get(key) ?? {
      generationNumber: node.generationNumber,
      label: generationLabel(node.generationNumber),
      profileCount: 0,
    };

    current.profileCount += 1;
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.generationNumber === null) {
      return 1;
    }

    if (b.generationNumber === null) {
      return -1;
    }

    return a.generationNumber - b.generationNumber;
  });
}

function countRelationshipInvolving(
  edges: GenealogyEdge[],
  profileIds: Set<string>,
) {
  return edges.filter(
    (edge) => profileIds.has(edge.source) || profileIds.has(edge.target),
  ).length;
}

function groupItems<T, K extends string>(
  items: T[],
  getKey: (item: T) => K,
) {
  const grouped = new Map<K, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }

  return Array.from(grouped.entries());
}

function profileMatchesScope(
  profile: ProfileRow | undefined,
  scope: AuthRoleScope,
) {
  if (!profile) {
    return false;
  }

  if (scope.scope_type === "global") {
    return true;
  }

  if (!scope.scope_id) {
    return false;
  }

  if (scope.scope_type === "country") {
    return profile.country_id === scope.scope_id;
  }

  if (scope.scope_type === "region") {
    return profile.region_id === scope.scope_id;
  }

  if (scope.scope_type === "organization") {
    return profile.organization_id === scope.scope_id;
  }

  if (scope.scope_type === "church") {
    return profile.church_id === scope.scope_id;
  }

  return false;
}

function relationshipMatchesScope(
  relationship: RelationshipRow,
  coach: ProfileRow | undefined,
  coachee: ProfileRow | undefined,
  scopes: AuthRoleScope[],
) {
  if (scopes.some((scope) => scope.role === "super_admin")) {
    return true;
  }

  return scopes.some((scope) => {
    if (scope.scope_type === "global") {
      return true;
    }

    if (
      scope.scope_id &&
      relationship.scope_type === scope.scope_type &&
      relationship.scope_id === scope.scope_id
    ) {
      return true;
    }

    return profileMatchesScope(coach, scope) || profileMatchesScope(coachee, scope);
  });
}

function relationshipMatchesFilters(
  relationship: RelationshipRow,
  coach: ProfileRow | undefined,
  coachee: ProfileRow | undefined,
  filters: GenealogyFilters,
) {
  if (filters.coachProfileId && relationship.coach_profile_id !== filters.coachProfileId) {
    return false;
  }

  const candidates = [coach, coachee].filter(
    (profile): profile is ProfileRow => Boolean(profile),
  );

  if (
    filters.countryId &&
    !candidates.some((profile) => profile.country_id === filters.countryId)
  ) {
    return false;
  }

  if (
    filters.regionId &&
    !candidates.some((profile) => profile.region_id === filters.regionId)
  ) {
    return false;
  }

  if (
    filters.organizationId &&
    !candidates.some((profile) => profile.organization_id === filters.organizationId)
  ) {
    return false;
  }

  if (
    filters.churchId &&
    !candidates.some((profile) => profile.church_id === filters.churchId)
  ) {
    return false;
  }

  if (
    filters.generationNumber &&
    !candidates.some(
      (profile) => profile.generation_number === filters.generationNumber,
    )
  ) {
    return false;
  }

  return true;
}

function profileMatchesFilters(profile: ProfileRow, filters: GenealogyFilters) {
  if (filters.countryId && profile.country_id !== filters.countryId) {
    return false;
  }

  if (filters.regionId && profile.region_id !== filters.regionId) {
    return false;
  }

  if (filters.organizationId && profile.organization_id !== filters.organizationId) {
    return false;
  }

  if (filters.churchId && profile.church_id !== filters.churchId) {
    return false;
  }

  if (
    filters.generationNumber &&
    profile.generation_number !== filters.generationNumber
  ) {
    return false;
  }

  if (filters.q) {
    const q = filters.q.toLowerCase();
    const searchable = [
      profile.display_name,
      profile.full_name,
      profile.email,
      profile.ministry_position,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase();

    if (!searchable.includes(q)) {
      return false;
    }
  }

  return true;
}

function detectCircularRelationships(edges: GenealogyEdge[]) {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const targets = adjacency.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  }

  function hasPath(start: string, target: string, visited = new Set<string>()): boolean {
    if (start === target) {
      return true;
    }

    if (visited.has(start)) {
      return false;
    }

    visited.add(start);

    for (const next of adjacency.get(start) ?? []) {
      if (hasPath(next, target, visited)) {
        return true;
      }
    }

    return false;
  }

  return edges
    .filter((edge) => hasPath(edge.target, edge.source))
    .map((edge) => ({
      relationshipId: edge.relationshipId,
      source: edge.source,
      target: edge.target,
    }));
}

async function resolveGenealogyAccess() {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false as const,
      status: 401 as const,
      code: "AUTH_REQUIRED" as const,
      message: "로그인이 필요합니다.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", session.user.id)
    .neq("status", "anonymized")
    .is("deleted_at", null)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "PROFILE_REQUIRED" as const,
      message: "관리자 프로필을 확인할 수 없습니다.",
    };
  }

  const profileRecord = profile as ProfileLookupRow;
  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role, scope_type, scope_id, expires_at")
    .eq("profile_id", profileRecord.id)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (roleError) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "ADMIN_ROLE_REQUIRED" as const,
      message: "관리자 권한을 확인할 수 없습니다.",
    };
  }

  const roleRows = (roles ?? []) as UserRoleScopeRow[];
  const allowedScopes = roleRows.filter((role) =>
    GENEALOGY_ACCESS_ROLES.includes(role.role),
  );

  if (allowedScopes.length === 0) {
    return {
      ok: false as const,
      status: 403 as const,
      code: "ADMIN_ROLE_REQUIRED" as const,
      message: "관리자 또는 코치메이커 권한이 필요합니다.",
    };
  }

  return {
    ok: true as const,
    profileId: profileRecord.id,
    authUserId: session.user.id,
    scopes: allowedScopes,
  };
}

function getLookupMaps(
  countries: CountryRow[],
  organizations: NameRow[],
  churches: NameRow[],
) {
  return {
    countryMap: new Map(countries.map((country) => [country.id, country])),
    organizationMap: new Map(
      organizations.map((organization) => [organization.id, organization]),
    ),
    churchMap: new Map(churches.map((church) => [church.id, church])),
  };
}

function candidateFromProfile({
  activeRelationships,
  countryMap,
  organizationMap,
  churchMap,
  profile,
  profileRoles,
  selectedCoachId,
}: {
  activeRelationships: RelationshipRow[];
  countryMap: Map<string, CountryRow>;
  organizationMap: Map<string, NameRow>;
  churchMap: Map<string, NameRow>;
  profile: ProfileRow;
  profileRoles: UserRole[];
  selectedCoachId: string | null;
}) {
  const country = profile.country_id ? countryMap.get(profile.country_id) : null;
  const organization = profile.organization_id
    ? organizationMap.get(profile.organization_id)
    : null;
  const church = profile.church_id ? churchMap.get(profile.church_id) : null;
  const currentRelationship =
    activeRelationships.find(
      (relationship) => relationship.coachee_profile_id === profile.id,
    ) ?? null;
  const currentCoach = currentRelationship
    ? activeRelationships.find(
        (relationship) =>
          relationship.coachee_profile_id === profile.id &&
          relationship.coach_profile_id === currentRelationship.coach_profile_id,
      )
    : null;
  const activeCoacheeCount = activeRelationships.filter(
    (relationship) => relationship.coach_profile_id === profile.id,
  ).length;

  return {
    profileId: profile.id,
    label: labelForProfile(profile),
    email: profile.email,
    generationNumber: profile.generation_number,
    primaryRole: profile.primary_role,
    roles: profileRoles,
    countryId: profile.country_id,
    countryName: country?.name ?? null,
    countryCode: country?.code ?? null,
    organizationId: profile.organization_id,
    organizationName: organization?.name ?? null,
    churchId: profile.church_id,
    churchName: church?.name ?? null,
    activeCoacheeCount,
    currentCoachId: currentRelationship?.coach_profile_id ?? null,
    currentCoachLabel: null,
    assignmentStatus:
      currentRelationship?.coach_profile_id && selectedCoachId
        ? currentRelationship.coach_profile_id === selectedCoachId
          ? "assigned_to_selected_coach"
          : "assigned"
        : currentRelationship
          ? "assigned"
          : "unassigned",
  } satisfies AssignCandidate;
}

function addCurrentCoachLabels(
  candidates: AssignCandidate[],
  candidateMap: Map<string, AssignCandidate>,
) {
  return candidates.map((candidate) => ({
    ...candidate,
    currentCoachLabel: candidate.currentCoachId
      ? candidateMap.get(candidate.currentCoachId)?.label ?? "담당 코치 확인 필요"
      : null,
  }));
}

function normalizeAssignId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeAssignIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => normalizeAssignId(item))
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

function normalizeAssignGeneration(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}

type ServiceClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;

async function loadAssignData({
  accessScopes,
  activeRelationships,
  client,
  filters,
}: {
  accessScopes: AuthRoleScope[];
  activeRelationships: RelationshipRow[];
  client: ServiceClient;
  filters: GenealogyFilters;
}): Promise<GenealogyAssignData> {
  const [{ data: roleData, error: roleError }, { data: optionData, error: optionError }] =
    await Promise.all([
      client
        .from("user_roles")
        .select("profile_id, role")
        .in("role", ["coach", "coach_maker", "coachee"])
        .eq("status", "active")
        .eq("is_active", true)
        .is("deleted_at", null),
      client
        .from("generation_options")
        .select("generation_number, label")
        .eq("scope_type", "global")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("generation_number", { ascending: true }),
    ]);

  if (roleError || optionError) {
    console.error("[COACHING_GENEALOGY_ASSIGN_LOOKUP_FAILED]", {
      generationOptions: optionError?.message,
      roles: roleError?.message,
    });
    return {
      coaches: [],
      coachees: [],
      relationships: [],
      generationOptions: [],
    };
  }

  const candidateRoles = (roleData ?? []) as CandidateRoleRow[];
  const candidateProfileIds = uniqueValues(
    candidateRoles.map((role) => role.profile_id),
  );

  const generationOptions = ((optionData ?? []) as GenerationOptionRow[]).map(
    (option) => ({
      generationNumber: option.generation_number,
      label: option.label,
    }),
  );

  if (candidateProfileIds.length === 0) {
    return {
      coaches: [],
      coachees: [],
      relationships: [],
      generationOptions,
    };
  }

  const { data: profileData, error: profileError } = await client
    .from("profiles")
    .select(
      "id, email, full_name, display_name, primary_role, ministry_position, status, country_id, region_id, organization_id, church_id, generation_number",
    )
    .in("id", candidateProfileIds)
    .eq("status", "active")
    .is("deleted_at", null);

  if (profileError) {
    console.error("[COACHING_GENEALOGY_ASSIGN_PROFILE_QUERY_FAILED]", {
      message: profileError.message,
    });
    return {
      coaches: [],
      coachees: [],
      relationships: [],
      generationOptions,
    };
  }

  const profiles = (profileData ?? []) as ProfileRow[];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const countryIds = uniqueValues(profiles.map((profile) => profile.country_id));
  const organizationIds = uniqueValues(
    profiles.map((profile) => profile.organization_id),
  );
  const churchIds = uniqueValues(profiles.map((profile) => profile.church_id));
  const [countryResult, organizationResult, churchResult] = await Promise.all([
    countryIds.length > 0
      ? client.from("countries").select("id, name, code").in("id", countryIds)
      : Promise.resolve({ data: [], error: null }),
    organizationIds.length > 0
      ? client.from("organizations").select("id, name").in("id", organizationIds)
      : Promise.resolve({ data: [], error: null }),
    churchIds.length > 0
      ? client.from("churches").select("id, name").in("id", churchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (countryResult.error || organizationResult.error || churchResult.error) {
    console.error("[COACHING_GENEALOGY_ASSIGN_LOOKUP_QUERY_FAILED]", {
      church: churchResult.error?.message,
      country: countryResult.error?.message,
      organization: organizationResult.error?.message,
    });
  }

  const { countryMap, organizationMap, churchMap } = getLookupMaps(
    (countryResult.data ?? []) as CountryRow[],
    (organizationResult.data ?? []) as NameRow[],
    (churchResult.data ?? []) as NameRow[],
  );
  const rolesByProfile = new Map<string, UserRole[]>();

  for (const role of candidateRoles) {
    const roles = rolesByProfile.get(role.profile_id) ?? [];
    roles.push(role.role);
    rolesByProfile.set(role.profile_id, roles);
  }

  const selectedCoachId = filters.coachProfileId;
  const scopedProfiles = profiles.filter((profile) => {
    const roles = rolesByProfile.get(profile.id) ?? [];

    return (
      accessScopes.some((scope) => profileMatchesScope(profile, scope)) &&
      profileMatchesFilters(profile, filters) &&
      (filters.role === "all" || roles.includes(filters.role))
    );
  });

  const rawCandidates = scopedProfiles.map((profile) =>
    candidateFromProfile({
      activeRelationships,
      countryMap,
      organizationMap,
      churchMap,
      profile,
      profileRoles: rolesByProfile.get(profile.id) ?? [],
      selectedCoachId,
    }),
  );
  const candidateMap = new Map(
    rawCandidates.map((candidate) => [candidate.profileId, candidate]),
  );
  const candidates = addCurrentCoachLabels(rawCandidates, candidateMap);
  const candidateMapWithLabels = new Map(
    candidates.map((candidate) => [candidate.profileId, candidate]),
  );
  const coaches = candidates.filter((candidate) =>
    candidate.roles.some((role) => role === "coach" || role === "coach_maker"),
  );
  const coachees = candidates.filter((candidate) =>
    candidate.roles.includes("coachee"),
  );
  const relationships = activeRelationships
    .filter((relationship) => {
      const coach = profileMap.get(relationship.coach_profile_id);
      const coachee = profileMap.get(relationship.coachee_profile_id);

      return (
        relationshipMatchesScope(relationship, coach, coachee, accessScopes) &&
        relationshipMatchesFilters(relationship, coach, coachee, filters)
      );
    })
    .map<AssignRelationship>((relationship) => {
      const coachProfile = profileMap.get(relationship.coach_profile_id);
      const coacheeProfile = profileMap.get(relationship.coachee_profile_id);
      const coach = candidateMapWithLabels.get(relationship.coach_profile_id);
      const coachee = candidateMapWithLabels.get(relationship.coachee_profile_id);
      const country = coacheeProfile?.country_id
        ? countryMap.get(coacheeProfile.country_id)
        : null;
      const church = coacheeProfile?.church_id
        ? churchMap.get(coacheeProfile.church_id)
        : null;

      return {
        relationshipId: relationship.id,
        coachProfileId: relationship.coach_profile_id,
        coachLabel:
          coach?.label ??
          (coachProfile ? labelForProfile(coachProfile) : "코치 확인 필요"),
        coacheeProfileId: relationship.coachee_profile_id,
        coacheeLabel:
          coachee?.label ??
          (coacheeProfile ? labelForProfile(coacheeProfile) : "코치이 확인 필요"),
        coachGenerationNumber: coachProfile?.generation_number ?? null,
        coacheeGenerationNumber: coacheeProfile?.generation_number ?? null,
        countryName: country?.name ?? null,
        countryCode: country?.code ?? null,
        churchName: church?.name ?? null,
        status: relationship.status,
        scopeType: relationship.scope_type,
        scopeId: relationship.scope_id,
        createdAt: relationship.created_at,
        updatedAt: relationship.updated_at,
      };
    });

  return {
    coaches,
    coachees,
    relationships,
    generationOptions,
  };
}

export async function assignCoachingGenealogy(
  input: AssignCoachingGenealogyInput,
): Promise<AssignCoachingGenealogyResult> {
  const access = await resolveGenealogyAccess();

  if (!access.ok) {
    return {
      ok: false,
      status: access.status,
      error: {
        code: access.code,
        message: access.message,
      },
    };
  }

  const coachProfileId = normalizeAssignId(input.coachProfileId);
  const coacheeProfileIds = normalizeAssignIds(input.coacheeProfileIds);
  const generationNumber = normalizeAssignGeneration(input.generationNumber);
  const scopeType = normalizeScopeType(input.scopeType ?? "global");
  const scopeId = normalizeAssignId(input.scopeId);

  if (!coachProfileId) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_INPUT",
        message: "코치를 선택해 주세요.",
      },
    };
  }

  if (coacheeProfileIds.length === 0) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_INPUT",
        message: "배정할 코치이를 선택해 주세요.",
      },
    };
  }

  if (coacheeProfileIds.includes(coachProfileId)) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_INPUT",
        message: "코치와 코치이가 같은 사람일 수 없습니다.",
      },
    };
  }

  if (Number.isNaN(generationNumber)) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_INPUT",
        message: "세대 값은 1 이상의 숫자여야 합니다.",
      },
    };
  }

  if (!scopeType) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_INPUT",
        message: "배정 범위 유형을 확인해 주세요.",
      },
    };
  }

  if (scopeType !== "global" && !scopeId) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "INVALID_INPUT",
        message: "global이 아닌 배정 범위에는 범위 ID가 필요합니다.",
      },
    };
  }

  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return {
      ok: false,
      status: 500,
      error: {
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message:
          clientError ??
          "배정 처리를 위한 서버 설정이 준비되지 않았습니다.",
      },
    };
  }

  try {
    const profileIds = [coachProfileId, ...coacheeProfileIds];
    const [{ data: profileData, error: profileError }, { data: roleData, error: roleError }] =
      await Promise.all([
        client
          .from("profiles")
          .select(
            "id, email, full_name, display_name, primary_role, ministry_position, status, country_id, region_id, organization_id, church_id, generation_number",
          )
          .in("id", profileIds)
          .eq("status", "active")
          .is("deleted_at", null),
        client
          .from("user_roles")
          .select("profile_id, role")
          .in("profile_id", profileIds)
          .eq("status", "active")
          .eq("is_active", true)
          .is("deleted_at", null),
      ]);

    if (profileError || roleError) {
      console.error("[COACHING_GENEALOGY_ASSIGN_LOOKUP_FAILED]", {
        profiles: profileError?.message,
        roles: roleError?.message,
      });
      return {
        ok: false,
        status: 500,
        error: {
          code: "ASSIGNMENT_FAILED",
          message: "배정 대상 정보를 확인하지 못했습니다.",
        },
      };
    }

    const profiles = (profileData ?? []) as ProfileRow[];
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const roleRows = (roleData ?? []) as CandidateRoleRow[];
    const rolesByProfile = new Map<string, UserRole[]>();

    for (const role of roleRows) {
      const roles = rolesByProfile.get(role.profile_id) ?? [];
      roles.push(role.role);
      rolesByProfile.set(role.profile_id, roles);
    }

    const coachProfile = profileMap.get(coachProfileId);
    const coachRoles = rolesByProfile.get(coachProfileId) ?? [];

    if (!coachProfile || !coachRoles.some((role) => role === "coach" || role === "coach_maker")) {
      return {
        ok: false,
        status: 400,
        error: {
          code: "INVALID_INPUT",
          message: "배정 가능한 코치를 찾을 수 없습니다.",
        },
      };
    }

    for (const coacheeProfileId of coacheeProfileIds) {
      const coachee = profileMap.get(coacheeProfileId);
      const roles = rolesByProfile.get(coacheeProfileId) ?? [];

      if (!coachee || !roles.includes("coachee")) {
        return {
          ok: false,
          status: 400,
          error: {
            code: "INVALID_INPUT",
            message: "배정 가능한 코치이 목록을 확인해 주세요.",
          },
        };
      }

      const fakeRelationship: RelationshipRow = {
        id: "new",
        coach_profile_id: coachProfileId,
        coachee_profile_id: coacheeProfileId,
        status: "active",
        scope_type: scopeType,
        scope_id: scopeId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (
        !relationshipMatchesScope(
          fakeRelationship,
          coachProfile,
          coachee,
          access.scopes,
        )
      ) {
        return {
          ok: false,
          status: 403,
          error: {
            code: "ADMIN_ROLE_REQUIRED",
            message: "관리 범위 밖의 코칭 관계는 배정할 수 없습니다.",
          },
        };
      }
    }

    const { data: existingRelationshipData, error: existingRelationshipError } =
      await client
        .from("coaching_relationships")
        .select(
          "id, coach_profile_id, coachee_profile_id, status, scope_type, scope_id, created_at, updated_at",
        )
        .in("coachee_profile_id", coacheeProfileIds)
        .eq("status", "active")
        .is("deleted_at", null);

    if (existingRelationshipError) {
      console.error("[COACHING_GENEALOGY_ASSIGN_EXISTING_LOOKUP_FAILED]", {
        message: existingRelationshipError.message,
      });
      return {
        ok: false,
        status: 500,
        error: {
          code: "ASSIGNMENT_FAILED",
          message: "기존 배정 관계를 확인하지 못했습니다.",
        },
      };
    }

    const existingRelationships =
      (existingRelationshipData ?? []) as RelationshipRow[];
    const created: AssignResultItem[] = [];
    const skipped: AssignResultItem[] = [];
    const errors: AssignResultItem[] = [];
    const generationUpdateProfileIds = new Set<string>();

    for (const coacheeProfileId of coacheeProfileIds) {
      const existing = existingRelationships.find(
        (relationship) => relationship.coachee_profile_id === coacheeProfileId,
      );

      if (existing?.coach_profile_id === coachProfileId) {
        skipped.push({
          coacheeProfileId,
          relationshipId: existing.id,
          message: "현재 선택 코치에게 이미 배정되어 있습니다.",
        });
        generationUpdateProfileIds.add(coacheeProfileId);
        continue;
      }

      if (existing) {
        skipped.push({
          coacheeProfileId,
          relationshipId: existing.id,
          message: "이미 다른 담당 코치가 있습니다.",
        });
        continue;
      }

      const { data: inserted, error: insertError } = await createAssignRelationshipTable(
        client,
      )
        .insert({
          coach_profile_id: coachProfileId,
          coachee_profile_id: coacheeProfileId,
          relationship_type: "individual_coaching",
          status: "active",
          scope_type: scopeType,
          scope_id: scopeType === "global" ? null : scopeId,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        console.error("[COACHING_GENEALOGY_ASSIGN_CREATE_FAILED]", {
          coacheeProfileId,
          message: insertError?.message,
        });
        errors.push({
          coacheeProfileId,
          message: "배정 관계 생성에 실패했습니다.",
        });
        continue;
      }

      created.push({
        coacheeProfileId,
        relationshipId: (inserted as { id: string }).id,
        message: "배정 관계가 생성되었습니다.",
      });
      generationUpdateProfileIds.add(coacheeProfileId);
    }

    const updatedGenerations: Array<{
      profileId: string;
      generationNumber: number;
    }> = [];

    if (generationNumber && generationUpdateProfileIds.size > 0) {
      const generationIds = Array.from(generationUpdateProfileIds);
      const { error: generationError } = await createAssignProfileTable(client)
        .update({
          generation_number: generationNumber,
          updated_at: new Date().toISOString(),
        })
        .in("id", generationIds);

      if (generationError) {
        console.error("[COACHING_GENEALOGY_ASSIGN_GENERATION_UPDATE_FAILED]", {
          message: generationError.message,
        });
        errors.push(
          ...generationIds.map((profileId) => ({
            coacheeProfileId: profileId,
            message: "세대 업데이트에 실패했습니다.",
          })),
        );
      } else {
        updatedGenerations.push(
          ...generationIds.map((profileId) => ({
            profileId,
            generationNumber,
          })),
        );
      }
    }

    return {
      ok: true,
      data: {
        success: errors.length === 0,
        created,
        updatedGenerations,
        skipped,
        errors,
      },
    };
  } catch (error) {
    console.error("[COACHING_GENEALOGY_ASSIGN_UNEXPECTED_ERROR]", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      ok: false,
      status: 500,
      error: {
        code: "ASSIGNMENT_FAILED",
        message: "배정 처리 중 오류가 발생했습니다.",
      },
    };
  }
}

export async function getAdminCoachingGenealogy(
  filters: GenealogyFilters,
): Promise<CoachingGenealogyResult> {
  const access = await resolveGenealogyAccess();

  if (!access.ok) {
    return {
      ok: false,
      status: access.status,
      error: {
        code: access.code,
        message: access.message,
      },
    };
  }

  const { client, error: clientError } = createSupabaseServiceClient();

  if (!client) {
    return {
      ok: false,
      status: 500,
      error: {
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message:
          clientError ??
          "계보도 데이터 조회를 위한 서버 설정이 준비되지 않았습니다.",
      },
    };
  }

  try {
    let relationshipQuery = client
      .from("coaching_relationships")
      .select(
        "id, coach_profile_id, coachee_profile_id, status, scope_type, scope_id, created_at, updated_at",
      )
      .eq("status", filters.status)
      .is("deleted_at", null);

    if (filters.coachProfileId) {
      relationshipQuery = relationshipQuery.eq(
        "coach_profile_id",
        filters.coachProfileId,
      );
    }

    const { data: relationshipData, error: relationshipError } =
      await relationshipQuery;

    if (relationshipError) {
      console.error("[COACHING_GENEALOGY_RELATIONSHIP_QUERY_FAILED]", {
        message: relationshipError.message,
      });
      return {
        ok: false,
        status: 500,
        error: {
          code: "GENEALOGY_QUERY_FAILED",
          message: "코칭 계보 관계 데이터를 불러오지 못했습니다.",
        },
      };
    }

    const relationships = (relationshipData ?? []) as RelationshipRow[];
    const assignData = await loadAssignData({
      accessScopes: access.scopes,
      activeRelationships: relationships,
      client,
      filters,
    });
    const profileIds = uniqueValues(
      relationships.flatMap((relationship) => [
        relationship.coach_profile_id,
        relationship.coachee_profile_id,
      ]),
    );

    if (profileIds.length === 0) {
      const data = emptyData(filters);

      return {
        ok: true,
        data: {
          ...data,
          assignData,
        },
      };
    }

    const { data: profileData, error: profileError } = await client
      .from("profiles")
      .select(
        "id, email, full_name, display_name, primary_role, ministry_position, status, country_id, region_id, organization_id, church_id, generation_number",
      )
      .in("id", profileIds)
      .neq("status", "anonymized")
      .is("deleted_at", null);

    if (profileError) {
      console.error("[COACHING_GENEALOGY_PROFILE_QUERY_FAILED]", {
        message: profileError.message,
      });
      return {
        ok: false,
        status: 500,
        error: {
          code: "GENEALOGY_QUERY_FAILED",
          message: "코칭 계보 프로필 데이터를 불러오지 못했습니다.",
        },
      };
    }

    const profiles = (profileData ?? []) as ProfileRow[];
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const countryIds = uniqueValues(profiles.map((profile) => profile.country_id));
    const regionIds = uniqueValues(profiles.map((profile) => profile.region_id));
    const organizationIds = uniqueValues(
      profiles.map((profile) => profile.organization_id),
    );
    const churchIds = uniqueValues(profiles.map((profile) => profile.church_id));

    const [countryResult, regionResult, organizationResult, churchResult] =
      await Promise.all([
        countryIds.length > 0
          ? client.from("countries").select("id, name, code").in("id", countryIds)
          : Promise.resolve({ data: [], error: null }),
        regionIds.length > 0
          ? client.from("regions").select("id, name, country_id").in("id", regionIds)
          : Promise.resolve({ data: [], error: null }),
        organizationIds.length > 0
          ? client.from("organizations").select("id, name").in("id", organizationIds)
          : Promise.resolve({ data: [], error: null }),
        churchIds.length > 0
          ? client.from("churches").select("id, name").in("id", churchIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (
      countryResult.error ||
      regionResult.error ||
      organizationResult.error ||
      churchResult.error
    ) {
      console.error("[COACHING_GENEALOGY_LOOKUP_QUERY_FAILED]", {
        country: countryResult.error?.message,
        region: regionResult.error?.message,
        organization: organizationResult.error?.message,
        church: churchResult.error?.message,
      });
      return {
        ok: false,
        status: 500,
        error: {
          code: "GENEALOGY_QUERY_FAILED",
          message: "코칭 계보 기준 데이터를 불러오지 못했습니다.",
        },
      };
    }

    const countryMap = new Map(
      ((countryResult.data ?? []) as CountryRow[]).map((country) => [
        country.id,
        country,
      ]),
    );
    const regionMap = new Map(
      ((regionResult.data ?? []) as RegionRow[]).map((region) => [region.id, region]),
    );
    const organizationMap = new Map(
      ((organizationResult.data ?? []) as NameRow[]).map((organization) => [
        organization.id,
        organization,
      ]),
    );
    const churchMap = new Map(
      ((churchResult.data ?? []) as NameRow[]).map((church) => [church.id, church]),
    );

    const scopedRelationships = relationships.filter((relationship) => {
      const coach = profileMap.get(relationship.coach_profile_id);
      const coachee = profileMap.get(relationship.coachee_profile_id);

      return (
        relationshipMatchesScope(relationship, coach, coachee, access.scopes) &&
        relationshipMatchesFilters(relationship, coach, coachee, filters)
      );
    });

    const scopedProfileIds = new Set(
      scopedRelationships.flatMap((relationship) => [
        relationship.coach_profile_id,
        relationship.coachee_profile_id,
      ]),
    );
    const scopedProfiles = profiles.filter((profile) => scopedProfileIds.has(profile.id));

    const incomingCounts = new Map<string, number>();
    const outgoingCounts = new Map<string, number>();

    for (const relationship of scopedRelationships) {
      outgoingCounts.set(
        relationship.coach_profile_id,
        (outgoingCounts.get(relationship.coach_profile_id) ?? 0) + 1,
      );
      incomingCounts.set(
        relationship.coachee_profile_id,
        (incomingCounts.get(relationship.coachee_profile_id) ?? 0) + 1,
      );
    }

    const nodes = scopedProfiles.map<GenealogyNode>((profile) => {
      const country = profile.country_id ? countryMap.get(profile.country_id) : null;
      const organization = profile.organization_id
        ? organizationMap.get(profile.organization_id)
        : null;
      const church = profile.church_id ? churchMap.get(profile.church_id) : null;

      return {
        id: profile.id,
        label: labelForProfile(profile),
        generationNumber: profile.generation_number,
        primaryRole: profile.primary_role,
        ministryPosition: profile.ministry_position,
        status: profile.status,
        countryId: profile.country_id,
        countryName: country?.name ?? null,
        countryCode: country?.code ?? null,
        organizationId: profile.organization_id,
        organizationName: organization?.name ?? null,
        churchId: profile.church_id,
        churchName: church?.name ?? null,
        activeCoachCount: incomingCounts.get(profile.id) ?? 0,
        activeCoacheeCount: outgoingCounts.get(profile.id) ?? 0,
      };
    });
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    const edges = scopedRelationships.map<GenealogyEdge>((relationship) => ({
      id: relationship.id,
      source: relationship.coach_profile_id,
      target: relationship.coachee_profile_id,
      relationshipId: relationship.id,
      status: relationship.status,
      scopeType: relationship.scope_type,
      scopeId: relationship.scope_id,
    }));

    const coachIds = new Set(edges.map((edge) => edge.source));
    const coacheeIds = new Set(edges.map((edge) => edge.target));
    const generationNumbers = nodes
      .map((node) => node.generationNumber)
      .filter((value): value is number => typeof value === "number");

    const generationStats = makeBreakdown(nodes).map<GenerationStat>((item) => {
      const matchingNodes = nodes.filter(
        (node) => node.generationNumber === item.generationNumber,
      );
      const matchingIds = new Set(matchingNodes.map((node) => node.id));

      return {
        ...item,
        coachCount: matchingNodes.filter((node) => node.activeCoacheeCount > 0).length,
        coacheeCount: matchingNodes.filter((node) => node.activeCoachCount > 0).length,
        relationshipCount: countRelationshipInvolving(edges, matchingIds),
      };
    });

    const countryStats = groupItems(
      nodes,
      (node) => node.countryId ?? "missing",
    ).map<CountryStat>(([, countryNodes]) => {
      const countryId = countryNodes[0]?.countryId ?? null;
      const country = countryId ? countryMap.get(countryId) : null;
      const ids = new Set(countryNodes.map((node) => node.id));

      return {
        countryId,
        countryName: country?.name ?? "미지정",
        countryCode: country?.code ?? null,
        profileCount: countryNodes.length,
        coachCount: countryNodes.filter((node) => node.activeCoacheeCount > 0).length,
        coacheeCount: countryNodes.filter((node) => node.activeCoachCount > 0).length,
        relationshipCount: countRelationshipInvolving(edges, ids),
        generationBreakdown: makeBreakdown(countryNodes),
      };
    });

    const regionStats = groupItems(
      scopedProfiles,
      (profile) => profile.region_id ?? "",
    )
      .filter((entry): entry is [string, ProfileRow[]] => entry[0].length > 0)
      .map<RegionStat>(([regionId, regionProfiles]) => {
        const ids = new Set(regionProfiles.map((profile) => profile.id));
        const region = regionMap.get(regionId);

        return {
          regionId,
          regionName: region?.name ?? "미지정",
          profileCount: regionProfiles.length,
          relationshipCount: countRelationshipInvolving(edges, ids),
        };
      });

    const churchStats = groupItems(
      nodes,
      (node) => node.churchId ?? "missing",
    ).map<ChurchStat>(([, churchNodes]) => {
      const churchId = churchNodes[0]?.churchId ?? null;
      const church = churchId ? churchMap.get(churchId) : null;
      const ids = new Set(churchNodes.map((node) => node.id));

      return {
        churchId,
        churchName: church?.name ?? "미지정",
        profileCount: churchNodes.length,
        coachCount: churchNodes.filter((node) => node.activeCoacheeCount > 0).length,
        coacheeCount: churchNodes.filter((node) => node.activeCoachCount > 0).length,
        relationshipCount: countRelationshipInvolving(edges, ids),
        generationBreakdown: makeBreakdown(churchNodes),
      };
    });

    const countryMarkers = countryStats.map<MapMarker>((stat) => {
      const coordinates = stat.countryCode
        ? COUNTRY_COORDINATES[stat.countryCode]
        : null;

      return {
        markerType: "country",
        id: stat.countryId,
        name: stat.countryName,
        code: stat.countryCode,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        profileCount: stat.profileCount,
        coachCount: stat.coachCount,
        coacheeCount: stat.coacheeCount,
        relationshipCount: stat.relationshipCount,
        generationBreakdown: stat.generationBreakdown,
      };
    });

    const regionMarkers = regionStats.map<MapMarker>((stat) => {
      const regionNodes = nodes.filter((node) => {
        const profile = profileMap.get(node.id);
        return profile?.region_id === stat.regionId;
      });
      const countryCode = regionNodes.find((node) => node.countryCode)?.countryCode ?? null;
      const coordinates = countryCode ? COUNTRY_COORDINATES[countryCode] : null;

      return {
        markerType: "region",
        id: stat.regionId,
        name: stat.regionName,
        code: countryCode,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        profileCount: stat.profileCount,
        coachCount: regionNodes.filter((node) => node.activeCoacheeCount > 0).length,
        coacheeCount: regionNodes.filter((node) => node.activeCoachCount > 0).length,
        relationshipCount: stat.relationshipCount,
        generationBreakdown: makeBreakdown(regionNodes),
      };
    });

    const churchMarkers = churchStats.map<MapMarker>((stat) => {
      const churchNodes = nodes.filter((node) => node.churchId === stat.churchId);
      const countryCode = churchNodes.find((node) => node.countryCode)?.countryCode ?? null;
      const coordinates = countryCode ? COUNTRY_COORDINATES[countryCode] : null;

      return {
        markerType: "church",
        id: stat.churchId,
        name: stat.churchName,
        code: countryCode,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        profileCount: stat.profileCount,
        coachCount: stat.coachCount,
        coacheeCount: stat.coacheeCount,
        relationshipCount: stat.relationshipCount,
        generationBreakdown: stat.generationBreakdown,
      };
    });

    const diagnostics: GenealogyDiagnostics = {
      circularRelationships: detectCircularRelationships(edges),
      missingGenerationProfiles: nodes
        .filter((node) => node.generationNumber === null)
        .map((node) => ({
          profileId: node.id,
          label: node.label,
        })),
      generationMismatchWarnings: edges.flatMap((edge) => {
        const coach = nodeMap.get(edge.source);
        const coachee = nodeMap.get(edge.target);

        if (
          !coach ||
          !coachee ||
          coach.generationNumber === null ||
          coachee.generationNumber === null
        ) {
          return [];
        }

        const expected = coach.generationNumber + 1;

        if (coachee.generationNumber === expected) {
          return [];
        }

        return [
          {
            relationshipId: edge.relationshipId,
            coachProfileId: coach.id,
            coachLabel: coach.label,
            coachGenerationNumber: coach.generationNumber,
            coacheeProfileId: coachee.id,
            coacheeLabel: coachee.label,
            coacheeGenerationNumber: coachee.generationNumber,
            expectedCoacheeGenerationNumber: expected,
          },
        ];
      }),
    };

    return {
      ok: true,
      data: {
        nodes,
        edges,
        summaryStats: {
          totalCoaches: coachIds.size,
          totalCoachees: coacheeIds.size,
          totalActiveRelationships: edges.length,
          maxGeneration: generationNumbers.length > 0 ? Math.max(...generationNumbers) : 0,
          totalCountries: countryStats.filter((stat) => stat.countryId).length,
          totalOrganizations: uniqueValues(nodes.map((node) => node.organizationId))
            .length,
          totalChurches: churchStats.filter((stat) => stat.churchId).length,
        },
        generationStats,
        countryStats,
        regionStats,
        churchStats,
        mapMarkers: [...countryMarkers, ...regionMarkers, ...churchMarkers],
        filters,
        diagnostics,
        assignData,
      },
    };
  } catch (error) {
    console.error("[COACHING_GENEALOGY_UNEXPECTED_ERROR]", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      ok: false,
      status: 500,
      error: {
        code: "GENEALOGY_QUERY_FAILED",
        message: "코칭 계보 데이터를 처리하는 중 오류가 발생했습니다.",
      },
    };
  }
}

function emptyGenerationHistoryData(
  filters: GenerationHistoryFilters,
): GenerationHistoryData {
  return {
    items: [],
    summary: {
      totalChanges: 0,
      last7DaysChanges: 0,
      last30DaysChanges: 0,
      mostChangedGeneration: "미지정",
      changedProfileCount: 0,
    },
    filters,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalItems: 0,
      totalPages: 0,
    },
    options: {
      changedByProfiles: [],
      changeSources: [],
    },
  };
}

function profileMatchesHistoryFilters(
  profile: ProfileRow | undefined,
  filters: GenerationHistoryFilters,
) {
  if (!profile) {
    return false;
  }

  if (filters.countryId && profile.country_id !== filters.countryId) {
    return false;
  }

  if (
    filters.organizationId &&
    profile.organization_id !== filters.organizationId
  ) {
    return false;
  }

  if (filters.churchId && profile.church_id !== filters.churchId) {
    return false;
  }

  return true;
}

function historyMatchesSearch({
  changedByProfile,
  church,
  country,
  filters,
  organization,
  targetProfile,
}: {
  changedByProfile: ProfileRow | undefined;
  church: NameRow | undefined;
  country: CountryRow | undefined;
  filters: GenerationHistoryFilters;
  organization: NameRow | undefined;
  targetProfile: ProfileRow | undefined;
}) {
  if (!filters.search) {
    return true;
  }

  const search = filters.search.toLowerCase();
  const values = [
    targetProfile?.display_name,
    targetProfile?.full_name,
    targetProfile?.email,
    changedByProfile?.display_name,
    changedByProfile?.full_name,
    changedByProfile?.email,
    country?.name,
    organization?.name,
    church?.name,
  ];

  return values.some((value) => value?.toLowerCase().includes(search));
}

function getMostChangedGeneration(items: GenerationHistoryItem[]) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = item.newGenerationLabel;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (
    Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "미지정"
  );
}

export async function getAdminGenerationHistory(
  filters: GenerationHistoryFilters,
): Promise<GenerationHistoryResult> {
  const access = await resolveGenealogyAccess();

  if (!access.ok) {
    return {
      ok: false,
      status: access.status,
      error: {
        code: access.code,
        message: access.message,
      },
    };
  }

  const { client, error } = createSupabaseServiceClient();

  if (!client || error) {
    return {
      ok: false,
      status: 500,
      error: {
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message: error ?? "서비스 클라이언트를 사용할 수 없습니다.",
      },
    };
  }

  try {
    let historyQuery = client
      .from("profile_generation_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (filters.profileId) {
      historyQuery = historyQuery.eq("profile_id", filters.profileId);
    }

    if (filters.changedByProfileId) {
      historyQuery = historyQuery.eq(
        "changed_by_profile_id",
        filters.changedByProfileId,
      );
    }

    if (filters.oldGenerationNumber) {
      historyQuery = historyQuery.eq(
        "old_generation_number",
        filters.oldGenerationNumber,
      );
    }

    if (filters.newGenerationNumber) {
      historyQuery = historyQuery.eq(
        "new_generation_number",
        filters.newGenerationNumber,
      );
    }

    if (filters.generationNumber) {
      historyQuery = historyQuery.or(
        `old_generation_number.eq.${filters.generationNumber},new_generation_number.eq.${filters.generationNumber}`,
      );
    }

    if (filters.changeSource) {
      historyQuery = historyQuery.eq("change_source", filters.changeSource);
    }

    if (filters.dateFrom) {
      historyQuery = historyQuery.gte(
        "created_at",
        new Date(filters.dateFrom).toISOString(),
      );
    }

    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      historyQuery = historyQuery.lte("created_at", dateTo.toISOString());
    }

    const { data: histories, error: historyError } = await historyQuery;

    if (historyError) {
      console.error("[ADMIN_GENERATION_HISTORY_LOOKUP_FAILED]", {
        code: historyError.code,
        details: historyError.details,
        message: historyError.message,
      });
      return {
        ok: false,
        status: 500,
        error: {
          code: "GENERATION_HISTORY_QUERY_FAILED",
          message: "세대 변경 이력을 조회하는 중 오류가 발생했습니다.",
        },
      };
    }

    const historyRows = (histories ?? []) as GenerationHistoryRow[];

    if (historyRows.length === 0) {
      return {
        ok: true,
        data: emptyGenerationHistoryData(filters),
      };
    }

    const targetProfileIds = uniqueValues(
      historyRows.map((history) => history.profile_id),
    );
    const changedByProfileIds = uniqueValues(
      historyRows.map((history) => history.changed_by_profile_id),
    );
    const allProfileIds = uniqueValues([
      ...targetProfileIds,
      ...changedByProfileIds,
    ]);

    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select(
        "id, email, full_name, display_name, primary_role, ministry_position, status, country_id, region_id, organization_id, church_id, generation_number",
      )
      .in("id", allProfileIds)
      .is("deleted_at", null);

    if (profileError) {
      console.error("[GENERATION_HISTORY_PROFILE_LOOKUP_FAILED]", {
        message: profileError.message,
      });
      return {
        ok: false,
        status: 500,
        error: {
          code: "GENERATION_HISTORY_QUERY_FAILED",
          message: "세대 변경 대상 회원 정보를 조회하는 중 오류가 발생했습니다.",
        },
      };
    }

    const profileRows = (profiles ?? []) as ProfileRow[];
    const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]));
    const scopedHistoryRows = historyRows.filter((history) => {
      const targetProfile = profileMap.get(history.profile_id);

      if (!targetProfile) {
        return false;
      }

      if (access.scopes.some((scope) => scope.role === "super_admin")) {
        return true;
      }

      return access.scopes.some((scope) =>
        profileMatchesScope(targetProfile, scope),
      );
    });

    if (scopedHistoryRows.length === 0) {
      return {
        ok: true,
        data: emptyGenerationHistoryData(filters),
      };
    }

    const scopedProfiles = scopedHistoryRows
      .map((history) => profileMap.get(history.profile_id))
      .filter((profile): profile is ProfileRow => Boolean(profile));
    const countryIds = uniqueValues(scopedProfiles.map((profile) => profile.country_id));
    const organizationIds = uniqueValues(
      scopedProfiles.map((profile) => profile.organization_id),
    );
    const churchIds = uniqueValues(scopedProfiles.map((profile) => profile.church_id));

    const [
      { data: countries },
      { data: organizations },
      { data: churches },
      { data: roles },
    ] = await Promise.all([
      countryIds.length > 0
        ? client.from("countries").select("id, name, code").in("id", countryIds)
        : Promise.resolve({ data: [] }),
      organizationIds.length > 0
        ? client.from("organizations").select("id, name").in("id", organizationIds)
        : Promise.resolve({ data: [] }),
      churchIds.length > 0
        ? client.from("churches").select("id, name").in("id", churchIds)
        : Promise.resolve({ data: [] }),
      targetProfileIds.length > 0
        ? client
            .from("user_roles")
            .select("profile_id, role")
            .in("profile_id", targetProfileIds)
            .eq("status", "active")
            .eq("is_active", true)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] }),
    ]);

    const { countryMap, organizationMap, churchMap } = getLookupMaps(
      (countries ?? []) as CountryRow[],
      (organizations ?? []) as NameRow[],
      (churches ?? []) as NameRow[],
    );
    const roleRows = (roles ?? []) as HistoryRoleRow[];
    const rolesByProfileId = new Map<string, UserRole[]>();

    for (const role of roleRows) {
      const current = rolesByProfileId.get(role.profile_id) ?? [];
      current.push(role.role);
      rolesByProfileId.set(role.profile_id, current);
    }

    const filteredHistoryRows = scopedHistoryRows.filter((history) => {
      const targetProfile = profileMap.get(history.profile_id);
      const changedByProfile = history.changed_by_profile_id
        ? profileMap.get(history.changed_by_profile_id)
        : undefined;
      const country = targetProfile?.country_id
        ? countryMap.get(targetProfile.country_id)
        : undefined;
      const organization = targetProfile?.organization_id
        ? organizationMap.get(targetProfile.organization_id)
        : undefined;
      const church = targetProfile?.church_id
        ? churchMap.get(targetProfile.church_id)
        : undefined;

      return (
        profileMatchesHistoryFilters(targetProfile, filters) &&
        historyMatchesSearch({
          changedByProfile,
          church,
          country,
          filters,
          organization,
          targetProfile,
        })
      );
    });

    const items = filteredHistoryRows.map((history) => {
      const targetProfile = profileMap.get(history.profile_id);
      const changedByProfile = history.changed_by_profile_id
        ? profileMap.get(history.changed_by_profile_id)
        : undefined;
      const country = targetProfile?.country_id
        ? countryMap.get(targetProfile.country_id)
        : undefined;
      const organization = targetProfile?.organization_id
        ? organizationMap.get(targetProfile.organization_id)
        : undefined;
      const church = targetProfile?.church_id
        ? churchMap.get(targetProfile.church_id)
        : undefined;
      const roleSummary =
        rolesByProfileId.get(history.profile_id)?.join(", ") ??
        targetProfile?.primary_role ??
        "미지정";

      return {
        id: history.id,
        profileId: history.profile_id,
        profileName: targetProfile ? labelForProfile(targetProfile) : "미지정",
        profileEmail: targetProfile?.email ?? null,
        oldGenerationNumber: history.old_generation_number,
        newGenerationNumber: history.new_generation_number,
        oldGenerationLabel: generationLabel(history.old_generation_number),
        newGenerationLabel: generationLabel(history.new_generation_number),
        changedByAuthUserId: history.changed_by_auth_user_id,
        changedByProfileId: history.changed_by_profile_id,
        changedByName: changedByProfile
          ? labelForProfile(changedByProfile)
          : "시스템/확인 필요",
        changeSource: normalizeText(history.change_source) ?? "manual_admin",
        reason: normalizeText(history.reason),
        createdAt: history.created_at,
        countryName: country?.name ?? "미지정",
        countryCode: country?.code ?? null,
        organizationName: organization?.name ?? "미지정",
        churchName: church?.name ?? "미지정",
        currentRoleSummary: roleSummary,
        currentStatus: targetProfile?.status ?? "미지정",
      } satisfies GenerationHistoryItem;
    });

    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
    const page = Math.min(filters.page, totalPages);
    const start = (page - 1) * filters.pageSize;
    const pagedItems = items.slice(start, start + filters.pageSize);
    const now = Date.now();
    const last7DaysTime = now - 7 * 24 * 60 * 60 * 1000;
    const last30DaysTime = now - 30 * 24 * 60 * 60 * 1000;

    return {
      ok: true,
      data: {
        items: pagedItems,
        summary: {
          totalChanges: totalItems,
          last7DaysChanges: items.filter(
            (item) => new Date(item.createdAt).getTime() >= last7DaysTime,
          ).length,
          last30DaysChanges: items.filter(
            (item) => new Date(item.createdAt).getTime() >= last30DaysTime,
          ).length,
          mostChangedGeneration: getMostChangedGeneration(items),
          changedProfileCount: new Set(items.map((item) => item.profileId)).size,
        },
        filters: {
          ...filters,
          page,
        },
        pagination: {
          page,
          pageSize: filters.pageSize,
          totalItems,
          totalPages,
        },
        options: {
          changedByProfiles: Array.from(
            new Map(
              items
                .filter((item) => item.changedByProfileId)
                .map((item) => [
                  item.changedByProfileId ?? "",
                  {
                    id: item.changedByProfileId ?? "",
                    label: item.changedByName,
                  },
                ]),
            ).values(),
          ),
          changeSources: Array.from(
            new Set(items.map((item) => item.changeSource)),
          ).sort(),
        },
      },
    };
  } catch (error) {
    console.error("[GENERATION_HISTORY_UNEXPECTED_ERROR]", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      ok: false,
      status: 500,
      error: {
        code: "GENERATION_HISTORY_QUERY_FAILED",
        message: "세대 변경 이력을 처리하는 중 오류가 발생했습니다.",
      },
    };
  }
}
