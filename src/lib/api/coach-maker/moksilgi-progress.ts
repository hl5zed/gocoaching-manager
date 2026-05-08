import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
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

type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;
type ProfileIdRow = { id: string };
type RelationshipRow = { coachee_profile_id: string };
type ProfileRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "full_name" | "email"
>;
type PlanRow = Pick<
  Tables<"moksilgi_plans">,
  | "id"
  | "profile_id"
  | "author_name"
  | "role_label"
  | "generation_label"
  | "region_name"
  | "team_name"
  | "deleted_at"
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
  role_label: string | null;
  generation_label: string | null;
  region_name: string | null;
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
        averageRow: CoachMakerMoksilgiProgressAverageRow;
        upToCurrentRate: number;
        year: number;
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

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function getCurrentMonthCutoff(year: number) {
  const today = new Date();

  if (year < today.getFullYear()) return 12;
  if (year > today.getFullYear()) return 0;
  return today.getMonth() + 1;
}

function calculateUpToCurrentRate(
  averageRow: CoachMakerMoksilgiProgressAverageRow,
  year: number,
) {
  const cutoff = getCurrentMonthCutoff(year);
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
  summaries: SummaryRow[],
  index: number,
) {
  const monthRates = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return safeNumber(summaries.find((summary) => summary.month === month)?.average_rate);
  });

  return {
    index,
    profile_id: plan.profile_id,
    plan_id: plan.id,
    display_name: profile?.display_name ?? null,
    full_name: profile?.full_name ?? null,
    email: profile?.email ?? null,
    author_name: plan.author_name,
    role_label: plan.role_label,
    generation_label: plan.generation_label,
    region_name: plan.region_name,
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

export async function getCoachMakerMoksilgiProgress(
  filters: CoachMakerMoksilgiProgressFilters,
): Promise<GetCoachMakerMoksilgiProgressResult> {
  const selectedYear = validateYear(filters.year) ? filters.year : new Date().getFullYear();
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
    .select("id")
    .eq("auth_user_id", session.user.id)
    .is("deleted_at", null)
    .neq("status", "anonymized")
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

  const profileId = (profile as ProfileIdRow).id;
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

  if (!hasBroadAccess) {
    const { data: relationships, error: relationshipsError } = await serviceClient
      .from("coaching_relationships")
      .select("coachee_profile_id")
      .eq("coach_profile_id", profileId)
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

    accessibleProfileIds = [
      ...new Set(
        ((relationships ?? []) as RelationshipRow[]).map(
          (relationship) => relationship.coachee_profile_id,
        ),
      ),
    ];

    if (accessibleProfileIds.length === 0) {
      const averageRow = emptyAverageRow();
      return {
        data: {
          rows: [],
          averageRow,
          upToCurrentRate: 0,
          year: selectedYear,
          scopeMode: "direct_coaching_relationships",
        },
        error: null,
      };
    }
  }

  let plansQuery = serviceClient
    .from("moksilgi_plans")
    .select(
      "id, profile_id, author_name, role_label, generation_label, region_name, team_name, deleted_at, updated_at",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (accessibleProfileIds) {
    plansQuery = plansQuery.in("profile_id", accessibleProfileIds);
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

  if (planRows.length === 0) {
    const averageRow = emptyAverageRow();
    return {
      data: {
        rows: [],
        averageRow,
        upToCurrentRate: 0,
        year: selectedYear,
        scopeMode: hasBroadAccess ? "all" : "direct_coaching_relationships",
      },
      error: null,
    };
  }

  const planIds = planRows.map((plan) => plan.id);
  const profileIds = [...new Set(planRows.map((plan) => plan.profile_id))];
  const [profilesResult, summariesResult] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("id, display_name, full_name, email")
      .in("id", profileIds)
      .is("deleted_at", null),
    serviceClient
      .from("moksilgi_monthly_summaries")
      .select("plan_id, month, average_rate")
      .in("plan_id", planIds)
      .eq("year", selectedYear)
      .is("deleted_at", null),
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

  const profileById = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );
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
        summariesByPlanId.get(plan.id) ?? [],
        index + 1,
      ),
    ),
    { ...filters, year: selectedYear },
  );
  const averageRow = calculateAverageRow(rows);

  return {
    data: {
      rows,
      averageRow,
      upToCurrentRate: calculateUpToCurrentRate(averageRow, selectedYear),
      year: selectedYear,
      scopeMode: hasBroadAccess ? "all" : "direct_coaching_relationships",
    },
    error: null,
  };
}
