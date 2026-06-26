import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  DEFAULT_TIMEZONE,
  getCurrentMonthInTimezone,
  getCurrentWeekRangeInTimezone,
  getCurrentYearInTimezone,
  getEffectiveTimezone,
} from "@/lib/timezone";
import type {
  CoachingRelationshipStatus,
  ProfileRow,
  RelationshipType,
  ScopeType,
  Tables,
  UserRole,
} from "@/types/database";

type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;

type CoachMakerRoleRow = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
};

type CurrentProfileRow = Pick<
  ProfileRow,
  "id" | "display_name" | "full_name" | "email" | "timezone"
>;

type ScopedProfileRow = Pick<
  ProfileRow,
  | "id"
  | "display_name"
  | "full_name"
  | "email"
  | "country_id"
  | "region_id"
  | "organization_id"
  | "church_id"
  | "group_id"
  | "cohort_id"
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
  created_at: string;
};

type WeeklyLogStatsRow = {
  id: string;
  relationship_id: string;
  coachee_profile_id: string;
  status: string;
  submitted_at: string | null;
};

type SharedDailyStatsRow = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  shared_with_coach: boolean;
  visibility: string;
};

type SharedMonthlyStatsRow = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  shared_with_coach: boolean;
  visibility: string;
};

type FeedbackStatsRow = {
  weekly_log_id: string;
  relationship_id: string;
};

type MoksilgiDashboardPlanRow = Pick<
  Tables<"moksilgi_plans">,
  "id" | "profile_id" | "author_name" | "region_name" | "team_name"
>;
type MoksilgiDashboardProfileRow = Pick<
  ProfileRow,
  "id" | "display_name" | "full_name" | "email" | "region_id"
>;
type MoksilgiDashboardRegionRow = Pick<Tables<"regions">, "id" | "name">;
type MoksilgiDashboardSummaryRow = Pick<
  Tables<"moksilgi_monthly_summaries">,
  "plan_id" | "month" | "average_rate"
>;

export type CoachMakerCoachStatsRow = {
  coachId: string;
  coachName: string;
  coachEmail: string | null;
  assignedCoacheeCount: number;
  weeklySubmittedThisWeekCount: number;
  weeklyMissingThisWeekCount: number;
  sharedDailyRecordCount: number;
  sharedMonthlyReflectionCount: number;
  feedbackCount: number;
  feedbackPendingCount: number;
};

export type CoachMakerCoachStatsSummary = {
  coachCount: number;
  assignedCoacheeCount: number;
  weeklySubmittedThisWeekCount: number;
  weeklyMissingThisWeekCount: number;
  sharedDailyRecordCount: number;
  sharedMonthlyReflectionCount: number;
  feedbackCount: number;
  feedbackPendingCount: number;
};

export type CoachMakerCoachStatsData = {
  profile: CurrentProfileRow | null;
  roles: CoachMakerRoleRow[];
  weekRange: {
    start: string;
    end: string;
  };
  summary: CoachMakerCoachStatsSummary;
  coaches: CoachMakerCoachStatsRow[];
  scopeLabel: string;
};

export type CoachMakerMoksilgiDashboardAttentionRow = {
  author_name: string | null;
  display_name: string | null;
  email: string | null;
  full_name: string | null;
  plan_id: string;
  profile_id: string;
  region_name: string | null;
  team_name: string | null;
};

export type CoachMakerMoksilgiDashboardSummaryData = {
  attentionCount: number;
  attentionRows: Array<{
    rate: number;
    row: CoachMakerMoksilgiDashboardAttentionRow;
  }>;
  missingCount: number;
  totalCount: number;
  upToCurrentRate: number;
  year: number;
};

type CoachMakerCoachStatsError = {
  code:
    | "UNAUTHORIZED"
    | "PROFILE_NOT_FOUND"
    | "PROFILE_QUERY_FAILED"
    | "ROLES_QUERY_FAILED"
    | "ACCESS_DENIED"
    | "COACH_STATS_FETCH_FAILED";
  message: string;
};

export type GetCoachMakerCoachStatsResult =
  | {
      data: CoachMakerCoachStatsData;
      error: null;
    }
  | {
      data: null;
      error: CoachMakerCoachStatsError;
};

