import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createApiPerformanceLogger } from "@/lib/performance";
import {
  DEFAULT_TIMEZONE,
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
  getEffectiveTimezone,
} from "@/lib/timezone";
import type { ScopeType, Tables, UserRole } from "@/types/database";

const ALLOWED_ROLES = new Set<UserRole>([
  "coach_maker",
  "church_admin",
  "organization_admin",
  "country_admin",
  "super_admin",
]);
const BROAD_ACCESS_ROLES = new Set<UserRole>([
  "organization_admin",
  "country_admin",
  "super_admin",
]);
const MAX_DB_PREFILTER_PROFILE_IDS = 200;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const AFFILIATION_LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;

type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;
type ProfileIdRow = { id: string };
type CurrentProfileRow = { id: string; timezone: string | null };
type CurrentRoleRow = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
};

type ScopedRoleRow = CurrentRoleRow;

async function resolveScopedProfileIds(
  serviceClient: ServiceSupabaseClient,
  roles: ScopedRoleRow[],
): Promise<string[] | null> {
  const orFilters = roles
    .filter((r) => r.scope_id && r.scope_type !== "global" && r.scope_type !== "coach")
    .map((r) => {
      switch (r.scope_type) {
        case "country":
          return `country_id.eq.${r.scope_id}`;
        case "region":
          return `region_id.eq.${r.scope_id}`;
        case "organization":
          return `organization_id.eq.${r.scope_id}`;
        case "church":
          return `church_id.eq.${r.scope_id}`;
        case "group":
          return `group_id.eq.${r.scope_id}`;
        case "cohort":
          return `cohort_id.eq.${r.scope_id}`;
        default:
          return null;
      }
    })
    .filter((v): v is string => v !== null);

  if (orFilters.length === 0) {
    return [];
  }

  const { data, error } = await serviceClient
    .from("profiles")
    .select("id")
    .or(orFilters.join(","))
    .is("deleted_at", null)
    .limit(MAX_DB_PREFILTER_PROFILE_IDS + 1);

  if (error) {
    return null;
  }

  const ids = ((data ?? []) as ProfileIdRow[]).map((row) => row.id);
  if (ids.length > MAX_DB_PREFILTER_PROFILE_IDS) {
    return null;
  }

  return ids;
}
type RelationshipRow = {
  id: string;
  coach_profile_id: string;
  coachee_profile_id: string;
  status: string;
};
type ProfileRow = Pick<
  Tables<"profiles">,
  | "id"
  | "display_name"
  | "full_name"
  | "email"
  | "country_id"
  | "region_id"
  | "organization_id"
  | "church_id"
  | "group_id"
  | "ministry_position"
  | "generation_number"
  | "primary_role"
>;
type CountryRow = Pick<Tables<"countries">, "id" | "name" | "code">;
type RegionRow = Pick<Tables<"regions">, "id" | "name">;
type OrganizationRow = Pick<Tables<"organizations">, "id" | "name">;
type ChurchRow = Pick<Tables<"churches">, "id" | "name">;
type GroupRow = Pick<Tables<"groups">, "id" | "name">;
type PlanRow = Pick<
  Tables<"moksilgi_plans">,
  | "id"
  | "profile_id"
  | "author_name"
  | "role_label"
  | "generation_label"
  | "region_name"
  | "team_name"
  | "updated_at"
>;
type SummaryRow = Pick<
  Tables<"moksilgi_monthly_summaries">,
  "plan_id" | "month" | "average_rate"
>;
type LookupQueryResult<TRow> = {
  data: TRow[];
  error: unknown;
};
type LookupCacheEntry = {
  expiresAt: number;
  rows: Array<{ id: string }>;
};

const affiliationLookupCache = new Map<string, LookupCacheEntry>();

