import { getSession } from "@/lib/auth/getSession";
import {
  ensureCoachLevelAccess,
  getCoachRoleRowsWithHeaderFallback,
  type CoachRoleRow,
} from "@/lib/auth/coach-api-access";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
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
} from "@/types/database";

type CoachProfile = Pick<
  ProfileRow,
  "id" | "display_name" | "full_name" | "email" | "timezone"
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

type CoacheeProfileRow = Pick<
  ProfileRow,
  "id" | "display_name" | "full_name" | "email" | "organization_id" | "church_id"
>;

type NamedScopeRow = {
  id: string;
  name: string;
};

type WeeklyLogSummaryRow = {
  id: string;
  relationship_id: string;
  coachee_profile_id: string;
  week_start: string;
  week_end: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  created_at: string;
};

type SharedDailyRecordSummaryRow = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  record_date: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  created_at: string;
};

type SharedMonthlyReflectionSummaryRow = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  year: number;
  month: number;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
  created_at: string;
};

type FeedbackRow = {
  weekly_log_id: string;
};

export type CoachDashboardCoacheeStatus = {
  relationshipId: string;
  coacheeId: string;
  coacheeName: string;
  coacheeEmail: string | null;
  organizationName: string | null;
  churchName: string | null;
  startedAt: string;
  latestWeeklyStatus: string;
  latestWeeklySubmittedAt: string | null;
  sharedDailyCount: number;
  latestSharedDailyDate: string | null;
  sharedMonthlyCount: number;
  latestSharedMonthlyLabel: string | null;
  feedbackPending: boolean;
};

export type CoachDashboardSummary = {
  assignedCoacheeCount: number;
  weeklySubmittedThisWeekCount: number;
  weeklyMissingThisWeekCount: number;
  sharedDailyRecordCount: number;
  sharedMonthlyReflectionCount: number;
  feedbackPendingCount: number;
};

export type CoachDashboardData = {
  profile: CoachProfile | null;
  roles: CoachRoleRow[];
  weekRange: {
    start: string;
    end: string;
  };
  summary: CoachDashboardSummary;
  coachees: CoachDashboardCoacheeStatus[];
};

type CoachDashboardError = {
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "PROFILE_LOOKUP_FAILED"
    | "ROLE_LOOKUP_FAILED"
    | "DASHBOARD_FETCH_FAILED";
  message: string;
};

export type GetCoachDashboardResult =
  | {
      ok: true;
      data: CoachDashboardData;
    }
  | {
      ok: false;
      error: CoachDashboardError;
    };

type ServiceSupabaseClient = NonNullable<
  ReturnType<typeof createSupabaseServiceClient>["client"]
>;

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

function getCoachWeekRange(timezone: string) {
  const weekRange = getCurrentWeekRangeInTimezone(timezone);
  return {
    start: weekRange.weekStart,
    end: weekRange.weekEnd,
  };
}

function displayName(profile: CoacheeProfileRow | null | undefined) {
  return (
    profile?.display_name?.trim() ||
    profile?.full_name?.trim() ||
    profile?.email?.trim() ||
    "이름 없음"
  );
}

function latestTimestamp(row: {
  submitted_at?: string | null;
  reviewed_at?: string | null;
  updated_at: string;
  created_at: string;
}) {
  return row.submitted_at ?? row.reviewed_at ?? row.updated_at ?? row.created_at;
}

function isSubmittedWeeklyLog(log: WeeklyLogSummaryRow) {
  return log.status === "submitted" || Boolean(log.submitted_at);
}

function isOverlappingWeek(log: WeeklyLogSummaryRow, weekStart: string, weekEnd: string) {
  return log.week_start <= weekEnd && log.week_end >= weekStart;
}

