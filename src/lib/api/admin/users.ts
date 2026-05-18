import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createApiPerformanceLogger } from "@/lib/performance";
import {
  requireAdminProfile,
} from "@/lib/auth/require-admin-profile";
import {
  PROFILE_STATUSES,
  USER_ROLES,
  type ProfileRow,
  type ProfileStatus,
  type ScopeType,
  type UserRole,
  type UserRoleRow,
  type UserRoleStatus,
} from "@/types/database";

type StatusFilter = ProfileStatus | "all";
type RoleFilter = UserRole | "all";
type AuthorizedAdminProfile = Extract<
  Awaited<ReturnType<typeof requireAdminProfile>>,
  { ok: true }
>;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type AdminSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;

type AdminUserPerformanceLogger = {
  mark: (stage: string, resultCount?: number) => void;
};

type AdminProfileRow = Pick<
  ProfileRow,
  | "id"
  | "auth_user_id"
  | "full_name"
  | "display_name"
  | "email"
  | "phone"
  | "country_id"
  | "region_id"
  | "organization_id"
  | "church_id"
  | "ministry_position"
  | "group_id"
  | "primary_role"
  | "generation_number"
  | "status"
  | "created_at"
  | "updated_at"
>;

type AdminRoleRow = Pick<
  UserRoleRow,
  | "id"
  | "profile_id"
  | "role"
  | "scope_type"
  | "scope_id"
  | "status"
  | "is_active"
  | "granted_at"
>;

export type AdminUserRoleSummary = {
  id: string;
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: UserRoleStatus;
  is_active: boolean;
  assigned_at: string;
};

export type AdminUserSummary = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  country_id: string | null;
  country_code: string | null;
  country_name: string | null;
  region_id: string | null;
  region_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  church_id: string | null;
  church_name: string | null;
  group_id: string | null;
  group_name: string | null;
  ministry_position: string | null;
  primary_role: UserRole | null;
  generation_number: number | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  roles: AdminUserRoleSummary[];
};

export type AdminUsersResult = {
  users: AdminUserSummary[];
  summary: {
    totalCount: number;
    roleCounts: Record<UserRole, number>;
  };
  error: string | null;
  page: number;
  limit: number;
  hasNext: boolean;
};

export type AdminUserRoleSummaryCounts = {
  totalProfiles: number;
  coacheeCount: number;
  coachCount: number;
  coachMakerCount: number;
  churchAdminCount: number;
  organizationAdminCount: number;
  superAdminCount: number;
};

export type AdminOrganizationSummary = {
  id: string;
  name: string;
  country_id: string | null;
  is_active: boolean;
};

export type AdminLookupSummary = {
  id: string;
  name: string;
  country_id?: string | null;
  group_type?: string | null;
  organization_id?: string | null;
  church_id?: string | null;
};

function createEmptyRoleCounts(): Record<UserRole, number> {
  return Object.fromEntries(USER_ROLES.map((userRole) => [userRole, 0])) as Record<
    UserRole,
    number
  >;
}

function createEmptySummary() {
  return {
    totalCount: 0,
    roleCounts: createEmptyRoleCounts(),
  };
}

function createEmptyRoleSummaryCounts(): AdminUserRoleSummaryCounts {
  return {
    totalProfiles: 0,
    coacheeCount: 0,
    coachCount: 0,
    coachMakerCount: 0,
    churchAdminCount: 0,
    organizationAdminCount: 0,
    superAdminCount: 0,
  };
}

type LookupRow = {
  id: string;
  label?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  title?: string | null;
  country_id?: string | null;
  organization_id?: string | null;
  church_id?: string | null;
  group_type?: string | null;
  is_active?: boolean | null;
};

type CountryLookupRow = LookupRow & {
  name: string;
  code: string | null;
};

function getLookupLabel(row: LookupRow) {
  const candidates = [
    row.name,
    row.title,
    row.display_name,
    row.full_name,
    row.label,
    row.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return row.id;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string")),
  );
}

function normalizeLookupIds(ids: string[]) {
  return Array.from(new Set(ids.filter((id) => id.trim().length > 0))).sort();
}