export type CoachMakerMoksilgiProgressFilters = {
  year: number;
  teamName?: string | null;
  regionName?: string | null;
  roleLabel?: string | null;
  generationLabel?: string | null;
  search?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

export type CoachMakerMoksilgiProgressRow = {
  index: number;
  profile_id: string;
  plan_id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  author_name: string | null;
  country_id: string | null;
  country_name: string | null;
  country_code: string | null;
  region_id: string | null;
  role_label: string | null;
  generation_label: string | null;
  generation_number: number | null;
  region_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  church_id: string | null;
  church_name: string | null;
  group_id: string | null;
  group_name: string | null;
  ministry_position: string | null;
  primary_role: UserRole | null;
  team_name: string | null;
  month_1_rate: number;
  month_2_rate: number;
  month_3_rate: number;
  month_4_rate: number;
  month_5_rate: number;
  month_6_rate: number;
  month_7_rate: number;
  month_8_rate: number;
  month_9_rate: number;
  month_10_rate: number;
  month_11_rate: number;
  month_12_rate: number;
  cumulative_rate: number;
};

export type CoachMakerMoksilgiRelationshipProgressRow = {
  relationship_id: string;
  coach_profile_id: string;
  coachee_profile_id: string;
  coach_display_name: string | null;
  coach_full_name: string | null;
  coach_email: string | null;
  coachee_display_name: string | null;
  coachee_full_name: string | null;
  coachee_email: string | null;
  coachee_country_name: string | null;
  coachee_country_code: string | null;
  coachee_region_name: string | null;
  coachee_organization_name: string | null;
  coachee_church_name: string | null;
  coachee_group_name: string | null;
  coachee_ministry_position: string | null;
  coachee_generation_number: number | null;
  coachee_primary_role: UserRole | null;
  relationship_status: string;
  month_1_rate: number | null;
  month_2_rate: number | null;
  month_3_rate: number | null;
  month_4_rate: number | null;
  month_5_rate: number | null;
  month_6_rate: number | null;
  month_7_rate: number | null;
  month_8_rate: number | null;
  month_9_rate: number | null;
  month_10_rate: number | null;
  month_11_rate: number | null;
  month_12_rate: number | null;
};

export type CoachMakerMoksilgiProgressAverageRow = {
  month_1_rate: number;
  month_2_rate: number;
  month_3_rate: number;
  month_4_rate: number;
  month_5_rate: number;
  month_6_rate: number;
  month_7_rate: number;
  month_8_rate: number;
  month_9_rate: number;
  month_10_rate: number;
  month_11_rate: number;
  month_12_rate: number;
  cumulative_rate: number;
};

export type CoachMakerMoksilgiProgressPagination = {
  hasNext: boolean;
  hasPrevious: boolean;
  isPaginated: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
};

export type GetCoachMakerMoksilgiProgressErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "ROLES_QUERY_FAILED"
  | "ACCESS_DENIED"
  | "RELATIONSHIPS_QUERY_FAILED"
  | "MOKSILGI_QUERY_FAILED"
  | "PROFILES_QUERY_FAILED"
  | "SUMMARY_QUERY_FAILED";

export type GetCoachMakerMoksilgiProgressResult =
  | {
      data: {
        rows: CoachMakerMoksilgiProgressRow[];
        printRows: CoachMakerMoksilgiProgressRow[];
        printRelationshipRows: CoachMakerMoksilgiRelationshipProgressRow[];
        relationshipRows: CoachMakerMoksilgiRelationshipProgressRow[];
        averageRow: CoachMakerMoksilgiProgressAverageRow;
        overview: {
          careCounts: {
            attention: number;
            missing: number;
          };
          statusCounts: {
            completed: number;
            inProgress: number;
            notStarted: number;
          };
          totalRows: number;
        };
        pagination: CoachMakerMoksilgiProgressPagination;
        upToCurrentRate: number;
        year: number;
        timezone: string;
        scopeMode: "all" | "direct_coaching_relationships";
      };
      error: null;
    }
  | {
      data: null;
      error: {
        code: GetCoachMakerMoksilgiProgressErrorCode;
        message: string;
      };
    };

function getServiceClientResult():
  | { ok: true; serviceClient: ServiceSupabaseClient }
  | {
      ok: false;
      error: {
        code: "MOKSILGI_QUERY_FAILED";
        message: string;
      };
    } {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    console.error("[COACH_MAKER_MOKSILGI_PROGRESS_SERVICE_CLIENT_UNAVAILABLE]", error);
    return {
      ok: false,
      error: {
        code: "MOKSILGI_QUERY_FAILED",
        message: "지금 전체 목실기 성취 현황을 불러올 수 없습니다.",
      },
    };
  }

  return { ok: true, serviceClient: client };
}