async function getCurrentCoachAccess():
  Promise<
    | {
        ok: true;
        serviceClient: ServiceSupabaseClient;
        profile: CoachProfile | null;
        roles: CoachRoleRow[];
      }
    | {
        ok: false;
        error: CoachDashboardError;
      }
  > {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
      },
    };
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "COACH_DASHBOARD_SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ?? "Coach dashboard service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        code: "DASHBOARD_FETCH_FAILED",
        message: "코치 대시보드 정보를 불러오지 못했습니다.",
      },
    };
  }

  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = serviceClient
    .from("profiles")
    .select("id, display_name, full_name, email, timezone")
    .is("deleted_at", null)
    .neq("status", "anonymized");

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError) {
    logServerError(
      "COACH_DASHBOARD_PROFILE_LOOKUP_FAILED",
      profileError.message ?? "Coach dashboard profile lookup failed.",
    );
    return {
      ok: false,
      error: {
        code: "PROFILE_LOOKUP_FAILED",
        message: "프로필 정보를 불러오지 못했습니다.",
      },
    };
  }

  if (!profile) {
    return {
      ok: true,
      serviceClient,
      profile: null,
      roles: [],
    };
  }

  const currentProfile = profile as CoachProfile;
  const coachAccess = await ensureCoachLevelAccess(serviceClient, currentProfile.id);

  if (!coachAccess.ok) {
    return {
      ok: false,
      error: {
        code: coachAccess.code === "ACCESS_DENIED" ? "FORBIDDEN" : "ROLE_LOOKUP_FAILED",
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
      "COACH_DASHBOARD_ROLE_LOOKUP_FAILED",
      rolesResult.message,
    );
    return {
      ok: false,
      error: {
        code: "ROLE_LOOKUP_FAILED",
        message: rolesResult.message,
      },
    };
  }

  return {
    ok: true,
    serviceClient,
    profile: currentProfile,
    roles: rolesResult.roles,
  };
}

async function getNamedScopes(
  serviceClient: ServiceSupabaseClient,
  table: "organizations" | "churches",
  ids: string[],
) {
  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await serviceClient
    .from(table)
    .select("id, name")
    .in("id", ids);

  if (error) {
    logServerError(
      `COACH_DASHBOARD_${table.toUpperCase()}_FETCH_FAILED`,
      error.message ?? `${table} fetch failed.`,
    );
    return new Map<string, string>();
  }

  return new Map(((data ?? []) as NamedScopeRow[]).map((row) => [row.id, row.name]));
}