export type GetCoachMakerMoksilgiDashboardSummaryResult =
  | {
      data: CoachMakerMoksilgiDashboardSummaryData;
      error: null;
    }
  | {
      data: null;
      error: CoachMakerCoachStatsError;
    };

const COACH_MAKER_ACCESS_ROLES: UserRole[] = ["coach_maker", "super_admin"];
const EMPTY_SUMMARY: CoachMakerCoachStatsSummary = {
  coachCount: 0,
  assignedCoacheeCount: 0,
  weeklySubmittedThisWeekCount: 0,
  weeklyMissingThisWeekCount: 0,
  sharedDailyRecordCount: 0,
  sharedMonthlyReflectionCount: 0,
  feedbackCount: 0,
  feedbackPendingCount: 0,
};

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

function getCurrentWeekRange(timezone: string) {
  const weekRange = getCurrentWeekRangeInTimezone(timezone);
  return {
    end: weekRange.weekEnd,
    start: weekRange.weekStart,
  };
}

function displayName(profile: ScopedProfileRow | null | undefined) {
  return (
    profile?.display_name?.trim() ||
    profile?.full_name?.trim() ||
    profile?.email?.trim() ||
    "이름 없음"
  );
}

function isSubmittedWeeklyLog(log: WeeklyLogStatsRow) {
  return log.status === "submitted" || Boolean(log.submitted_at);
}

function getProfileScopeValue(profile: ScopedProfileRow | undefined, scopeType: ScopeType) {
  switch (scopeType) {
    case "country":
      return profile?.country_id ?? null;
    case "region":
      return profile?.region_id ?? null;
    case "organization":
      return profile?.organization_id ?? null;
    case "church":
      return profile?.church_id ?? null;
    case "group":
      return profile?.group_id ?? null;
    case "cohort":
      return profile?.cohort_id ?? null;
    default:
      return null;
  }
}

function relationshipMatchesScope(
  relationship: RelationshipRow,
  coach: ScopedProfileRow | undefined,
  coachee: ScopedProfileRow | undefined,
  role: CoachMakerRoleRow,
) {
  if (role.scope_type === "global") {
    return true;
  }

  if (!role.scope_id) {
    return false;
  }

  if (role.scope_type === "coach") {
    return relationship.coach_profile_id === role.scope_id;
  }

  if (relationship.scope_type === role.scope_type && relationship.scope_id === role.scope_id) {
    return true;
  }

  return (
    getProfileScopeValue(coach, role.scope_type) === role.scope_id ||
    getProfileScopeValue(coachee, role.scope_type) === role.scope_id
  );
}

function buildScopeLabel(roles: CoachMakerRoleRow[]) {
  if (roles.some((role) => role.role === "super_admin")) {
    return "전체 범위";
  }

  if (roles.some((role) => role.scope_type === "global")) {
    return "전체 범위";
  }

  if (roles.length === 0) {
    return "권한 없음";
  }

  return roles
    .map((role) =>
      role.scope_id
        ? `${role.scope_type}:${role.scope_id.slice(0, 8)}`
        : `${role.scope_type}:미지정`,
    )
    .join(", ");
}

function emptyData(
  profile: CurrentProfileRow | null,
  roles: CoachMakerRoleRow[],
  weekRange: { start: string; end: string },
): CoachMakerCoachStatsData {
  return {
    profile,
    roles,
    weekRange,
    summary: EMPTY_SUMMARY,
    coaches: [],
    scopeLabel: buildScopeLabel(roles),
  };
}

