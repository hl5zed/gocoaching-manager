import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  CoachingRelationshipStatus,
  ProfileRow,
  RelationshipType,
  ScopeType,
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

type CurrentProfileRow = Pick<ProfileRow, "id" | "display_name" | "full_name" | "email">;

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
  week_start: string;
  week_end: string;
  status: string;
  submitted_at: string | null;
};

type SharedDailyStatsRow = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  status: string;
  record_date: string;
  shared_with_coach: boolean;
  visibility: string;
};

type SharedMonthlyStatsRow = {
  id: string;
  profile_id: string;
  relationship_id: string | null;
  year: number;
  month: number;
  status: string;
  shared_with_coach: boolean;
  visibility: string;
};

type FeedbackStatsRow = {
  weekly_log_id: string;
  relationship_id: string;
  coach_profile_id: string;
  coachee_profile_id: string;
};

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

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - daysFromMonday);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    start: toDateKey(start),
    end: toDateKey(end),
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

function isOverlappingWeek(log: WeeklyLogStatsRow, weekStart: string, weekEnd: string) {
  return log.week_start <= weekEnd && log.week_end >= weekStart;
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

function uniqueSize(values: string[]) {
  return new Set(values).size;
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
  const weekRange = getCurrentWeekRange();
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
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, display_name, full_name, email")
    .eq("auth_user_id", session.user.id)
    .is("deleted_at", null)
    .eq("status", "active")
    .maybeSingle();

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

  const { data: relationships, error: relationshipsError } = await serviceClient
    .from("coaching_relationships")
    .select(
      "id, coach_profile_id, coachee_profile_id, relationship_type, status, scope_type, scope_id, started_at, created_at",
    )
    .eq("status", "active")
    .is("deleted_at", null);

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
        .select("id, relationship_id, coachee_profile_id, week_start, week_end, status, submitted_at")
        .in("relationship_id", relationshipIds)
        .is("deleted_at", null),
      serviceClient
        .from("daily_records")
        .select("id, profile_id, relationship_id, status, record_date, shared_with_coach, visibility")
        .in("profile_id", coacheeIds)
        .eq("shared_with_coach", true)
        .eq("visibility", "coach")
        .is("deleted_at", null),
      serviceClient
        .from("monthly_reflections")
        .select("id, profile_id, relationship_id, year, month, status, shared_with_coach, visibility")
        .in("profile_id", coacheeIds)
        .eq("shared_with_coach", true)
        .eq("visibility", "coach")
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
  const submittedWeeklyLogs = weeklyLogs.filter(isSubmittedWeeklyLog);
  const submittedThisWeekLogs = submittedWeeklyLogs.filter((log) =>
    isOverlappingWeek(log, weekRange.start, weekRange.end),
  );
  const submittedWeeklyLogIds = submittedWeeklyLogs.map((log) => log.id);
  const { data: feedbackRows, error: feedbackError } = submittedWeeklyLogIds.length
    ? await serviceClient
        .from("coach_feedback")
        .select("weekly_log_id, relationship_id, coach_profile_id, coachee_profile_id")
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
  const feedbackPendingLogs = submittedWeeklyLogs.filter(
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
    if (coachIds.includes(feedback.coach_profile_id)) {
      addToCountMap(feedbackByCoach, feedback.coach_profile_id);
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