export async function getCoachDashboard(): Promise<GetCoachDashboardResult> {
  const access = await getCurrentCoachAccess();

  if (!access.ok) {
    return access;
  }

  const weekRange = getCoachWeekRange(getEffectiveTimezone(access.profile?.timezone));

  if (access.profile === null) {
    return {
      ok: true,
      data: {
        profile: null,
        roles: [],
        weekRange,
        summary: {
          assignedCoacheeCount: 0,
          weeklySubmittedThisWeekCount: 0,
          weeklyMissingThisWeekCount: 0,
          sharedDailyRecordCount: 0,
          sharedMonthlyReflectionCount: 0,
          feedbackPendingCount: 0,
        },
        coachees: [],
      },
    };
  }

  const { serviceClient, profile, roles } = access;
  const { data: relationships, error: relationshipsError } = await serviceClient
    .from("coaching_relationships")
    .select(
      "id, coach_profile_id, coachee_profile_id, relationship_type, status, scope_type, scope_id, started_at, ended_at, created_at",
    )
    .eq("coach_profile_id", profile.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (relationshipsError) {
    logServerError(
      "COACH_DASHBOARD_RELATIONSHIPS_FETCH_FAILED",
      relationshipsError.message ?? "Coach dashboard relationships fetch failed.",
    );
    return {
      ok: false,
      error: {
        code: "DASHBOARD_FETCH_FAILED",
        message: "담당 코치이 현황을 불러오지 못했습니다.",
      },
    };
  }

  const relationshipRows = (relationships ?? []) as RelationshipRow[];

  if (relationshipRows.length === 0) {
    return {
      ok: true,
      data: {
        profile,
        roles,
        weekRange,
        summary: {
          assignedCoacheeCount: 0,
          weeklySubmittedThisWeekCount: 0,
          weeklyMissingThisWeekCount: 0,
          sharedDailyRecordCount: 0,
          sharedMonthlyReflectionCount: 0,
          feedbackPendingCount: 0,
        },
        coachees: [],
      },
    };
  }

  const relationshipIds = [...new Set(relationshipRows.map((row) => row.id))];
  const coacheeIds = [...new Set(relationshipRows.map((row) => row.coachee_profile_id))];

  const reflectionYear = getCurrentYearInTimezone(
    getEffectiveTimezone(profile.timezone),
  );
  const reflectionMonth = getCurrentMonthInTimezone(
    getEffectiveTimezone(profile.timezone),
  );

  const [
    coacheeResult,
    weeklyLogsResult,
    dailyRecordsResult,
    monthlyReflectionsResult,
  ] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("id, display_name, full_name, email, organization_id, church_id")
      .in("id", coacheeIds)
      .is("deleted_at", null),
    serviceClient
      .from("weekly_logs")
      .select(
        "id, relationship_id, coachee_profile_id, week_start, week_end, status, submitted_at, updated_at, created_at",
      )
      .in("relationship_id", relationshipIds)
      .lte("week_start", weekRange.end)
      .gte("week_end", weekRange.start)
      .is("deleted_at", null),
    serviceClient
      .from("daily_records")
      .select(
        "id, profile_id, relationship_id, record_date, status, submitted_at, updated_at, created_at",
      )
      .in("profile_id", coacheeIds)
      .eq("shared_with_coach", true)
      .eq("visibility", "coach")
      .gte("record_date", weekRange.start)
      .lte("record_date", weekRange.end)
      .is("deleted_at", null),
    serviceClient
      .from("monthly_reflections")
      .select(
        "id, profile_id, relationship_id, year, month, status, submitted_at, reviewed_at, updated_at, created_at",
      )
      .in("profile_id", coacheeIds)
      .eq("shared_with_coach", true)
      .eq("visibility", "coach")
      .eq("year", reflectionYear)
      .eq("month", reflectionMonth)
      .is("deleted_at", null),
  ]);

  if (coacheeResult.error) {
    logServerError(
      "COACH_DASHBOARD_COACHEES_FETCH_FAILED",
      coacheeResult.error.message ?? "Coach dashboard coachees fetch failed.",
    );
    return {
      ok: false,
      error: {
        code: "DASHBOARD_FETCH_FAILED",
        message: "코치이 정보를 불러오지 못했습니다.",
      },
    };
  }

  if (weeklyLogsResult.error) {
    logServerError(
      "COACH_DASHBOARD_WEEKLY_LOGS_FETCH_FAILED",
      weeklyLogsResult.error.message ?? "Coach dashboard weekly logs fetch failed.",
    );
    return {
      ok: false,
      error: {
        code: "DASHBOARD_FETCH_FAILED",
        message: "주간 기록 현황을 불러오지 못했습니다.",
      },
    };
  }

  if (dailyRecordsResult.error) {
    logServerError(
      "COACH_DASHBOARD_DAILY_RECORDS_FETCH_FAILED",
      dailyRecordsResult.error.message ?? "Coach dashboard daily records fetch failed.",
    );
    return {
      ok: false,
      error: {
        code: "DASHBOARD_FETCH_FAILED",
        message: "공유된 하루 기록 현황을 불러오지 못했습니다.",
      },
    };
  }

  if (monthlyReflectionsResult.error) {
    logServerError(
      "COACH_DASHBOARD_MONTHLY_REFLECTIONS_FETCH_FAILED",
      monthlyReflectionsResult.error.message ??
        "Coach dashboard monthly reflections fetch failed.",
    );
    return {
      ok: false,
      error: {
        code: "DASHBOARD_FETCH_FAILED",
        message: "공유된 월간 회고 현황을 불러오지 못했습니다.",
      },
    };
  }

  const coachees = (coacheeResult.data ?? []) as CoacheeProfileRow[];
  const weeklyLogs = (weeklyLogsResult.data ?? []) as WeeklyLogSummaryRow[];
  const sharedDailyRecords =
    (dailyRecordsResult.data ?? []) as SharedDailyRecordSummaryRow[];
  const sharedMonthlyReflections =
    (monthlyReflectionsResult.data ?? []) as SharedMonthlyReflectionSummaryRow[];

  const organizationIds = [
    ...new Set(coachees.map((coachee) => coachee.organization_id).filter(Boolean)),
  ] as string[];
  const churchIds = [
    ...new Set(coachees.map((coachee) => coachee.church_id).filter(Boolean)),
  ] as string[];

  const [organizationMap, churchMap] = await Promise.all([
    getNamedScopes(serviceClient, "organizations", organizationIds),
    getNamedScopes(serviceClient, "churches", churchIds),
  ]);

  const feedbackTargetLogs = weeklyLogs.filter(isSubmittedWeeklyLog);
  const feedbackTargetLogIds = feedbackTargetLogs.map((log) => log.id);
  const { data: feedbackRows, error: feedbackError } = feedbackTargetLogIds.length
    ? await serviceClient
        .from("coach_feedback")
        .select("weekly_log_id")
        .in("weekly_log_id", feedbackTargetLogIds)
        .eq("coach_profile_id", profile.id)
        .is("deleted_at", null)
    : { data: [], error: null };

  if (feedbackError) {
    logServerError(
      "COACH_DASHBOARD_FEEDBACK_FETCH_FAILED",
      feedbackError.message ?? "Coach dashboard feedback fetch failed.",
    );
  }

  const feedbackLogIds = new Set(
    ((feedbackRows ?? []) as FeedbackRow[]).map((feedback) => feedback.weekly_log_id),
  );
  const feedbackPendingLogs = feedbackTargetLogs.filter(
    (log) => !feedbackLogIds.has(log.id),
  );
  const feedbackPendingLogIds = new Set(feedbackPendingLogs.map((log) => log.id));

  const weeklySubmittedThisWeekCoacheeIds = new Set(
    weeklyLogs
      .filter(
        (log) =>
          isSubmittedWeeklyLog(log) &&
          isOverlappingWeek(log, weekRange.start, weekRange.end),
      )
      .map((log) => log.coachee_profile_id),
  );

  const coacheeMap = new Map(coachees.map((coachee) => [coachee.id, coachee]));
  const weeklyLogsByCoachee = new Map<string, WeeklyLogSummaryRow[]>();
  const sharedDailyByCoachee = new Map<string, SharedDailyRecordSummaryRow[]>();
  const sharedMonthlyByCoachee = new Map<string, SharedMonthlyReflectionSummaryRow[]>();
  const feedbackPendingByCoachee = new Set(
    feedbackPendingLogs.map((log) => log.coachee_profile_id),
  );

  weeklyLogs.forEach((log) => {
    const rows = weeklyLogsByCoachee.get(log.coachee_profile_id) ?? [];
    rows.push(log);
    weeklyLogsByCoachee.set(log.coachee_profile_id, rows);
  });

  sharedDailyRecords.forEach((record) => {
    const rows = sharedDailyByCoachee.get(record.profile_id) ?? [];
    rows.push(record);
    sharedDailyByCoachee.set(record.profile_id, rows);
  });

  sharedMonthlyReflections.forEach((reflection) => {
    const rows = sharedMonthlyByCoachee.get(reflection.profile_id) ?? [];
    rows.push(reflection);
    sharedMonthlyByCoachee.set(reflection.profile_id, rows);
  });

  const coacheeStatuses = relationshipRows.map((relationship) => {
    const coachee = coacheeMap.get(relationship.coachee_profile_id);
    const coacheeWeeklyLogs = weeklyLogsByCoachee.get(relationship.coachee_profile_id) ?? [];
    const coacheeDailyRecords =
      sharedDailyByCoachee.get(relationship.coachee_profile_id) ?? [];
    const coacheeMonthlyReflections =
      sharedMonthlyByCoachee.get(relationship.coachee_profile_id) ?? [];
    const latestWeeklyLog = coacheeWeeklyLogs
      .slice()
      .sort((a, b) => latestTimestamp(b).localeCompare(latestTimestamp(a)))[0];
    const latestDailyRecord = coacheeDailyRecords
      .slice()
      .sort((a, b) => b.record_date.localeCompare(a.record_date))[0];
    const latestMonthlyReflection = coacheeMonthlyReflections
      .slice()
      .sort((a, b) => {
        if (a.year !== b.year) {
          return b.year - a.year;
        }

        return b.month - a.month;
      })[0];

    return {
      relationshipId: relationship.id,
      coacheeId: relationship.coachee_profile_id,
      coacheeName: displayName(coachee),
      coacheeEmail: coachee?.email ?? null,
      organizationName: coachee?.organization_id
        ? organizationMap.get(coachee.organization_id) ?? null
        : null,
      churchName: coachee?.church_id ? churchMap.get(coachee.church_id) ?? null : null,
      startedAt: relationship.started_at,
      latestWeeklyStatus: latestWeeklyLog?.status ?? "none",
      latestWeeklySubmittedAt: latestWeeklyLog?.submitted_at ?? null,
      sharedDailyCount: coacheeDailyRecords.length,
      latestSharedDailyDate: latestDailyRecord?.record_date ?? null,
      sharedMonthlyCount: coacheeMonthlyReflections.length,
      latestSharedMonthlyLabel: latestMonthlyReflection
        ? `${latestMonthlyReflection.year}-${String(latestMonthlyReflection.month).padStart(2, "0")}`
        : null,
      feedbackPending: feedbackPendingByCoachee.has(relationship.coachee_profile_id),
    } satisfies CoachDashboardCoacheeStatus;
  });

  return {
    ok: true,
    data: {
      profile,
      roles,
      weekRange,
      summary: {
        assignedCoacheeCount: relationshipRows.length,
        weeklySubmittedThisWeekCount: weeklySubmittedThisWeekCoacheeIds.size,
        weeklyMissingThisWeekCount: Math.max(
          relationshipRows.length - weeklySubmittedThisWeekCoacheeIds.size,
          0,
        ),
        sharedDailyRecordCount: sharedDailyRecords.length,
        sharedMonthlyReflectionCount: sharedMonthlyReflections.length,
        feedbackPendingCount: feedbackPendingLogIds.size,
      },
      coachees: coacheeStatuses,
    },
  };
}