const LOOKUP_CACHE_TTL_MS = 3 * 60 * 1000;

type LookupNameTable = "organizations" | "churches" | "groups" | "regions";

type LookupNameCacheEntry = {
  expiresAt: number;
  value: Map<string, string>;
};

type CountryLookupCacheEntry = {
  expiresAt: number;
  value: Map<string, { code: string | null; name: string }>;
};

type AdminUserRoleSummaryCacheEntry = {
  expiresAt: number;
  value: AdminUserRoleSummaryCounts;
};

const lookupNameCache = new Map<string, LookupNameCacheEntry>();
const countryLookupCache = new Map<string, CountryLookupCacheEntry>();
const adminUserRoleSummaryCache = new Map<
  string,
  AdminUserRoleSummaryCacheEntry
>();

const USER_ROLE_SUMMARY_CACHE_TTL_MS = 60 * 1000;
const USER_ROLE_SUMMARY_CACHE_KEY = "global";

function createLookupCacheKey(kind: string, ids: string[]) {
  return `${kind}:${ids.join(",")}`;
}

function cloneNameMap(value: Map<string, string>) {
  return new Map(value);
}

function cloneCountryMap(
  value: Map<string, { code: string | null; name: string }>,
) {
  return new Map(
    Array.from(value.entries()).map(([id, country]) => [
      id,
      { code: country.code, name: country.name },
    ]),
  );
}

function cloneUserRoleSummary(value: AdminUserRoleSummaryCounts) {
  return {
    ...value,
  };
}

function buildProfileSearchFilter(q: string) {
  const escapedQuery = q.replace(/[%_]/g, (match) => `\\${match}`);

  return `full_name.ilike.%${escapedQuery}%,display_name.ilike.%${escapedQuery}%,email.ilike.%${escapedQuery}%`;
}

async function createAdminLookupClient(label: string) {
  const { client: serviceClient, error: serviceError } =
    createSupabaseServiceClient();

  if (serviceClient) {
    return {
      client: serviceClient,
      error: null,
    };
  }

  try {
    const serverClient = await createSupabaseServerClient();

    return {
      client: serverClient,
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error:
        serviceError ??
        (error instanceof Error
          ? error.message
          : "Supabase lookup client is unavailable."),
    };
  }
}

async function loadLookupNames(
  client: AdminSupabaseClient,
  table: LookupNameTable,
  ids: string[],
) {
  const nameMap = new Map<string, string>();
  const lookupIds = normalizeLookupIds(ids);

  if (lookupIds.length === 0) {
    return nameMap;
  }

  const cacheKey = createLookupCacheKey(table, lookupIds);
  const cached = lookupNameCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cloneNameMap(cached.value);
  }

  let query = client.from(table).select("id, name").in("id", lookupIds);

  if (table === "groups") {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`[ADMIN_USERS_${table.toUpperCase()}_LOOKUP] lookup failed`);
    return nameMap;
  }

  for (const row of (data ?? []) as LookupRow[]) {
    nameMap.set(row.id, getLookupLabel(row));
  }

  // 소속/lookup 정보 변경 후 최대 3분 반영 지연 가능.
  lookupNameCache.set(cacheKey, {
    expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS,
    value: cloneNameMap(nameMap),
  });

  return nameMap;
}