function addToCountMap(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function hasCoachMakerFullAccess(roles: CoachMakerRoleRow[]) {
  return roles.some((role) => role.role === "super_admin");
}

const MAX_SCOPE_PREFILTER_PROFILE_IDS = 200;

/**
 * 역할 스코프(country/region/org/church/group/cohort)에 속한 프로필 id를 DB에서 미리 해석한다.
 * 관계를 coach/coachee 프로필 스코프로도 매칭하므로 초집합 보장을 위해 필요하다.
 * - 임계치를 넘거나 에러면 null 반환 → 호출부가 기존(전체 fetch) 동작으로 폴백.
 * - 해석할 스코프가 없으면 빈 배열 반환.
 */
async function resolveScopedProfileIds(
  serviceClient: ServiceSupabaseClient,
  roles: CoachMakerRoleRow[],
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
    .limit(MAX_SCOPE_PREFILTER_PROFILE_IDS + 1);

  if (error) {
    return null;
  }

  const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (ids.length > MAX_SCOPE_PREFILTER_PROFILE_IDS) {
    return null;
  }

  return ids;
}

function uniqueSize(values: string[]) {
  return new Set(values).size;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getCurrentMonthCutoff(year: number, timezone: string) {
  const currentYear = getCurrentYearInTimezone(timezone);

  if (year < currentYear) return 12;
  if (year > currentYear) return 0;
  return getCurrentMonthInTimezone(timezone);
}

function mapById<TRow extends { id: string }>(rows: TRow[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function uniqueNonNull(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function getServiceClient():
  Promise<
    | {
        ok: true;
        serviceClient: ServiceSupabaseClient;
      }
    | {
        ok: false;
        error: CoachMakerCoachStatsError;
      }
  > {
  const { client, error } = createSupabaseServiceClient();

  if (!client) {
    logServerError(
      "COACH_MAKER_COACH_STATS_SERVICE_CLIENT_UNAVAILABLE",
      error ?? "Coach maker coach stats service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        code: "COACH_STATS_FETCH_FAILED",
        message: "코치별 현황을 불러오지 못했습니다.",
      },
    };
  }

  return { ok: true, serviceClient: client };
}

export async function getCoachMakerCoachStats(): Promise<GetCoachMakerCoachStatsResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      data: null,
      error: {
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
      },
    };
  }

  const serviceClientResult = await getServiceClient();

  if (!serviceClientResult.ok) {
    return { data: null, error: serviceClientResult.error };
  }

  const { serviceClient } = serviceClientResult;
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = serviceClient
    .from("profiles")
    .select("id, display_name, full_name, email, timezone")
    .is("deleted_at", null)
    .eq("status", "active");

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError) {
    logServerError(
      "COACH_MAKER_COACH_STATS_PROFILE_LOOKUP_FAILED",
      profileError.message ?? "Coach maker profile lookup failed.",
    );
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

  const currentProfile = profile as CurrentProfileRow;
  const effectiveTimezone = getEffectiveTimezone(currentProfile.timezone);
  const weekRange = getCurrentWeekRange(effectiveTimezone);
  const reflectionYear = getCurrentYearInTimezone(effectiveTimezone);
  const reflectionMonth = getCurrentMonthInTimezone(effectiveTimezone);
  const { data: roles, error: rolesError } = await serviceClient
    .from("user_roles")
    .select("role, scope_type, scope_id, status")
    .eq("profile_id", currentProfile.id)
    .in("role", COACH_MAKER_ACCESS_ROLES)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    logServerError(
      "COACH_MAKER_COACH_STATS_ROLES_LOOKUP_FAILED",
      rolesError.message ?? "Coach maker role lookup failed.",
    );
    return {
      data: null,
      error: {
        code: "ROLES_QUERY_FAILED",
        message: "역할 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const coachMakerRoles = (roles ?? []) as CoachMakerRoleRow[];

  if (coachMakerRoles.length === 0) {
    return {
      data: null,
      error: {
        code: "ACCESS_DENIED",
        message: "코치메이커 또는 최고관리자 권한이 필요합니다.",
      },
    };
  }

  const fullAccess =
    hasCoachMakerFullAccess(coachMakerRoles) ||
    coachMakerRoles.some((role) => role.scope_type === "global");

  let relationshipQuery = serviceClient
    .from("coaching_relationships")
    .select(
      "id, coach_profile_id, coachee_profile_id, relationship_type, status, scope_type, scope_id, started_at, created_at",
    )
    .eq("status", "active")
    .is("deleted_at", null);

  if (!fullAccess) {
    const scopedProfileIds = await resolveScopedProfileIds(serviceClient, coachMakerRoles);

    if (scopedProfileIds !== null) {
      const orParts: string[] = [];

      for (const role of coachMakerRoles) {
        if (role.scope_id && role.scope_type !== "global" && role.scope_type !== "coach") {
          orParts.push(`and(scope_type.eq.${role.scope_type},scope_id.eq.${role.scope_id})`);
        }
      }

      for (const role of coachMakerRoles) {
        if (role.scope_type === "coach" && role.scope_id) {
          orParts.push(`coach_profile_id.eq.${role.scope_id}`);
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
    logServerError(
      "COACH_MAKER_COACH_STATS_RELATIONSHIPS_FETCH_FAILED",
      relationshipsError.message ?? "Coach maker relationships fetch failed.",
    );
    return {
      data: null,
      error: {
        code: "COACH_STATS_FETCH_FAILED",
        message: "코치-코치이 관계 현황을 불러오지 못했습니다.",
      },
    };
  }

  const allRelationships = (relationships ?? []) as RelationshipRow[];

  if (allRelationships.length === 0) {
    return {
      data: emptyData(currentProfile, coachMakerRoles, weekRange),
      error: null,
    };
  }

  const profileIds = [
    ...new Set(
      allRelationships.flatMap((relationship) => [
        relationship.coach_profile_id,
        relationship.coachee_profile_id,
      ]),
    ),
  ];

  const { data: profileRows, error: profilesError } = await serviceClient
    .from("profiles")
    .select(
      "id, display_name, full_name, email, country_id, region_id, organization_id, church_id, group_id, cohort_id",
    )
    .in("id", profileIds)
    .is("deleted_at", null);

  if (profilesError) {
    logServerError(
      "COACH_MAKER_COACH_STATS_PROFILES_FETCH_FAILED",
      profilesError.message ?? "Coach maker profiles fetch failed.",
    );
    return {
      data: null,
      error: {
        code: "COACH_STATS_FETCH_FAILED",
        message: "코치/코치이 정보를 불러오지 못했습니다.",
      },
    };
  }

  const profileMap = new Map(
    ((profileRows ?? []) as ScopedProfileRow[]).map((row) => [row.id, row]),
  );
  const scopedRelationships = hasCoachMakerFullAccess(coachMakerRoles)
    ? allRelationships
    : allRelationships.filter((relationship) => {
        const coach = profileMap.get(relationship.coach_profile_id);
        const coachee = profileMap.get(relationship.coachee_profile_id);

        return coachMakerRoles.some((role) =>
          relationshipMatchesScope(relationship, coach, coachee, role),
        );
      });

  if (scopedRelationships.length === 0) {
    return {
      data: emptyData(currentProfile, coachMakerRoles, weekRange),
      error: null,
    };
  }

  const relationshipIds = [...new Set(scopedRelationships.map((row) => row.id))];
  const coachIds = [...new Set(scopedRelationships.map((row) => row.coach_profile_id))];
  const coacheeIds = [
    ...new Set(scopedRelationships.map((row) => row.coachee_profile_id)),
  ];
  const relationshipById = new Map(scopedRelationships.map((row) => [row.id, row]));
  const relationshipsByCoachee = new Map<string, RelationshipRow[]>();

  scopedRelationships.forEach((relationship) => {
    const current = relationshipsByCoachee.get(relationship.coachee_profile_id) ?? [];
    current.push(relationship);
    relationshipsByCoachee.set(relationship.coachee_profile_id, current);
  });

  const [weeklyLogsResult, dailyRecordsResult, monthlyReflectionsResult] =
    await Promise.all([
      serviceClient
        .from("weekly_logs")
        .select("id, relationship_id, coachee_profile_id, status, submitted_at")
        .in("relationship_id", relationshipIds)
        .lte("week_start", weekRange.end)
        .gte("week_end", weekRange.start)
        .is("deleted_at", null),
      serviceClient
        .from("daily_records")
        .select("id, profile_id, relationship_id, shared_with_coach, visibility")
        .in("profile_id", coacheeIds)
        .eq("shared_with_coach", true)
        .eq("visibility", "coach")
        .gte("record_date", weekRange.start)
        .lte("record_date", weekRange.end)
        .is("deleted_at", null),
      serviceClient
        .from("monthly_reflections")
        .select("id, profile_id, relationship_id, shared_with_coach, visibility")
        .in("profile_id", coacheeIds)
        .eq("shared_with_coach", true)
        .eq("visibility", "coach")
        .eq("year", reflectionYear)
        .eq("month", reflectionMonth)
        .is("deleted_at", null),
    ]);

  if (weeklyLogsResult.error) {
    logServerError(
      "COACH_MAKER_COACH_STATS_WEEKLY_LOGS_FETCH_FAILED",
      weeklyLogsResult.error.message ?? "Coach maker weekly logs fetch failed.",
    );
    return {
      data: null,
      error: {
        code: "COACH_STATS_FETCH_FAILED",
        message: "주간 기록 현황을 불러오지 못했습니다.",
      },
    };
  }

  if (dailyRecordsResult.error) {
    logServerError(
      "COACH_MAKER_COACH_STATS_DAILY_RECORDS_FETCH_FAILED",
      dailyRecordsResult.error.message ?? "Coach maker daily records fetch failed.",
    );
    return {
      data: null,
      error: {
        code: "COACH_STATS_FETCH_FAILED",
        message: "공유된 하루 기록 현황을 불러오지 못했습니다.",
      },
    };
  }

  if (monthlyReflectionsResult.error) {
    logServerError(
      "COACH_MAKER_COACH_STATS_MONTHLY_REFLECTIONS_FETCH_FAILED",
      monthlyReflectionsResult.error.message ??
        "Coach maker monthly reflections fetch failed.",
    );
    return {
      data: null,
      error: {
        code: "COACH_STATS_FETCH_FAILED",
        message: "공유된 월간 회고 현황을 불러오지 못했습니다.",
      },
    };
  }

  const weeklyLogs = (weeklyLogsResult.data ?? []) as WeeklyLogStatsRow[];
  const sharedDailyRecords = (dailyRecordsResult.data ?? []) as SharedDailyStatsRow[];
  const sharedMonthlyReflections =
    (monthlyReflectionsResult.data ?? []) as SharedMonthlyStatsRow[];
  const submittedThisWeekLogs = weeklyLogs.filter(isSubmittedWeeklyLog);
  const submittedWeeklyLogIds = submittedThisWeekLogs.map((log) => log.id);
  const { data: feedbackRows, error: feedbackError } = submittedWeeklyLogIds.length
    ? await serviceClient
        .from("coach_feedback")
        .select("weekly_log_id, relationship_id")
        .in("weekly_log_id", submittedWeeklyLogIds)
        .is("deleted_at", null)
    : { data: [], error: null };

  if (feedbackError) {
    logServerError(
      "COACH_MAKER_COACH_STATS_FEEDBACK_FETCH_FAILED",
      feedbackError.message ?? "Coach maker feedback fetch failed.",
    );
  }

  const feedbacks = (feedbackRows ?? []) as FeedbackStatsRow[];
  const feedbackLogIds = new Set(feedbacks.map((feedback) => feedback.weekly_log_id));
  const feedbackPendingLogs = submittedThisWeekLogs.filter(
    (log) => !feedbackLogIds.has(log.id),
  );
  const assignedCoacheesByCoach = new Map<string, Set<string>>();
  const weeklySubmittedThisWeekByCoach = new Map<string, Set<string>>();
  const sharedDailyByCoach = new Map<string, number>();
  const sharedMonthlyByCoach = new Map<string, number>();
  const feedbackByCoach = new Map<string, number>();
  const feedbackPendingByCoach = new Map<string, number>();

  scopedRelationships.forEach((relationship) => {
    const current = assignedCoacheesByCoach.get(relationship.coach_profile_id) ?? new Set();
    current.add(relationship.coachee_profile_id);
    assignedCoacheesByCoach.set(relationship.coach_profile_id, current);
  });

  submittedThisWeekLogs.forEach((log) => {
    const relationship = relationshipById.get(log.relationship_id);
    if (!relationship) return;

    const current = weeklySubmittedThisWeekByCoach.get(relationship.coach_profile_id) ?? new Set();
    current.add(log.coachee_profile_id);
    weeklySubmittedThisWeekByCoach.set(relationship.coach_profile_id, current);
  });

  sharedDailyRecords.forEach((record) => {
    if (record.relationship_id) {
      const relationship = relationshipById.get(record.relationship_id);
      if (relationship) {
        addToCountMap(sharedDailyByCoach, relationship.coach_profile_id);
      }
      return;
    }

    const relationshipsForCoachee = relationshipsByCoachee.get(record.profile_id) ?? [];
    relationshipsForCoachee.forEach((relationship) => {
      addToCountMap(sharedDailyByCoach, relationship.coach_profile_id);
    });
  });

  sharedMonthlyReflections.forEach((reflection) => {
    if (reflection.relationship_id) {
      const relationship = relationshipById.get(reflection.relationship_id);
      if (relationship) {
        addToCountMap(sharedMonthlyByCoach, relationship.coach_profile_id);
      }
      return;
    }

    const relationshipsForCoachee = relationshipsByCoachee.get(reflection.profile_id) ?? [];
    relationshipsForCoachee.forEach((relationship) => {
      addToCountMap(sharedMonthlyByCoach, relationship.coach_profile_id);
    });
  });

  feedbacks.forEach((feedback) => {
    const relationship = relationshipById.get(feedback.relationship_id);
    if (relationship) {
      addToCountMap(feedbackByCoach, relationship.coach_profile_id);
    }
  });

  feedbackPendingLogs.forEach((log) => {
    const relationship = relationshipById.get(log.relationship_id);
    if (relationship) {
      addToCountMap(feedbackPendingByCoach, relationship.coach_profile_id);
    }
  });

  const coaches = coachIds
    .map((coachId) => {
      const coach = profileMap.get(coachId);
      const assignedCoacheeCount = assignedCoacheesByCoach.get(coachId)?.size ?? 0;
      const weeklySubmittedThisWeekCount =
        weeklySubmittedThisWeekByCoach.get(coachId)?.size ?? 0;

      return {
        coachId,
        coachName: displayName(coach),
        coachEmail: coach?.email ?? null,
        assignedCoacheeCount,
        weeklySubmittedThisWeekCount,
        weeklyMissingThisWeekCount: Math.max(
          assignedCoacheeCount - weeklySubmittedThisWeekCount,
          0,
        ),
        sharedDailyRecordCount: sharedDailyByCoach.get(coachId) ?? 0,
        sharedMonthlyReflectionCount: sharedMonthlyByCoach.get(coachId) ?? 0,
        feedbackCount: feedbackByCoach.get(coachId) ?? 0,
        feedbackPendingCount: feedbackPendingByCoach.get(coachId) ?? 0,
      } satisfies CoachMakerCoachStatsRow;
    })
    .sort((left, right) => {
      if (right.assignedCoacheeCount !== left.assignedCoacheeCount) {
        return right.assignedCoacheeCount - left.assignedCoacheeCount;
      }

      return left.coachName.localeCompare(right.coachName, "ko");
    });

  const submittedThisWeekCoacheeCount = uniqueSize(
    submittedThisWeekLogs.map((log) => log.coachee_profile_id),
  );
  const assignedCoacheeCount = uniqueSize(
    scopedRelationships.map((relationship) => relationship.coachee_profile_id),
  );

  return {
    data: {
      profile: currentProfile,
      roles: coachMakerRoles,
      weekRange,
      summary: {
        coachCount: coaches.length,
        assignedCoacheeCount,
        weeklySubmittedThisWeekCount: submittedThisWeekCoacheeCount,
        weeklyMissingThisWeekCount: Math.max(
          assignedCoacheeCount - submittedThisWeekCoacheeCount,
          0,
        ),
        sharedDailyRecordCount: sharedDailyRecords.length,
        sharedMonthlyReflectionCount: sharedMonthlyReflections.length,
        feedbackCount: feedbacks.length,
        feedbackPendingCount: feedbackPendingLogs.length,
      },
      coaches,
      scopeLabel: buildScopeLabel(coachMakerRoles),
    },
    error: null,
  };
}

export async function getCoachMakerMoksilgiDashboardSummary(
  year = getCurrentYearInTimezone(DEFAULT_TIMEZONE),
): Promise<GetCoachMakerMoksilgiDashboardSummaryResult> {
  const selectedYear =
    Number.isInteger(year) && year >= 2000 && year <= 2100
      ? year
      : getCurrentYearInTimezone(DEFAULT_TIMEZONE);
  const session = await getSession();

  if (!session.user) {
    return {
      data: null,
      error: {
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
      },
    };
  }

  const serviceClientResult = await getServiceClient();

  if (!serviceClientResult.ok) {
    return { data: null, error: serviceClientResult.error };
  }

  const { serviceClient } = serviceClientResult;
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = serviceClient
    .from("profiles")
    .select("id, display_name, full_name, email, timezone")
    .is("deleted_at", null)
    .eq("status", "active");

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError) {
    logServerError(
      "COACH_MAKER_MOKSILGI_DASHBOARD_PROFILE_LOOKUP_FAILED",
      profileError.message ?? "Coach maker moksilgi dashboard profile lookup failed.",
    );
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

  const currentProfile = profile as CurrentProfileRow;
  const effectiveTimezone = getEffectiveTimezone(currentProfile.timezone);
  const { data: roles, error: rolesError } = await serviceClient
    .from("user_roles")
    .select("role, scope_type, scope_id, status")
    .eq("profile_id", currentProfile.id)
    .in("role", COACH_MAKER_ACCESS_ROLES)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    logServerError(
      "COACH_MAKER_MOKSILGI_DASHBOARD_ROLES_LOOKUP_FAILED",
      rolesError.message ?? "Coach maker moksilgi dashboard roles lookup failed.",
    );
    return {
      data: null,
      error: {
        code: "ROLES_QUERY_FAILED",
        message: "역할 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const coachMakerRoles = (roles ?? []) as CoachMakerRoleRow[];

  if (coachMakerRoles.length === 0) {
    return {
      data: null,
      error: {
        code: "ACCESS_DENIED",
        message: "코치메이커 또는 최고관리자 권한이 필요합니다.",
      },
    };
  }

  const hasFullAccess = hasCoachMakerFullAccess(coachMakerRoles);
  let accessibleProfileIds: string[] | null = null;

  if (!hasFullAccess) {
    const { data: relationships, error: relationshipsError } = await serviceClient
      .from("coaching_relationships")
      .select("coachee_profile_id")
      .eq("coach_profile_id", currentProfile.id)
      .eq("status", "active")
      .is("deleted_at", null);

    if (relationshipsError) {
      logServerError(
        "COACH_MAKER_MOKSILGI_DASHBOARD_RELATIONSHIPS_FETCH_FAILED",
        relationshipsError.message ??
          "Coach maker moksilgi dashboard relationships fetch failed.",
      );
      return {
        data: null,
        error: {
          code: "COACH_STATS_FETCH_FAILED",
          message: "코칭 관계를 조회하는 중 오류가 발생했습니다.",
        },
      };
    }

    accessibleProfileIds = uniqueNonNull(
      ((relationships ?? []) as Array<{ coachee_profile_id: string | null }>).map(
        (relationship) => relationship.coachee_profile_id,
      ),
    );

    if (accessibleProfileIds.length === 0) {
      return {
        data: {
          attentionCount: 0,
          attentionRows: [],
          missingCount: 0,
          totalCount: 0,
          upToCurrentRate: 0,
          year: selectedYear,
        },
        error: null,
      };
    }
  }

  let plansQuery = serviceClient
    .from("moksilgi_plans")
    .select("id, profile_id, author_name, region_name, team_name")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (accessibleProfileIds) {
    plansQuery = plansQuery.in("profile_id", accessibleProfileIds);
  }

  const { data: plans, error: plansError } = await plansQuery;

  if (plansError) {
    logServerError(
      "COACH_MAKER_MOKSILGI_DASHBOARD_PLANS_FETCH_FAILED",
      plansError.message ?? "Coach maker moksilgi dashboard plans fetch failed.",
    );
    return {
      data: null,
      error: {
        code: "COACH_STATS_FETCH_FAILED",
        message: "목실기 요약을 불러오지 못했습니다.",
      },
    };
  }

  const planRows = (plans ?? []) as MoksilgiDashboardPlanRow[];
  const planIds = planRows.map((plan) => plan.id);
  const profileIds = uniqueNonNull(planRows.map((plan) => plan.profile_id));

  const [profilesResult, summariesResult] = await Promise.all([
    profileIds.length > 0
      ? serviceClient
          .from("profiles")
          .select("id, display_name, full_name, email, region_id")
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

  if (profilesResult.error || summariesResult.error) {
    const error = profilesResult.error ?? summariesResult.error;
    logServerError(
      "COACH_MAKER_MOKSILGI_DASHBOARD_SUMMARY_FETCH_FAILED",
      error?.message ?? "Coach maker moksilgi dashboard summary fetch failed.",
    );
    return {
      data: null,
      error: {
        code: "COACH_STATS_FETCH_FAILED",
        message: "목실기 요약을 불러오지 못했습니다.",
      },
    };
  }

  const profileRows = (profilesResult.data ?? []) as MoksilgiDashboardProfileRow[];
  const regionIds = uniqueNonNull(profileRows.map((profile) => profile.region_id));
  const { data: regions, error: regionsError } = regionIds.length
    ? await serviceClient.from("regions").select("id, name").in("id", regionIds)
    : { data: [], error: null };

  if (regionsError) {
    logServerError(
      "COACH_MAKER_MOKSILGI_DASHBOARD_REGIONS_FETCH_FAILED",
      regionsError.message ?? "Coach maker moksilgi dashboard regions fetch failed.",
    );
    return {
      data: null,
      error: {
        code: "COACH_STATS_FETCH_FAILED",
        message: "소속 정보를 조회하는 중 오류가 발생했습니다.",
      },
    };
  }

  const profilesById = mapById(profileRows);
  const regionsById = mapById((regions ?? []) as MoksilgiDashboardRegionRow[]);
  const summariesByPlanId = new Map<string, MoksilgiDashboardSummaryRow[]>();

  for (const summary of (summariesResult.data ?? []) as MoksilgiDashboardSummaryRow[]) {
    const current = summariesByPlanId.get(summary.plan_id) ?? [];
    current.push(summary);
    summariesByPlanId.set(summary.plan_id, current);
  }

  const cutoff = getCurrentMonthCutoff(selectedYear, effectiveTimezone);
  const rows = planRows.map((plan) => {
    const profile = profilesById.get(plan.profile_id);
    const summaries = summariesByPlanId.get(plan.id) ?? [];
    const monthRates = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return safeNumber(
        summaries.find((summary) => summary.month === month)?.average_rate,
      );
    });
    const hasInput =
      monthRates.some((rate) => rate > 0) || average(monthRates) > 0;
    const currentRate =
      cutoff === 0
        ? null
        : average(monthRates.slice(0, cutoff).map((rate) => safeNumber(rate)));

    return {
      currentRate,
      hasInput,
      row: {
        author_name: plan.author_name,
        display_name: profile?.display_name ?? null,
        email: profile?.email ?? null,
        full_name: profile?.full_name ?? null,
        plan_id: plan.id,
        profile_id: plan.profile_id,
        region_name: profile?.region_id
          ? regionsById.get(profile.region_id)?.name ?? plan.region_name
          : plan.region_name,
        team_name: plan.team_name,
      } satisfies CoachMakerMoksilgiDashboardAttentionRow,
    };
  });
  const attentionRows = rows
    .filter(
      (item): item is {
        currentRate: number;
        hasInput: true;
        row: CoachMakerMoksilgiDashboardAttentionRow;
      } => item.currentRate !== null && item.hasInput && item.currentRate < 50,
    )
    .sort((left, right) => left.currentRate - right.currentRate);
  const rateValues = rows
    .map((row) => row.currentRate)
    .filter((rate): rate is number => rate !== null);

  return {
    data: {
      attentionCount: attentionRows.length,
      attentionRows: attentionRows.slice(0, 5).map((item) => ({
        rate: item.currentRate,
        row: item.row,
      })),
      missingCount: rows.filter((row) => row.currentRate === null || !row.hasInput)
        .length,
      totalCount: rows.length,
      upToCurrentRate: average(rateValues),
      year: selectedYear,
    },
    error: null,
  };
}