function validateYear(year: number) {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

function safeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function buildIlikePattern(value: string | null | undefined) {
  const normalized = safeText(value);
  return normalized ? `%${escapeIlikePattern(normalized)}%` : null;
}

function buildPostgrestOrIlikePattern(value: string | null | undefined) {
  const normalized = safeText(value);
  if (!normalized || /[(),]/.test(normalized)) return null;
  return `%${escapeIlikePattern(normalized)}%`;
}

function profileIdCondition(profileIds: string[]) {
  return `profile_id.in.(${profileIds.join(",")})`;
}

function columnOrProfileCondition(
  column: string,
  pattern: string,
  profileIds: string[] | null,
) {
  const conditions = [`${column}.ilike.${pattern}`];

  if (profileIds && profileIds.length > 0) {
    conditions.push(profileIdCondition(profileIds));
  }

  return conditions.join(",");
}

function parseGenerationFilter(value: string | null | undefined) {
  const normalized = safeText(value);
  if (!normalized) return null;

  const match = normalized.match(/\d+/);
  if (!match) return null;

  const generation = Number.parseInt(match[0], 10);
  return Number.isInteger(generation) && generation > 0 ? generation : null;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function uniqueNonNull(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function uniqueSortedNonNull(values: Array<string | null | undefined>) {
  return uniqueNonNull(values).sort();
}

function mapById<TRow extends { id: string }>(rows: TRow[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

async function getCachedLookupRows<TRow extends { id: string }>(
  kind: string,
  ids: string[],
  loadRows: (lookupIds: string[]) => Promise<{
    data: TRow[] | null;
    error: unknown;
  }>,
): Promise<LookupQueryResult<TRow>> {
  const lookupIds = uniqueSortedNonNull(ids);

  if (lookupIds.length === 0) {
    return { data: [], error: null };
  }

  const cacheKey = `${kind}:${lookupIds.join(",")}`;
  const cached = affiliationLookupCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.rows as TRow[], error: null };
  }

  const { data, error } = await loadRows(lookupIds);

  if (error) {
    return { data: [], error };
  }

  const rows = data ?? [];

  // Affiliation data is editable in admin settings; this short server cache can delay
  // reflecting those edits for up to AFFILIATION_LOOKUP_CACHE_TTL_MS.
  affiliationLookupCache.set(cacheKey, {
    expiresAt: Date.now() + AFFILIATION_LOOKUP_CACHE_TTL_MS,
    rows,
  });

  return { data: rows, error: null };
}

function limitedProfileIds(rows: ProfileIdRow[] | null) {
  if (!rows) return [];
  if (rows.length > MAX_DB_PREFILTER_PROFILE_IDS) return null;
  return rows.map((row) => row.id);
}

async function getProfileIdsBySearch(
  serviceClient: ServiceSupabaseClient,
  search: string | null | undefined,
) {
  const pattern = buildPostgrestOrIlikePattern(search);
  if (!pattern) return null;

  const { data, error } = await serviceClient
    .from("profiles")
    .select("id")
    .or(
      [
        `display_name.ilike.${pattern}`,
        `full_name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
      ].join(","),
    )
    .is("deleted_at", null)
    .limit(MAX_DB_PREFILTER_PROFILE_IDS + 1);

  if (error) {
    console.error("[COACH_MAKER_MOKSILGI_PROGRESS_SEARCH_PREFILTER_FAILED]", error);
    return null;
  }

  return limitedProfileIds((data ?? []) as ProfileIdRow[]);
}

async function getProfileIdsByGeneration(
  serviceClient: ServiceSupabaseClient,
  generationLabel: string | null | undefined,
) {
  const generation = parseGenerationFilter(generationLabel);
  if (!generation) return null;

  const { data, error } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("generation_number", generation)
    .is("deleted_at", null)
    .limit(MAX_DB_PREFILTER_PROFILE_IDS + 1);

  if (error) {
    console.error("[COACH_MAKER_MOKSILGI_PROGRESS_GENERATION_PREFILTER_FAILED]", error);
    return null;
  }

  return limitedProfileIds((data ?? []) as ProfileIdRow[]);
}

async function getProfileIdsByRegionName(
  serviceClient: ServiceSupabaseClient,
  regionName: string | null | undefined,
) {
  const pattern = buildIlikePattern(regionName);
  if (!pattern) return null;

  const { data: regions, error: regionsError } = await serviceClient
    .from("regions")
    .select("id")
    .ilike("name", pattern)
    .limit(MAX_DB_PREFILTER_PROFILE_IDS + 1);

  if (regionsError) {
    console.error("[COACH_MAKER_MOKSILGI_PROGRESS_REGION_PREFILTER_FAILED]", regionsError);
    return null;
  }

  const regionIds = uniqueNonNull(
    ((regions ?? []) as Array<{ id: string }>).map((region) => region.id),
  );
  if (regionIds.length === 0) return [];
  if (regionIds.length > MAX_DB_PREFILTER_PROFILE_IDS) return null;

  const { data: profiles, error: profilesError } = await serviceClient
    .from("profiles")
    .select("id")
    .in("region_id", regionIds)
    .is("deleted_at", null)
    .limit(MAX_DB_PREFILTER_PROFILE_IDS + 1);

  if (profilesError) {
    console.error(
      "[COACH_MAKER_MOKSILGI_PROGRESS_REGION_PROFILE_PREFILTER_FAILED]",
      profilesError,
    );
    return null;
  }

  return limitedProfileIds((profiles ?? []) as ProfileIdRow[]);
}

async function buildDbPrefilters(
  serviceClient: ServiceSupabaseClient,
  filters: CoachMakerMoksilgiProgressFilters,
) {
  const [searchProfileIds, generationProfileIds, regionProfileIds] =
    await Promise.all([
      getProfileIdsBySearch(serviceClient, filters.search),
      getProfileIdsByGeneration(serviceClient, filters.generationLabel),
      getProfileIdsByRegionName(serviceClient, filters.regionName),
    ]);

  return {
    searchProfileIds,
    generationProfileIds,
    regionProfileIds,
  };
}

type PlansDbPrefilters = Awaited<ReturnType<typeof buildDbPrefilters>>;

type PlansFilterableQuery = {
  in: (column: string, values: string[]) => PlansFilterableQuery;
  ilike: (column: string, pattern: string) => PlansFilterableQuery;
  or: (filters: string) => PlansFilterableQuery;
};

function applyMoksilgiPlansFiltersToQuery<T extends PlansFilterableQuery>(
  plansQuery: T,
  options: {
    accessibleProfileIds: string[] | null;
    dbPrefilters: PlansDbPrefilters;
    teamNamePattern: string | null;
    roleLabelPattern: string | null;
    regionNamePattern: string | null;
    generationLabelPattern: string | null;
    searchPattern: string | null;
  },
): T {
  let q: PlansFilterableQuery = plansQuery;

  if (options.accessibleProfileIds) {
    q = q.in("profile_id", options.accessibleProfileIds);
  }

  if (options.teamNamePattern) {
    q = q.ilike("team_name", options.teamNamePattern);
  }

  if (options.roleLabelPattern) {
    q = q.ilike("role_label", options.roleLabelPattern);
  }

  if (options.regionNamePattern && options.dbPrefilters.regionProfileIds !== null) {
    q = q.or(
      columnOrProfileCondition(
        "region_name",
        options.regionNamePattern,
        options.dbPrefilters.regionProfileIds,
      ),
    );
  }

  if (options.generationLabelPattern && options.dbPrefilters.generationProfileIds !== null) {
    q = q.or(
      columnOrProfileCondition(
        "generation_label",
        options.generationLabelPattern,
        options.dbPrefilters.generationProfileIds,
      ),
    );
  }

  if (options.searchPattern && options.dbPrefilters.searchProfileIds !== null) {
    q = q.or(
      columnOrProfileCondition(
        "author_name",
        options.searchPattern,
        options.dbPrefilters.searchProfileIds,
      ),
    );
  }

  return q as T;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizePagination(filters: CoachMakerMoksilgiProgressFilters) {
  const isPaginated = filters.page !== undefined || filters.pageSize !== undefined;
  const page = Number.isInteger(filters.page) && (filters.page ?? 0) > 0
    ? filters.page ?? 1
    : 1;
  const requestedPageSize =
    Number.isInteger(filters.pageSize) && (filters.pageSize ?? 0) > 0
      ? filters.pageSize ?? DEFAULT_PAGE_SIZE
      : DEFAULT_PAGE_SIZE;

  return {
    isPaginated,
    page,
    pageSize: Math.min(requestedPageSize, MAX_PAGE_SIZE),
  };
}

function buildPaginationMeta({
  isPaginated,
  page,
  pageSize,
  totalRows,
}: {
  isPaginated: boolean;
  page: number;
  pageSize: number;
  totalRows: number;
}) {
  const totalPages = isPaginated
    ? Math.max(1, Math.ceil(totalRows / pageSize))
    : 1;
  const safePage = isPaginated ? Math.min(page, totalPages) : 1;

  return {
    hasNext: isPaginated && safePage < totalPages,
    hasPrevious: isPaginated && safePage > 1,
    isPaginated,
    page: safePage,
    pageSize,
    totalPages,
    totalRows,
  };
}

function monthKey(month: number) {
  return `month_${month}_rate` as keyof CoachMakerMoksilgiProgressAverageRow;
}

function emptyAverageRow(): CoachMakerMoksilgiProgressAverageRow {
  return {
    month_1_rate: 0,
    month_2_rate: 0,
    month_3_rate: 0,
    month_4_rate: 0,
    month_5_rate: 0,
    month_6_rate: 0,
    month_7_rate: 0,
    month_8_rate: 0,
    month_9_rate: 0,
    month_10_rate: 0,
    month_11_rate: 0,
    month_12_rate: 0,
    cumulative_rate: 0,
  };
}

function calculateAverageRow(rows: CoachMakerMoksilgiProgressRow[]) {
  if (rows.length === 0) return emptyAverageRow();

  const averageRow = emptyAverageRow();
  const monthSums = Array.from({ length: 12 }, () => 0);
  let cumulativeSum = 0;

  for (const row of rows) {
    for (let month = 1; month <= 12; month += 1) {
      monthSums[month - 1] += safeNumber(row[monthKey(month)]);
    }

    cumulativeSum += safeNumber(row.cumulative_rate);
  }

  for (let month = 1; month <= 12; month += 1) {
    averageRow[monthKey(month)] = monthSums[month - 1] / rows.length;
  }

  averageRow.cumulative_rate = cumulativeSum / rows.length;

  return averageRow;
}

function buildProgressSummary(
  rows: CoachMakerMoksilgiProgressRow[],
  year: number,
  timezone: string,
) {
  const averageRow = calculateAverageRow(rows);

  return {
    averageRow,
    upToCurrentRate: calculateUpToCurrentRate(averageRow, year, timezone),
  };
}

function getCurrentMonthCutoff(year: number, timezone: string) {
  const currentYear = getCurrentYearInTimezone(timezone);

  if (year < currentYear) return 12;
  if (year > currentYear) return 0;
  return getCurrentMonthInTimezone(timezone);
}

function calculateUpToCurrentRate(
  averageRow: CoachMakerMoksilgiProgressAverageRow,
  year: number,
  timezone: string,
) {
  const cutoff = getCurrentMonthCutoff(year, timezone);
  if (cutoff === 0) return 0;

  return average(
    Array.from({ length: cutoff }, (_, index) =>
      safeNumber(averageRow[monthKey(index + 1)]),
    ),
  );
}

function calculateRowUpToCurrentRate(
  row: CoachMakerMoksilgiProgressRow,
  year: number,
  timezone: string,
) {
  const cutoff = getCurrentMonthCutoff(year, timezone);
  if (cutoff <= 0) return 0;

  return average(
    Array.from({ length: cutoff }, (_, index) =>
      safeNumber(row[monthKey(index + 1)]),
    ),
  );
}

function hasProgressInput(row: CoachMakerMoksilgiProgressRow) {
  for (let month = 1; month <= 12; month += 1) {
    if (safeNumber(row[monthKey(month)]) > 0) {
      return true;
    }
  }

  return safeNumber(row.cumulative_rate) > 0;
}

function buildProgressOverview(
  rows: CoachMakerMoksilgiProgressRow[],
  year: number,
  timezone: string,
) {
  const overview = {
    careCounts: {
      attention: 0,
      missing: 0,
    },
    statusCounts: {
      completed: 0,
      inProgress: 0,
      notStarted: 0,
    },
    totalRows: rows.length,
  };

  for (const row of rows) {
    const cumulativeRate = safeNumber(row.cumulative_rate);

    if (cumulativeRate >= 100) {
      overview.statusCounts.completed += 1;
    } else if (cumulativeRate > 0) {
      overview.statusCounts.inProgress += 1;
    } else {
      overview.statusCounts.notStarted += 1;
    }

    if (!hasProgressInput(row)) {
      overview.careCounts.missing += 1;
    } else if (calculateRowUpToCurrentRate(row, year, timezone) < 50) {
      overview.careCounts.attention += 1;
    }
  }

  return overview;
}

function matchesTextFilter(value: string | null, filter: string | null | undefined) {
  const normalizedFilter = safeText(filter)?.toLowerCase();
  if (!normalizedFilter) return true;

  return (value ?? "").toLowerCase().includes(normalizedFilter);
}

function matchesSearchFilter(
  row: CoachMakerMoksilgiProgressRow,
  search: string | null | undefined,
) {
  const normalizedSearch = safeText(search)?.toLowerCase();
  if (!normalizedSearch) return true;

  return [
    row.author_name,
    row.display_name,
    row.full_name,
    row.email,
  ].some((value) => (value ?? "").toLowerCase().includes(normalizedSearch));
}

function applyFilters(
  rows: CoachMakerMoksilgiProgressRow[],
  filters: CoachMakerMoksilgiProgressFilters,
) {
  return rows
    .filter((row) => matchesTextFilter(row.team_name, filters.teamName))
    .filter((row) => matchesTextFilter(row.region_name, filters.regionName))
    .filter((row) => matchesTextFilter(row.role_label, filters.roleLabel))
    .filter((row) => matchesTextFilter(row.generation_label, filters.generationLabel))
    .filter((row) => matchesSearchFilter(row, filters.search))
    .map((row, index) => ({ ...row, index: index + 1 }));
}

function buildProgressRows({
  filters,
  lookups,
  planRows,
  profilesById,
  selectedYear,
  summariesByPlanId,
}: {
  filters: CoachMakerMoksilgiProgressFilters;
  lookups: {
    churches: Map<string, ChurchRow>;
    countries: Map<string, CountryRow>;
    groups: Map<string, GroupRow>;
    organizations: Map<string, OrganizationRow>;
    regions: Map<string, RegionRow>;
  };
  planRows: PlanRow[];
  profilesById: Map<string, ProfileRow>;
  selectedYear: number;
  summariesByPlanId: Map<string, SummaryRow[]>;
}) {
  return applyFilters(
    planRows.map((plan, index) =>
      buildRow(
        plan,
        profilesById.get(plan.profile_id),
        lookups,
        summariesByPlanId.get(plan.id) ?? [],
        index + 1,
      ),
    ),
    { ...filters, year: selectedYear },
  );
}

function buildPrintRows(rows: CoachMakerMoksilgiProgressRow[]) {
  return rows;
}

function buildTableRows(
  rows: CoachMakerMoksilgiProgressRow[],
  pagination: Pick<CoachMakerMoksilgiProgressPagination, "isPaginated" | "page" | "pageSize">,
) {
  if (!pagination.isPaginated) {
    return rows;
  }

  const from = (pagination.page - 1) * pagination.pageSize;
  return rows.slice(from, from + pagination.pageSize);
}

function buildRow(
  plan: PlanRow,
  profile: ProfileRow | undefined,
  lookups: {
    churches: Map<string, ChurchRow>;
    countries: Map<string, CountryRow>;
    groups: Map<string, GroupRow>;
    organizations: Map<string, OrganizationRow>;
    regions: Map<string, RegionRow>;
  },
  summaries: SummaryRow[],
  index: number,
) {
  const monthRates = buildSafeMonthRates(summaries);

  return {
    index,
    profile_id: plan.profile_id,
    plan_id: plan.id,
    display_name: profile?.display_name ?? null,
    full_name: profile?.full_name ?? null,
    email: profile?.email ?? null,
    author_name: plan.author_name,
    country_id: profile?.country_id ?? null,
    country_name: profile?.country_id
      ? lookups.countries.get(profile.country_id)?.name ?? null
      : null,
    country_code: profile?.country_id
      ? lookups.countries.get(profile.country_id)?.code ?? null
      : null,
    region_id: profile?.region_id ?? null,
    role_label: plan.role_label,
    generation_label: profile?.generation_number
      ? `${profile.generation_number}세대`
      : plan.generation_label,
    generation_number: profile?.generation_number ?? null,
    region_name: profile?.region_id
      ? lookups.regions.get(profile.region_id)?.name ?? plan.region_name
      : plan.region_name,
    organization_id: profile?.organization_id ?? null,
    organization_name: profile?.organization_id
      ? lookups.organizations.get(profile.organization_id)?.name ?? null
      : null,
    church_id: profile?.church_id ?? null,
    church_name: profile?.church_id
      ? lookups.churches.get(profile.church_id)?.name ?? null
      : null,
    group_id: profile?.group_id ?? null,
    group_name: profile?.group_id
      ? lookups.groups.get(profile.group_id)?.name ?? plan.team_name
      : plan.team_name,
    ministry_position: profile?.ministry_position ?? null,
    primary_role: profile?.primary_role ?? null,
    team_name: plan.team_name,
    month_1_rate: monthRates[0],
    month_2_rate: monthRates[1],
    month_3_rate: monthRates[2],
    month_4_rate: monthRates[3],
    month_5_rate: monthRates[4],
    month_6_rate: monthRates[5],
    month_7_rate: monthRates[6],
    month_8_rate: monthRates[7],
    month_9_rate: monthRates[8],
    month_10_rate: monthRates[9],
    month_11_rate: monthRates[10],
    month_12_rate: monthRates[11],
    cumulative_rate: average(monthRates),
  } satisfies CoachMakerMoksilgiProgressRow;
}

function buildSafeMonthRates(summaries: SummaryRow[]) {
  const monthRates: number[] = Array.from({ length: 12 }, () => 0);

  for (const summary of summaries) {
    const monthIndex = summary.month - 1;
    if (monthIndex < 0 || monthIndex >= monthRates.length) {
      continue;
    }

    if (
      typeof summary.average_rate === "number" &&
      Number.isFinite(summary.average_rate)
    ) {
      monthRates[monthIndex] = summary.average_rate;
    }
  }

  return monthRates;
}

function buildNullableMonthRates(summaries: SummaryRow[]) {
  const monthRates: Array<number | null> = Array.from({ length: 12 }, () => null);

  for (const summary of summaries) {
    const monthIndex = summary.month - 1;
    if (monthIndex < 0 || monthIndex >= monthRates.length) {
      continue;
    }

    if (
      typeof summary.average_rate === "number" &&
      Number.isFinite(summary.average_rate)
    ) {
      monthRates[monthIndex] = summary.average_rate;
    }
  }

  return monthRates;
}

function buildRelationshipProgressRows({
  profilesById,
  relationships,
  rowsByProfileId,
  summariesByPlanId,
}: {
  profilesById: Map<string, ProfileRow>;
  relationships: RelationshipRow[];
  rowsByProfileId: Map<string, CoachMakerMoksilgiProgressRow>;
  summariesByPlanId: Map<string, SummaryRow[]>;
}) {
  return relationships.map((relationship) => {
    const coacheeProgress = rowsByProfileId.get(relationship.coachee_profile_id);
    const summaries = coacheeProgress
      ? summariesByPlanId.get(coacheeProgress.plan_id) ?? []
      : [];
    const monthRates = buildNullableMonthRates(summaries);
    const coach = profilesById.get(relationship.coach_profile_id);
    const coachee = profilesById.get(relationship.coachee_profile_id);

    return {
      relationship_id: relationship.id,
      coach_profile_id: relationship.coach_profile_id,
      coachee_profile_id: relationship.coachee_profile_id,
      coach_display_name: coach?.display_name ?? null,
      coach_full_name: coach?.full_name ?? null,
      coach_email: coach?.email ?? null,
      coachee_display_name: coachee?.display_name ?? null,
      coachee_full_name: coachee?.full_name ?? null,
      coachee_email: coachee?.email ?? null,
      coachee_country_name: coacheeProgress?.country_name ?? null,
      coachee_country_code: coacheeProgress?.country_code ?? null,
      coachee_region_name: coacheeProgress?.region_name ?? null,
      coachee_organization_name: coacheeProgress?.organization_name ?? null,
      coachee_church_name: coacheeProgress?.church_name ?? null,
      coachee_group_name: coacheeProgress?.group_name ?? null,
      coachee_ministry_position: coacheeProgress?.ministry_position ?? null,
      coachee_generation_number: coacheeProgress?.generation_number ?? null,
      coachee_primary_role: coacheeProgress?.primary_role ?? null,
      relationship_status: relationship.status,
      month_1_rate: monthRates[0],
      month_2_rate: monthRates[1],
      month_3_rate: monthRates[2],
      month_4_rate: monthRates[3],
      month_5_rate: monthRates[4],
      month_6_rate: monthRates[5],
      month_7_rate: monthRates[6],
      month_8_rate: monthRates[7],
      month_9_rate: monthRates[8],
      month_10_rate: monthRates[9],
      month_11_rate: monthRates[10],
      month_12_rate: monthRates[11],
    } satisfies CoachMakerMoksilgiRelationshipProgressRow;
  });
}

export async function getCoachMakerMoksilgiProgress(
  filters: CoachMakerMoksilgiProgressFilters,
): Promise<GetCoachMakerMoksilgiProgressResult> {
  const perf = createApiPerformanceLogger("/coach-maker/moksilgi-progress");
  const requestedPagination = normalizePagination(filters);
  const selectedYear = validateYear(filters.year)
    ? filters.year
    : getCurrentYearInTimezone(DEFAULT_TIMEZONE);
  const session = await getSession();

  if (!session.user) {
    perf.mark("auth.session_missing");
    return {
      data: null,
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
    };
  }

  const supabase = await createSupabaseServerClient();
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = supabase
    .from("profiles")
    .select("id, timezone")
    .is("deleted_at", null)
    .eq("status", "active");

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  perf.mark("auth.profile_lookup", profile ? 1 : 0);

  if (profileError) {
    return {
      data: null,
      error: {
        code: "PROFILE_QUERY_FAILED",
        message: "프로필을 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  if (!profile) {
    return {
      data: null,
      error: {
        code: "PROFILE_NOT_FOUND",
        message: "아직 프로필이 생성되지 않았습니다.",
      },
    };
  }

  const profileRecord = profile as CurrentProfileRow;
  const profileId = profileRecord.id;
  const effectiveTimezone = getEffectiveTimezone(profileRecord.timezone);
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, scope_type, scope_id")
    .eq("profile_id", profileId)
    .in("role", Array.from(ALLOWED_ROLES))
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null);

  perf.mark("auth.roles_lookup", roles?.length ?? 0);

  if (rolesError) {
    return {
      data: null,
      error: {
        code: "ROLES_QUERY_FAILED",
        message: "역할 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const roleValues = ((roles ?? []) as CurrentRoleRow[]).map((role) => role.role);
  const hasAllowedRole = roleValues.some((role) => ALLOWED_ROLES.has(role));

  if (!hasAllowedRole) {
    perf.mark("auth.access_denied");
    return {
      data: null,
      error: {
        code: "ACCESS_DENIED",
        message: "코치메이커 권한이 없습니다.",
      },
    };
  }

  const serviceClientResult = getServiceClientResult();

  if (!serviceClientResult.ok) {
    perf.mark("service.service_client_unavailable");
    return { data: null, error: serviceClientResult.error };
  }

  const { serviceClient } = serviceClientResult;
  const hasBroadAccess = roleValues.some((role) => BROAD_ACCESS_ROLES.has(role));
  let accessibleProfileIds: string[] | null = null;
  let activeRelationships: RelationshipRow[] = [];

  if (!hasBroadAccess) {
    const { data: relationships, error: relationshipsError } = await serviceClient
      .from("coaching_relationships")
      .select("id, coach_profile_id, coachee_profile_id, status")
      .eq("coach_profile_id", profileId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (relationshipsError) {
      return {
        data: null,
        error: {
          code: "RELATIONSHIPS_QUERY_FAILED",
          message: "코칭 관계를 조회하는 중 오류가 발생했습니다.",
        },
      };
    }

    activeRelationships = (relationships ?? []) as RelationshipRow[];
    perf.mark("data.relationships_query", activeRelationships.length);
    accessibleProfileIds = [
      ...new Set(
        activeRelationships.map(
          (relationship) => relationship.coachee_profile_id,
        ),
      ),
    ];

    if (accessibleProfileIds.length === 0) {
      const averageRow = emptyAverageRow();
      const pagination = buildPaginationMeta({
        ...requestedPagination,
        totalRows: 0,
      });
      perf.mark("build.complete", 0);
      return {
        data: {
          rows: [],
          printRows: [],
          printRelationshipRows: [],
          relationshipRows: [],
          averageRow,
          overview: buildProgressOverview([], selectedYear, effectiveTimezone),
          pagination,
          upToCurrentRate: 0,
          year: selectedYear,
          timezone: effectiveTimezone,
          scopeMode: "direct_coaching_relationships",
        },
        error: null,
      };
    }
  } else {
    const scopeRoles = (roles ?? []) as ScopedRoleRow[];
    const hasFullRelationshipAccess = roleValues.includes("super_admin");

    let relationshipQuery = serviceClient
      .from("coaching_relationships")
      .select("id, coach_profile_id, coachee_profile_id, status")
      .eq("status", "active")
      .is("deleted_at", null);

    if (!hasFullRelationshipAccess) {
      const scopedProfileIds = await resolveScopedProfileIds(serviceClient, scopeRoles);

      if (scopedProfileIds !== null) {
        const orParts: string[] = [];

        for (const role of scopeRoles) {
          if (
            role.scope_id &&
            role.scope_type !== "global" &&
            role.scope_type !== "coach"
          ) {
            orParts.push(
              `and(scope_type.eq.${role.scope_type},scope_id.eq.${role.scope_id})`,
            );
          }
        }

        if (scopedProfileIds.length > 0) {
          const list = `(${scopedProfileIds.join(",")})`;
          orParts.push(`coach_profile_id.in.${list}`);
          orParts.push(`coachee_profile_id.in.${list}`);
        }

        relationshipQuery = relationshipQuery.or(
          orParts.length > 0
            ? orParts.join(",")
            : "id.eq.00000000-0000-0000-0000-000000000000",
        );
      }
    }

    const { data: relationships, error: relationshipsError } = await relationshipQuery;

    if (relationshipsError) {
      return {
        data: null,
        error: {
          code: "RELATIONSHIPS_QUERY_FAILED",
          message: "코칭 관계를 조회하는 중 오류가 발생했습니다.",
        },
      };
    }

    activeRelationships = (relationships ?? []) as RelationshipRow[];
    perf.mark("data.relationships_query", activeRelationships.length);
  }

  const dbPrefilters = await buildDbPrefilters(serviceClient, filters);
  perf.mark("prefilter.profile_ids");
  const teamNamePattern = buildIlikePattern(filters.teamName);
  const roleLabelPattern = buildIlikePattern(filters.roleLabel);
  const regionNamePattern = buildPostgrestOrIlikePattern(filters.regionName);
  const generationLabelPattern = buildPostgrestOrIlikePattern(filters.generationLabel);
  const searchPattern = buildPostgrestOrIlikePattern(filters.search);

  const plansFilterOptions = {
    accessibleProfileIds,
    dbPrefilters,
    teamNamePattern,
    roleLabelPattern,
    regionNamePattern,
    generationLabelPattern,
    searchPattern,
  };

  let planRows: PlanRow[] = [];
  let overviewPlanRows: PlanRow[] = [];
  let paginatedTotalRows: number | null = null;

  if (requestedPagination.isPaginated) {
    const pageFrom = (requestedPagination.page - 1) * requestedPagination.pageSize;
    const pageTo = pageFrom + requestedPagination.pageSize - 1;
    const plansSelectQuery = () =>
      applyMoksilgiPlansFiltersToQuery(
        serviceClient
          .from("moksilgi_plans")
          .select(
            "id, profile_id, author_name, role_label, generation_label, region_name, team_name, updated_at",
          )
          .is("deleted_at", null)
          .order("updated_at", { ascending: false }),
        plansFilterOptions,
      );

    const [{ count, error: countError }, plansPageResult, allPlansResult] =
      await Promise.all([
        applyMoksilgiPlansFiltersToQuery(
          serviceClient
            .from("moksilgi_plans")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null),
          plansFilterOptions,
        ),
        plansSelectQuery().range(pageFrom, pageTo),
        plansSelectQuery(),
      ]);

    const { data: plans, error: plansError } = plansPageResult;
    const { data: allPlans, error: allPlansError } = allPlansResult;

    if (countError || plansError || allPlansError) {
      return {
        data: null,
        error: {
          code: "MOKSILGI_QUERY_FAILED",
          message: "목실기 정보를 조회하는 중 오류가 발생했습니다.",
        },
      };
    }

    planRows = (plans ?? []) as PlanRow[];
    overviewPlanRows = (allPlans ?? []) as PlanRow[];
    paginatedTotalRows = count ?? 0;
    perf.mark("data.plans_query", planRows.length);
    perf.mark("data.overview_plans_query", overviewPlanRows.length);
  } else {
    const { data: plans, error: plansError } = await applyMoksilgiPlansFiltersToQuery(
      serviceClient
        .from("moksilgi_plans")
        .select(
          "id, profile_id, author_name, role_label, generation_label, region_name, team_name, updated_at",
        )
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      plansFilterOptions,
    );
    perf.mark("data.plans_query", plans?.length ?? 0);

    if (plansError) {
      return {
        data: null,
        error: {
          code: "MOKSILGI_QUERY_FAILED",
          message: "목실기 정보를 조회하는 중 오류가 발생했습니다.",
        },
      };
    }

    planRows = (plans ?? []) as PlanRow[];
    overviewPlanRows = planRows;
  }

  const summaryPlanIds = overviewPlanRows.map((plan) => plan.id);
  const profileIds = [
    ...new Set([
      ...overviewPlanRows.map((plan) => plan.profile_id),
      ...activeRelationships.flatMap((relationship) => [
        relationship.coach_profile_id,
        relationship.coachee_profile_id,
      ]),
    ]),
  ];
  const [profilesResult, summariesResult] = await Promise.all([
    profileIds.length > 0
      ? serviceClient
          .from("profiles")
          .select(
            "id, display_name, full_name, email, country_id, region_id, organization_id, church_id, group_id, ministry_position, generation_number, primary_role",
          )
          .in("id", profileIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    summaryPlanIds.length > 0
      ? serviceClient
          .from("moksilgi_monthly_summaries")
          .select("plan_id, month, average_rate")
          .in("plan_id", summaryPlanIds)
          .eq("year", selectedYear)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  perf.mark(
    "data.profiles_summaries_query",
    (profilesResult.data?.length ?? 0) + (summariesResult.data?.length ?? 0),
  );

  if (profilesResult.error) {
    return {
      data: null,
      error: {
        code: "PROFILES_QUERY_FAILED",
        message: "프로필 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  if (summariesResult.error) {
    return {
      data: null,
      error: {
        code: "SUMMARY_QUERY_FAILED",
        message: "목실기 요약을 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const profileRows = (profilesResult.data ?? []) as ProfileRow[];
  const countryIds = uniqueSortedNonNull(profileRows.map((profile) => profile.country_id));
  const regionIds = uniqueSortedNonNull(profileRows.map((profile) => profile.region_id));
  const organizationIds = uniqueSortedNonNull(
    profileRows.map((profile) => profile.organization_id),
  );
  const churchIds = uniqueSortedNonNull(profileRows.map((profile) => profile.church_id));
  const groupIds = uniqueSortedNonNull(profileRows.map((profile) => profile.group_id));
  const [
    countriesResult,
    regionsResult,
    organizationsResult,
    churchesResult,
    groupsResult,
  ] = await Promise.all([
    getCachedLookupRows<CountryRow>("countries", countryIds, async (lookupIds) => {
      const { data, error } = await serviceClient
        .from("countries")
        .select("id, name, code")
        .in("id", lookupIds);

      return { data: data as CountryRow[] | null, error };
    }),
    getCachedLookupRows<RegionRow>("regions", regionIds, async (lookupIds) => {
      const { data, error } = await serviceClient
        .from("regions")
        .select("id, name")
        .in("id", lookupIds);

      return { data: data as RegionRow[] | null, error };
    }),
    getCachedLookupRows<OrganizationRow>("organizations", organizationIds, async (lookupIds) => {
      const { data, error } = await serviceClient
        .from("organizations")
        .select("id, name")
        .in("id", lookupIds)
        .is("deleted_at", null);

      return { data: data as OrganizationRow[] | null, error };
    }),
    getCachedLookupRows<ChurchRow>("churches", churchIds, async (lookupIds) => {
      const { data, error } = await serviceClient
        .from("churches")
        .select("id, name")
        .in("id", lookupIds);

      return { data: data as ChurchRow[] | null, error };
    }),
    getCachedLookupRows<GroupRow>("groups", groupIds, async (lookupIds) => {
      const { data, error } = await serviceClient
        .from("groups")
        .select("id, name")
        .in("id", lookupIds)
        .is("deleted_at", null);

      return { data: data as GroupRow[] | null, error };
    }),
  ]);
  perf.mark(
    "lookup.affiliations_query",
    (countriesResult.data?.length ?? 0) +
      (regionsResult.data?.length ?? 0) +
      (organizationsResult.data?.length ?? 0) +
      (churchesResult.data?.length ?? 0) +
      (groupsResult.data?.length ?? 0),
  );

  const lookupError =
    countriesResult.error ??
    regionsResult.error ??
    organizationsResult.error ??
    churchesResult.error ??
    groupsResult.error;

  if (lookupError) {
    return {
      data: null,
      error: {
        code: "PROFILES_QUERY_FAILED",
        message: "소속 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const profileById = mapById(profileRows);
  const lookups = {
    churches: mapById((churchesResult.data ?? []) as ChurchRow[]),
    countries: mapById((countriesResult.data ?? []) as CountryRow[]),
    groups: mapById((groupsResult.data ?? []) as GroupRow[]),
    organizations: mapById((organizationsResult.data ?? []) as OrganizationRow[]),
    regions: mapById((regionsResult.data ?? []) as RegionRow[]),
  };
  const summariesByPlanId = new Map<string, SummaryRow[]>();

  for (const summary of (summariesResult.data ?? []) as SummaryRow[]) {
    const current = summariesByPlanId.get(summary.plan_id) ?? [];
    current.push(summary);
    summariesByPlanId.set(summary.plan_id, current);
  }

  const overviewFilteredRows = buildProgressRows({
    filters,
    lookups,
    planRows: overviewPlanRows,
    profilesById: profileById,
    selectedYear,
    summariesByPlanId,
  });
  const tableFilteredRows = requestedPagination.isPaginated
    ? buildProgressRows({
        filters,
        lookups,
        planRows,
        profilesById: profileById,
        selectedYear,
        summariesByPlanId,
      })
    : overviewFilteredRows;
  const printRows = buildPrintRows(overviewFilteredRows);
  const summary = buildProgressSummary(printRows, selectedYear, effectiveTimezone);
  const overview = buildProgressOverview(printRows, selectedYear, effectiveTimezone);
  const pagination = buildPaginationMeta({
    ...requestedPagination,
    totalRows: paginatedTotalRows ?? printRows.length,
  });
  const tableRows = requestedPagination.isPaginated
    ? tableFilteredRows.map((row, index) => ({ ...row, index: index + 1 }))
    : buildTableRows(printRows, pagination);
  const rowsByProfileId = new Map(tableRows.map((row) => [row.profile_id, row]));
  const printRowsByProfileId = new Map(printRows.map((row) => [row.profile_id, row]));
  const relationshipRows = buildRelationshipProgressRows({
    profilesById: profileById,
    relationships: activeRelationships,
    rowsByProfileId,
    summariesByPlanId,
  });
  const printRelationshipRows = buildRelationshipProgressRows({
    profilesById: profileById,
    relationships: activeRelationships,
    rowsByProfileId: printRowsByProfileId,
    summariesByPlanId,
  });

  perf.mark("build.rows", overviewFilteredRows.length);
  perf.mark("build.table_rows", tableRows.length);
  perf.mark("build.complete", tableRows.length);

  return {
    data: {
      rows: tableRows,
      printRows,
      printRelationshipRows,
      relationshipRows,
      averageRow: summary.averageRow,
      overview,
      pagination,
      upToCurrentRate: summary.upToCurrentRate,
      year: selectedYear,
      timezone: effectiveTimezone,
      scopeMode: hasBroadAccess ? "all" : "direct_coaching_relationships",
    },
    error: null,
  };
}
