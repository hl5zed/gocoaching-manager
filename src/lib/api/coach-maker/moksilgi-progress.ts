import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  DEFAULT_TIMEZONE,
  getCurrentMonthInTimezone,
  getCurrentYearInTimezone,
  getEffectiveTimezone,
} from "@/lib/timezone";
import type { Tables, UserRole } from "@/types/database";
import type { ActiveRoleSlim } from "@/types/profile";

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

type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;
type ProfileIdRow = { id: string };
type CurrentProfileRow = { id: string; timezone: string | null };
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

export type CoachMakerMoksilgiProgressFilters = {
  year: number;
  teamName?: string | null;
  regionName?: string | null;
  roleLabel?: string | null;
  generationLabel?: string | null;
  search?: string | null;
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
        relationshipRows: CoachMakerMoksilgiRelationshipProgressRow[];
        averageRow: CoachMakerMoksilgiProgressAverageRow;
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

function mapById<TRow extends { id: string }>(rows: TRow[]) {
  return new Map(rows.map((row) => [row.id, row]));
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

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

  for (let month = 1; month <= 12; month += 1) {
    const key = monthKey(month);
    averageRow[key] = average(rows.map((row) => safeNumber(row[key])));
  }

  averageRow.cumulative_rate = average(
    rows.map((row) => safeNumber(row.cumulative_rate)),
  );

  return averageRow;
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
  const selectedYear = validateYear(filters.year)
    ? filters.year
    : getCurrentYearInTimezone(DEFAULT_TIMEZONE);
  const session = await getSession();

  if (!session.user) {
    return {
      data: null,
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, timezone")
    .eq("auth_user_id", session.user.id)
    .is("deleted_at", null)
    .eq("status", "active")
    .maybeSingle();

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
    .select("id, role, scope_type, scope_id, granted_at, expires_at")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (rolesError) {
    return {
      data: null,
      error: {
        code: "ROLES_QUERY_FAILED",
        message: "역할 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const activeRoles = (roles ?? []) as ActiveRoleSlim[];
  const roleValues = activeRoles.map((role) => role.role);
  const hasAllowedRole = roleValues.some((role) => ALLOWED_ROLES.has(role));

  if (!hasAllowedRole) {
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
    accessibleProfileIds = [
      ...new Set(
        activeRelationships.map(
          (relationship) => relationship.coachee_profile_id,
        ),
      ),
    ];

    if (accessibleProfileIds.length === 0) {
      const averageRow = emptyAverageRow();
      return {
        data: {
          rows: [],
          relationshipRows: [],
          averageRow,
          upToCurrentRate: 0,
          year: selectedYear,
          timezone: effectiveTimezone,
          scopeMode: "direct_coaching_relationships",
        },
        error: null,
      };
    }
  } else {
    const { data: relationships, error: relationshipsError } = await serviceClient
      .from("coaching_relationships")
      .select("id, coach_profile_id, coachee_profile_id, status")
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
  }

  const dbPrefilters = await buildDbPrefilters(serviceClient, filters);
  const teamNamePattern = buildIlikePattern(filters.teamName);
  const roleLabelPattern = buildIlikePattern(filters.roleLabel);
  const regionNamePattern = buildPostgrestOrIlikePattern(filters.regionName);
  const generationLabelPattern = buildPostgrestOrIlikePattern(filters.generationLabel);
  const searchPattern = buildPostgrestOrIlikePattern(filters.search);

  let plansQuery = serviceClient
    .from("moksilgi_plans")
    .select(
      "id, profile_id, author_name, role_label, generation_label, region_name, team_name, updated_at",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (accessibleProfileIds) {
    plansQuery = plansQuery.in("profile_id", accessibleProfileIds);
  }

  if (teamNamePattern) {
    plansQuery = plansQuery.ilike("team_name", teamNamePattern);
  }

  if (roleLabelPattern) {
    plansQuery = plansQuery.ilike("role_label", roleLabelPattern);
  }

  if (regionNamePattern && dbPrefilters.regionProfileIds !== null) {
    plansQuery = plansQuery.or(
      columnOrProfileCondition(
        "region_name",
        regionNamePattern,
        dbPrefilters.regionProfileIds,
      ),
    );
  }

  if (generationLabelPattern && dbPrefilters.generationProfileIds !== null) {
    plansQuery = plansQuery.or(
      columnOrProfileCondition(
        "generation_label",
        generationLabelPattern,
        dbPrefilters.generationProfileIds,
      ),
    );
  }

  if (searchPattern && dbPrefilters.searchProfileIds !== null) {
    plansQuery = plansQuery.or(
      columnOrProfileCondition(
        "author_name",
        searchPattern,
        dbPrefilters.searchProfileIds,
      ),
    );
  }

  const { data: plans, error: plansError } = await plansQuery;

  if (plansError) {
    return {
      data: null,
      error: {
        code: "MOKSILGI_QUERY_FAILED",
        message: "목실기 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const planRows = (plans ?? []) as PlanRow[];

  const planIds = planRows.map((plan) => plan.id);
  const profileIds = [
    ...new Set([
      ...planRows.map((plan) => plan.profile_id),
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
    planIds.length > 0
      ? serviceClient
          .from("moksilgi_monthly_summaries")
          .select("plan_id, month, average_rate")
          .in("plan_id", planIds)
          .eq("year", selectedYear)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

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
  const countryIds = uniqueNonNull(profileRows.map((profile) => profile.country_id));
  const regionIds = uniqueNonNull(profileRows.map((profile) => profile.region_id));
  const organizationIds = uniqueNonNull(
    profileRows.map((profile) => profile.organization_id),
  );
  const churchIds = uniqueNonNull(profileRows.map((profile) => profile.church_id));
  const groupIds = uniqueNonNull(profileRows.map((profile) => profile.group_id));
  const [
    countriesResult,
    regionsResult,
    organizationsResult,
    churchesResult,
    groupsResult,
  ] = await Promise.all([
    countryIds.length > 0
      ? serviceClient
          .from("countries")
          .select("id, name, code")
          .in("id", countryIds)
      : Promise.resolve({ data: [], error: null }),
    regionIds.length > 0
      ? serviceClient.from("regions").select("id, name").in("id", regionIds)
      : Promise.resolve({ data: [], error: null }),
    organizationIds.length > 0
      ? serviceClient
          .from("organizations")
          .select("id, name")
          .in("id", organizationIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    churchIds.length > 0
      ? serviceClient.from("churches").select("id, name").in("id", churchIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length > 0
      ? serviceClient
          .from("groups")
          .select("id, name")
          .in("id", groupIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

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

  const rows = applyFilters(
    planRows.map((plan, index) =>
      buildRow(
        plan,
        profileById.get(plan.profile_id),
        lookups,
        summariesByPlanId.get(plan.id) ?? [],
        index + 1,
      ),
    ),
    { ...filters, year: selectedYear },
  );
  const averageRow = calculateAverageRow(rows);
  const rowsByProfileId = new Map(rows.map((row) => [row.profile_id, row]));
  const relationshipRows = buildRelationshipProgressRows({
    profilesById: profileById,
    relationships: activeRelationships,
    rowsByProfileId,
    summariesByPlanId,
  });

  return {
    data: {
      rows,
      relationshipRows,
      averageRow,
      upToCurrentRate: calculateUpToCurrentRate(
        averageRow,
        selectedYear,
        effectiveTimezone,
      ),
      year: selectedYear,
      timezone: effectiveTimezone,
      scopeMode: hasBroadAccess ? "all" : "direct_coaching_relationships",
    },
    error: null,
  };
}