async function getAdminLookupOptions(
  table: "churches" | "groups" | "regions",
  errorMessage: string,
): Promise<{
  items: AdminLookupSummary[];
  error: string | null;
}> {
  const { client, error: clientError } = await createAdminLookupClient(
    table.toUpperCase(),
  );

  if (!client) {
    return {
      items: [],
      error: clientError ?? errorMessage,
    };
  }

  const selectColumns =
    table === "regions"
      ? "id, name, country_id"
      : table === "churches"
        ? "id, name, organization_id"
        : "id, name, church_id, group_type";

  let query = client
    .from(table)
    .select(selectColumns)
    .order("name", { ascending: true });

  if (table === "groups") {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;

  if (error) {
    let fallbackQuery = client
      .from(table)
      .select("id, name")
      .order("name", { ascending: true });

    if (table === "groups") {
      fallbackQuery = fallbackQuery.is("deleted_at", null);
    }

    const { data: fallbackData, error: fallbackError } = await fallbackQuery;

    if (!fallbackError) {
      const fallbackItems = ((fallbackData ?? []) as LookupRow[]).map((item) => ({
        id: item.id,
        name: getLookupLabel(item),
        church_id: null,
        country_id: null,
        group_type: null,
        organization_id: null,
      }));

      return {
        items: table === "groups" ? dedupeGroupLookups(fallbackItems) : fallbackItems,
        error: null,
      };
    }

    console.error(`[ADMIN_${table.toUpperCase()}_LOOKUP_FAILED]`, {
      primaryMessage: error.message,
      fallbackMessage: fallbackError.message,
      fallbackCode: fallbackError.code,
      fallbackDetails: fallbackError.details,
    });
    return {
      items: [],
      error: errorMessage,
    };
  }

  const items = ((data ?? []) as LookupRow[]).map((item) => ({
    id: item.id,
    name: getLookupLabel(item),
    church_id: item.church_id ?? null,
    country_id: item.country_id ?? null,
    group_type: item.group_type ?? null,
    organization_id: item.organization_id ?? null,
  }));

  return {
    items: table === "groups" ? dedupeGroupLookups(items) : items,
    error: null,
  };
}

function dedupeGroupLookups(items: AdminLookupSummary[]) {
  const seen = new Set<string>();
  const deduped: AdminLookupSummary[] = [];

  for (const item of items) {
    const key = [
      item.church_id ?? "",
      item.group_type ?? "",
      item.name.trim().toLowerCase(),
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export async function getAdminRegions() {
  const result = await getAdminLookupOptions(
    "regions",
    "지역/도시 목록을 불러오지 못했습니다.",
  );

  return {
    regions: result.items,
    error: result.error,
  };
}

export async function getAdminChurches() {
  const result = await getAdminLookupOptions(
    "churches",
    "소속 교회 목록을 불러오지 못했습니다.",
  );

  return {
    churches: result.items,
    error: result.error,
  };
}

export async function getAdminGroups() {
  const result = await getAdminLookupOptions(
    "groups",
    "그룹/팀/목장 목록을 불러오지 못했습니다.",
  );

  return {
    groups: result.items,
    error: result.error,
  };
}

export async function getAdminOrganizations(): Promise<{
  organizations: AdminOrganizationSummary[];
  error: string | null;
}> {
  const { client, error: clientError } =
    await createAdminLookupClient("ORGANIZATIONS");

  if (!client) {
    return {
      organizations: [],
      error: clientError ?? "소속 기관 및 단체 목록 조회를 위한 서버 설정이 없습니다.",
    };
  }

  const { data, error } = await client
    .from("organizations")
    .select("id, name, country_id, is_active")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    const { data: fallbackData, error: fallbackError } = await client
      .from("organizations")
      .select("id, name, country_id, is_active")
      .order("name", { ascending: true });

    if (!fallbackError) {
      return {
        organizations: ((fallbackData ?? []) as LookupRow[]).map((organization) => ({
          id: organization.id,
          country_id: organization.country_id ?? null,
          is_active: organization.is_active !== false,
          name: getLookupLabel(organization),
        })),
        error: null,
      };
    }

    const { data: minimalData, error: minimalError } = await client
      .from("organizations")
      .select("id, name")
      .order("name", { ascending: true });

    if (!minimalError) {
      return {
        organizations: ((minimalData ?? []) as LookupRow[]).map((organization) => ({
          id: organization.id,
          country_id: null,
          is_active: true,
          name: getLookupLabel(organization),
        })),
        error: null,
      };
    }

    console.error("[ADMIN_ORGANIZATIONS_LOOKUP_FAILED]", error.message);
    return {
      organizations: [],
      error: "소속 기관 및 단체 목록을 불러오지 못했습니다.",
    };
  }

  return {
    organizations: ((data ?? []) as LookupRow[]).map((organization) => ({
      id: organization.id,
      country_id: organization.country_id ?? null,
      is_active: organization.is_active !== false,
      name: getLookupLabel(organization),
    })),
    error: null,
  };
}

async function loadCountryLookups(
  client: AdminSupabaseClient,
  ids: string[],
) {
  const countryMap = new Map<string, { code: string | null; name: string }>();
  const lookupIds = normalizeLookupIds(ids);

  if (lookupIds.length === 0) {
    return countryMap;
  }

  const cacheKey = createLookupCacheKey("countries", lookupIds);
  const cached = countryLookupCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cloneCountryMap(cached.value);
  }

  const { data, error } = await client
    .from("countries")
    .select("id, name, code")
    .in("id", lookupIds);

  if (error) {
    console.error("[ADMIN_USERS_COUNTRIES_LOOKUP] lookup failed");
    return countryMap;
  }

  for (const row of (data ?? []) as CountryLookupRow[]) {
    countryMap.set(row.id, {
      code: row.code,
      name: row.name,
    });
  }

  // 소속/lookup 정보 변경 후 최대 3분 반영 지연 가능.
  countryLookupCache.set(cacheKey, {
    expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS,
    value: cloneCountryMap(countryMap),
  });

  return countryMap;
}

async function countActiveUserRole(
  client: AdminSupabaseClient,
  role: UserRole,
): Promise<{ count: number; errorMessage: string | null }> {
  const { count, error } = await client
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", role)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null);

  return {
    count: count ?? 0,
    errorMessage: error?.message ?? null,
  };
}

export async function getAdminUserRoleSummary(
  perf?: AdminUserPerformanceLogger,
): Promise<{
  summary: AdminUserRoleSummaryCounts;
  error: string | null;
}> {
  const cachedSummary = adminUserRoleSummaryCache.get(
    USER_ROLE_SUMMARY_CACHE_KEY,
  );

  if (cachedSummary && cachedSummary.expiresAt > Date.now()) {
    const summary = cloneUserRoleSummary(cachedSummary.value);
    perf?.mark("summary.cache_hit", summary.totalProfiles);
    perf?.mark("summary.complete", summary.totalProfiles);

    return {
      summary,
      error: null,
    };
  }

  const { client: serviceClient } = createSupabaseServiceClient();

  if (!serviceClient) {
    perf?.mark("summary.service_client_unavailable");
    return {
      summary: createEmptyRoleSummaryCounts(),
      error: "Unable to load user summary right now.",
    };
  }

  const client = serviceClient;
  const roleTargets: Array<{
    role: UserRole;
    key: keyof Omit<AdminUserRoleSummaryCounts, "totalProfiles">;
  }> = [
    { role: "coachee", key: "coacheeCount" },
    { role: "coach", key: "coachCount" },
    { role: "coach_maker", key: "coachMakerCount" },
    { role: "church_admin", key: "churchAdminCount" },
    { role: "organization_admin", key: "organizationAdminCount" },
    { role: "super_admin", key: "superAdminCount" },
  ];

  const [profileCountResult, ...roleCountResults] = await Promise.all([
    client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    ...roleTargets.map((target) => countActiveUserRole(client, target.role)),
  ]);

  perf?.mark("summary.profiles_count_query", profileCountResult.count ?? 0);
  perf?.mark(
    "summary.roles_count_query",
    roleCountResults.reduce((total, result) => total + result.count, 0),
  );

  if (profileCountResult.error) {
    return {
      summary: createEmptyRoleSummaryCounts(),
      error: profileCountResult.error.message,
    };
  }

  const failedRoleCount = roleCountResults.find(
    (result) => result.errorMessage,
  );

  if (failedRoleCount?.errorMessage) {
    return {
      summary: createEmptyRoleSummaryCounts(),
      error: failedRoleCount.errorMessage,
    };
  }

  const summary = createEmptyRoleSummaryCounts();
  summary.totalProfiles = profileCountResult.count ?? 0;

  roleCountResults.forEach((result, index) => {
    summary[roleTargets[index].key] = result.count;
  });

  // 회원 생성/수정/역할 변경 직후 최대 1분 반영 지연 가능.
  adminUserRoleSummaryCache.set(USER_ROLE_SUMMARY_CACHE_KEY, {
    expiresAt: Date.now() + USER_ROLE_SUMMARY_CACHE_TTL_MS,
    value: cloneUserRoleSummary(summary),
  });

  return {
    summary,
    error: null,
  };
}

export async function getAdminUserDetail(
  profileId: string,
  detailPerf?: AdminUserPerformanceLogger,
): Promise<{
  user: AdminUserSummary | null;
  error: string | null;
}> {
  const perf = createApiPerformanceLogger("/api/admin/users/[profileId]");
  const { client: serviceClient } = createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[ADMIN_USER_DETAIL_CLIENT] service client unavailable");
    perf.mark("service_client_unavailable");
    return {
      user: null,
      error: "Unable to load user detail right now.",
    };
  }

  const client = serviceClient;
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select(
      "id, auth_user_id, full_name, display_name, email, phone, country_id, region_id, organization_id, church_id, group_id, ministry_position, primary_role, generation_number, status, created_at, updated_at",
    )
    .eq("id", profileId)
    .is("deleted_at", null)
    .maybeSingle();

  detailPerf?.mark("detail.profile_query", profile ? 1 : 0);
  perf.mark("profile_lookup", profile ? 1 : 0);

  if (profileError) {
    console.error("[ADMIN_USER_DETAIL_PROFILE] profile lookup failed");
    return {
      user: null,
      error: "Unable to load user detail right now.",
    };
  }

  const profileRow = profile as AdminProfileRow | null;

  if (!profileRow) {
    return {
      user: null,
      error: "Member not found.",
    };
  }

  const [countryLookups, regionNames, organizationNames, churchNames, groupNames] =
    await Promise.all([
      loadCountryLookups(client, uniqueStrings([profileRow.country_id])),
      loadLookupNames(client, "regions", uniqueStrings([profileRow.region_id])),
      loadLookupNames(
        client,
        "organizations",
        uniqueStrings([profileRow.organization_id]),
      ),
      loadLookupNames(client, "churches", uniqueStrings([profileRow.church_id])),
      loadLookupNames(client, "groups", uniqueStrings([profileRow.group_id])),
    ]);

  detailPerf?.mark(
    "detail.affiliations_query",
    countryLookups.size +
      regionNames.size +
      organizationNames.size +
      churchNames.size +
      groupNames.size,
  );
  perf.mark("lookup_names");

  const { data: roles, error: rolesError } = await client
    .from("user_roles")
    .select("id, profile_id, role, scope_type, scope_id, status, is_active, granted_at")
    .eq("profile_id", profileRow.id)
    .is("deleted_at", null)
      .order("granted_at", { ascending: false });

  detailPerf?.mark("detail.roles_query", roles?.length ?? 0);
  perf.mark("roles_lookup", roles?.length ?? 0);

  if (rolesError) {
    console.error("[ADMIN_USER_DETAIL_ROLES] role lookup failed");
    return {
      user: null,
      error: "Unable to load user detail right now.",
    };
  }

  const user = {
    id: profileRow.id,
    auth_user_id: profileRow.auth_user_id,
    full_name: profileRow.full_name,
    display_name: profileRow.display_name,
    email: profileRow.email,
    phone: profileRow.phone,
    country_id: profileRow.country_id,
    country_code: profileRow.country_id
      ? countryLookups.get(profileRow.country_id)?.code ?? null
      : null,
    country_name: profileRow.country_id
      ? countryLookups.get(profileRow.country_id)?.name ?? null
      : null,
    region_id: profileRow.region_id,
    region_name: profileRow.region_id
      ? regionNames.get(profileRow.region_id) ?? null
      : null,
    organization_id: profileRow.organization_id,
    organization_name: profileRow.organization_id
      ? organizationNames.get(profileRow.organization_id) ?? null
      : null,
    church_id: profileRow.church_id,
    church_name: profileRow.church_id
      ? churchNames.get(profileRow.church_id) ?? null
      : null,
    group_id: profileRow.group_id,
    group_name: profileRow.group_id
      ? groupNames.get(profileRow.group_id) ?? null
      : null,
    ministry_position: profileRow.ministry_position,
    primary_role: profileRow.primary_role,
    generation_number: profileRow.generation_number,
    status: profileRow.status,
    created_at: profileRow.created_at,
    updated_at: profileRow.updated_at,
    roles: ((roles ?? []) as AdminRoleRow[]).map((roleRow) => ({
      id: roleRow.id,
      role: roleRow.role,
      scope_type: roleRow.scope_type,
      scope_id: roleRow.scope_id,
      status: roleRow.status,
      is_active: roleRow.is_active,
      assigned_at: roleRow.granted_at,
    })),
  };

  detailPerf?.mark("detail.complete", 1);
  perf.mark("complete", 1);

  return {
    user,
    error: null,
  };
}

export function normalizeAdminUserSearch(value: string | string[] | undefined) {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  return resolved.trim().slice(0, 100);
}

export function normalizeAdminUserStatus(
  value: string | string[] | undefined,
): StatusFilter {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";

  if (resolved === "all") {
    return "all";
  }

  return PROFILE_STATUSES.includes(resolved as ProfileStatus)
    ? (resolved as ProfileStatus)
    : "all";
}

export function normalizeAdminUserRole(
  value: string | string[] | undefined,
): RoleFilter {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";

  if (resolved === "all") {
    return "all";
  }

  return USER_ROLES.includes(resolved as UserRole)
    ? (resolved as UserRole)
    : "all";
}

export function normalizeAdminUsersPage(
  value: string | string[] | undefined,
): number {
  const resolved = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const parsed = Number.parseInt(resolved, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export async function getAdminUsers({
  authorizedAdmin,
  q,
  role,
  status,
  page,
  limit = DEFAULT_LIMIT,
}: {
  authorizedAdmin?: AuthorizedAdminProfile;
  q: string;
  role: RoleFilter;
  status: StatusFilter;
  page: number;
  limit?: number;
}): Promise<AdminUsersResult> {
  const perf = createApiPerformanceLogger("/admin/users");
  const admin = authorizedAdmin ?? (await requireAdminProfile());
  const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const safePage = Math.max(page, 1);

  if (!admin.ok) {
    perf.mark("auth_denied");
    return {
      users: [],
      summary: createEmptySummary(),
      error: "Admin authorization is required to load users.",
      page: safePage,
      limit: safeLimit,
      hasNext: false,
    };
  }

  const { client: serviceClient } = createSupabaseServiceClient();

  if (!serviceClient) {
    console.error("[ADMIN_USERS_CLIENT] service client unavailable");
    perf.mark("service_client_unavailable");
    return {
      users: [],
      summary: createEmptySummary(),
      error: "Unable to load users right now.",
      page: safePage,
      limit: safeLimit,
      hasNext: false,
    };
  }

  const client = serviceClient;
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit;
  const profileSelect =
    role === "all"
      ? "id, auth_user_id, full_name, display_name, email, phone, country_id, region_id, organization_id, church_id, group_id, ministry_position, primary_role, generation_number, status, created_at, updated_at"
      : "id, auth_user_id, full_name, display_name, email, phone, country_id, region_id, organization_id, church_id, group_id, ministry_position, primary_role, generation_number, status, created_at, updated_at, user_roles!inner(id)";

  let profilesQuery = client
    .from("profiles")
    .select(profileSelect)
    .is("deleted_at", null);

  if (status !== "all") {
    profilesQuery = profilesQuery.eq("status", status);
  }

  if (q.length > 0) {
    profilesQuery = profilesQuery.or(buildProfileSearchFilter(q));
  }

  if (role !== "all") {
    profilesQuery = profilesQuery
      .eq("user_roles.role", role)
      .eq("user_roles.status", "active")
      .eq("user_roles.is_active", true)
      .is("user_roles.deleted_at", null);
  }

  const summary = createEmptySummary();
  const { data: profiles, error: profilesError } = await profilesQuery
    .order("created_at", { ascending: false })
    .range(from, to);

  perf.mark("profiles_query", profiles?.length ?? 0);

  if (profilesError) {
    console.error("[ADMIN_USERS_PROFILES] profile lookup failed");
    return {
      users: [],
      summary,
      error: "Unable to load users right now.",
      page: safePage,
      limit: safeLimit,
      hasNext: false,
    };
  }

  const profileRows = ((profiles ?? []) as AdminProfileRow[]).slice(0, safeLimit);
  const hasNext = (profiles?.length ?? 0) > safeLimit;

  if (profileRows.length === 0) {
    perf.mark("complete", 0);
    return {
      users: [],
      summary,
      error: null,
      page: safePage,
      limit: safeLimit,
      hasNext,
    };
  }

  const profileIds = profileRows.map((profile) => profile.id);
  const [countryLookups, regionNames, organizationNames, churchNames, groupNames] =
    await Promise.all([
    loadCountryLookups(
      client,
      uniqueStrings(profileRows.map((profile) => profile.country_id)),
    ),
    loadLookupNames(
      client,
      "regions",
      uniqueStrings(profileRows.map((profile) => profile.region_id)),
    ),
    loadLookupNames(
      client,
      "organizations",
      uniqueStrings(profileRows.map((profile) => profile.organization_id)),
    ),
    loadLookupNames(client, "churches", uniqueStrings(profileRows.map((profile) => profile.church_id))),
    loadLookupNames(client, "groups", uniqueStrings(profileRows.map((profile) => profile.group_id))),
  ]);

  perf.mark("lookup_names", profileRows.length);

  // Existing project convention: profiles.id -> user_roles.profile_id.
  const { data: roles, error: rolesError } = await client
    .from("user_roles")
    .select("id, profile_id, role, scope_type, scope_id, status, is_active, granted_at")
    .in("profile_id", profileIds)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("granted_at", { ascending: false });

  perf.mark("roles_query", roles?.length ?? 0);

  if (rolesError) {
    console.error("[ADMIN_USERS_ROLES] role lookup failed");
    return {
      users: [],
      summary,
      error: "Unable to load users right now.",
      page: safePage,
      limit: safeLimit,
      hasNext: false,
    };
  }

  const rolesByProfileId = new Map<string, AdminUserRoleSummary[]>();

  for (const roleRow of (roles ?? []) as AdminRoleRow[]) {
    const current = rolesByProfileId.get(roleRow.profile_id) ?? [];
    current.push({
      id: roleRow.id,
      role: roleRow.role,
      scope_type: roleRow.scope_type,
      scope_id: roleRow.scope_id,
      status: roleRow.status,
      is_active: roleRow.is_active,
      assigned_at: roleRow.granted_at,
    });
    rolesByProfileId.set(roleRow.profile_id, current);
  }

  const users = profileRows.map((profile) => ({
    id: profile.id,
    auth_user_id: profile.auth_user_id,
    full_name: profile.full_name,
    display_name: profile.display_name,
    email: profile.email,
    phone: profile.phone,
    country_id: profile.country_id,
    country_code: profile.country_id
      ? countryLookups.get(profile.country_id)?.code ?? null
      : null,
    country_name: profile.country_id
      ? countryLookups.get(profile.country_id)?.name ?? null
      : null,
    region_id: profile.region_id,
    region_name: profile.region_id ? regionNames.get(profile.region_id) ?? null : null,
    organization_id: profile.organization_id,
    organization_name: profile.organization_id
      ? organizationNames.get(profile.organization_id) ?? null
      : null,
    church_id: profile.church_id,
    church_name: profile.church_id ? churchNames.get(profile.church_id) ?? null : null,
    group_id: profile.group_id,
    group_name: profile.group_id ? groupNames.get(profile.group_id) ?? null : null,
    ministry_position: profile.ministry_position,
    primary_role: profile.primary_role,
    generation_number: profile.generation_number,
    status: profile.status,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    roles: rolesByProfileId.get(profile.id) ?? [],
  }));

  perf.mark("complete", users.length);

  return {
    users,
    summary,
    error: null,
    page: safePage,
    limit: safeLimit,
    hasNext,
  };
}
