import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  ProfileRow,
  RelationshipType,
  ScopeType,
  UserRole,
  WeeklyLogInsert,
  WeeklyLogStatus,
  WeeklyLogUpdate,
} from "@/types/database";

const MAX_TEXT_LENGTH = 2000;

type WeeklyLogRole = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
  status: "active";
};

type WeeklyLogProfile = Pick<
  ProfileRow,
  "id" | "email" | "full_name" | "display_name" | "status"
>;

type RelationshipRow = {
  id: string;
  relationship_type: RelationshipType;
  status: string;
  scope_type: ScopeType;
  scope_id: string | null;
  started_at: string;
  created_at: string;
  coach_profile_id: string;
};

type CoachProfileRow = Pick<
  ProfileRow,
  "id" | "display_name" | "full_name" | "email"
>;

type WeeklyLogRow = {
  id: string;
  relationship_id: string;
  coachee_profile_id: string;
  week_start: string;
  week_end: string;
  gratitude: string | null;
  prayer_request: string | null;
  progress_summary: string | null;
  difficulty: string | null;
  message_to_coach: string | null;
  status: WeeklyLogStatus;
  version: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type WeeklyLogRecord = Omit<WeeklyLogRow, "deleted_at">;

type WeeklyLogsSelectChain = {
  eq: (
    column: "relationship_id" | "coachee_profile_id" | "week_start" | "id",
    value: string,
  ) => WeeklyLogsSelectChain;
  is: (
    column: "deleted_at",
    value: null,
  ) => {
    maybeSingle: () => Promise<{
      data: WeeklyLogRecord | null;
      error: PostgrestErrorLike | null;
    }>;
  };
};

type WeeklyLogsTable = {
  select: (columns: string) => WeeklyLogsSelectChain;
  insert: (values: WeeklyLogInsert) => {
    select: (columns: string) => {
      single: () => Promise<{
        data: WeeklyLogRecord | null;
        error: PostgrestErrorLike | null;
      }>;
    };
  };
  update: (values: WeeklyLogUpdate) => WeeklyLogsUpdateChain;
};

type WeeklyLogsUpdateChain = {
  eq: (
    column: "id" | "coachee_profile_id",
    value: string,
  ) => WeeklyLogsUpdateChain;
  is: (
    column: "deleted_at",
    value: null,
  ) => {
    select: (columns: string) => {
      single: () => Promise<{
        data: WeeklyLogRecord | null;
        error: PostgrestErrorLike | null;
      }>;
    };
  };
};

type PostgrestErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

export type MyWeeklyLogRelationship = {
  id: string;
  relationshipType: RelationshipType;
  status: string;
  scopeType: ScopeType;
  scopeId: string | null;
  startedAt: string;
  createdAt: string;
  coach: {
    displayName: string | null;
    fullName: string | null;
    email: string | null;
  } | null;
};

export type MyWeeklyLogEntry = {
  id: string;
  relationshipId: string;
  weekStart: string;
  weekEnd: string;
  gratitude: string | null;
  prayerRequest: string | null;
  progressSummary: string | null;
  difficulty: string | null;
  messageToCoach: string | null;
  status: WeeklyLogStatus;
  version: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MyWeeklyLogPageDataResult =
  | {
      ok: true;
      data: {
        authEmail: string | null;
        profile: WeeklyLogProfile | null;
        roles: WeeklyLogRole[];
        relationships: MyWeeklyLogRelationship[];
        selectedRelationshipId: string | null;
        currentWeek: {
          weekStart: string;
          weekEnd: string;
        };
        weeklyLog: MyWeeklyLogEntry | null;
      };
    }
  | {
      ok: false;
      error: {
        code: "UNAUTHORIZED" | "MY_WEEKLY_LOG_FETCH_FAILED";
        message: string;
      };
    };

export type SaveMyWeeklyLogResult =
  | {
      ok: true;
      data: {
        relationshipId: string;
        status: WeeklyLogStatus;
      };
    }
  | {
      ok: false;
      error: {
        status: 400 | 401 | 404 | 500;
        code: string;
        message: string;
      };
    };

function logServerError(code: string, message: string) {
  console.error(`[${code}] ${message}`);
}

function normalizeTextarea(value: unknown, fieldLabel: string) {
  if (value === null || value === undefined) {
    return {
      ok: true as const,
      value: null,
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false as const,
      message: `${fieldLabel}은(는) 텍스트여야 합니다.`,
    };
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return {
      ok: true as const,
      value: null,
    };
  }

  if (normalized.length > MAX_TEXT_LENGTH) {
    return {
      ok: false as const,
      message: `${fieldLabel}은(는) 2000자 이하여야 합니다.`,
    };
  }

  return {
    ok: true as const,
    value: normalized,
  };
}

function normalizeRelationshipId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIntent(value: unknown): WeeklyLogStatus | null {
  if (value === "draft" || value === "submitted") {
    return value;
  }

  return null;
}

function createDateOnlyString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getCurrentWeekRange(referenceDate = new Date()) {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() + diffToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    weekStart: createDateOnlyString(weekStart),
    weekEnd: createDateOnlyString(weekEnd),
  };
}

function mapRelationship(
  relationship: RelationshipRow,
  coachMap: Map<
    string,
    {
      displayName: string | null;
      fullName: string | null;
      email: string | null;
    }
  >,
): MyWeeklyLogRelationship {
  return {
    id: relationship.id,
    relationshipType: relationship.relationship_type,
    status: relationship.status,
    scopeType: relationship.scope_type,
    scopeId: relationship.scope_id,
    startedAt: relationship.started_at,
    createdAt: relationship.created_at,
    coach: coachMap.get(relationship.coach_profile_id) ?? null,
  };
}

function mapWeeklyLog(log: WeeklyLogRecord): MyWeeklyLogEntry {
  return {
    id: log.id,
    relationshipId: log.relationship_id,
    weekStart: log.week_start,
    weekEnd: log.week_end,
    gratitude: log.gratitude,
    prayerRequest: log.prayer_request,
    progressSummary: log.progress_summary,
    difficulty: log.difficulty,
    messageToCoach: log.message_to_coach,
    status: log.status,
    version: log.version,
    submittedAt: log.submitted_at,
    createdAt: log.created_at,
    updatedAt: log.updated_at,
  };
}

async function getCurrentProfileAndRoles() {
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

  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, display_name, status")
    .eq("auth_user_id", session.user.id)
    .is("deleted_at", null)
    .neq("status", "anonymized")
    .maybeSingle();

  if (profileError) {
    return {
      ok: false as const,
      error: {
        code: "MY_WEEKLY_LOG_FETCH_FAILED" as const,
        message: "지금 주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  if (!profile) {
    return {
      ok: true as const,
      data: {
        authEmail: session.user.email,
        profile: null,
        roles: [] as WeeklyLogRole[],
      },
    };
  }

  const profileRecord = profile as WeeklyLogProfile;
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, scope_type, scope_id, status")
    .eq("profile_id", profileRecord.id)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (rolesError) {
    return {
      ok: false as const,
      error: {
        code: "MY_WEEKLY_LOG_FETCH_FAILED" as const,
        message: "지금 주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  return {
    ok: true as const,
    data: {
      authEmail: session.user.email,
      profile: profileRecord,
      roles: (roles ?? []) as WeeklyLogRole[],
    },
  };
}

async function getOwnRelationships(
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>["client"]>,
  profileId: string,
) {
  const { data: relationships, error: relationshipsError } = await serviceClient
    .from("coaching_relationships")
    .select(
      "id, coach_profile_id, relationship_type, status, scope_type, scope_id, started_at, created_at",
    )
    .eq("coachee_profile_id", profileId)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (relationshipsError) {
    return {
      relationships: [] as RelationshipRow[],
      error: relationshipsError,
    };
  }

  return {
    relationships: (relationships ?? []) as RelationshipRow[],
    error: null as PostgrestErrorLike | null,
  };
}

async function getCoachMap(
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>["client"]>,
  relationships: RelationshipRow[],
) {
  const coachIds = [...new Set(relationships.map((row) => row.coach_profile_id))];

  if (coachIds.length === 0) {
    return {
      coachMap: new Map<
        string,
        {
          displayName: string | null;
          fullName: string | null;
          email: string | null;
        }
      >(),
      error: null as PostgrestErrorLike | null,
    };
  }

  const { data: coaches, error } = await serviceClient
    .from("profiles")
    .select("id, display_name, full_name, email")
    .in("id", coachIds)
    .is("deleted_at", null)
    .neq("status", "anonymized");

  if (error) {
    return {
      coachMap: new Map<
        string,
        {
          displayName: string | null;
          fullName: string | null;
          email: string | null;
        }
      >(),
      error,
    };
  }

  return {
    coachMap: new Map(
      ((coaches ?? []) as CoachProfileRow[]).map((coach) => [
        coach.id,
        {
          displayName: coach.display_name,
          fullName: coach.full_name,
          email: coach.email,
        },
      ]),
    ),
    error: null as PostgrestErrorLike | null,
  };
}

function createWeeklyLogsTable(
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>["client"]>,
) : WeeklyLogsTable {
  return serviceClient.from("weekly_logs") as unknown as WeeklyLogsTable;
}

export async function getMyWeeklyLogPageData({
  relationshipId,
}: {
  relationshipId?: string | null;
} = {}): Promise<MyWeeklyLogPageDataResult> {
  const me = await getCurrentProfileAndRoles();

  if (!me.ok) {
    return me;
  }

  const currentWeek = getCurrentWeekRange();

  if (me.data.profile === null) {
    return {
      ok: true,
      data: {
        authEmail: me.data.authEmail,
        profile: null,
        roles: [],
        relationships: [],
        selectedRelationshipId: null,
        currentWeek,
        weeklyLog: null,
      },
    };
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ?? "Weekly log service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        code: "MY_WEEKLY_LOG_FETCH_FAILED",
        message: "지금 주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  const relationshipsResult = await getOwnRelationships(
    serviceClient,
    me.data.profile.id,
  );

  if (relationshipsResult.error) {
    logServerError(
      "MY_WEEKLY_LOG_RELATIONSHIPS_FAILED",
      relationshipsResult.error.message ??
        "Weekly log relationships lookup failed.",
    );
    return {
      ok: false,
      error: {
        code: "MY_WEEKLY_LOG_FETCH_FAILED",
        message: "지금 주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  const coachMapResult = await getCoachMap(
    serviceClient,
    relationshipsResult.relationships,
  );

  if (coachMapResult.error) {
    logServerError(
      "MY_WEEKLY_LOG_COACHES_FAILED",
      coachMapResult.error.message ?? "Weekly log coach lookup failed.",
    );
    return {
      ok: false,
      error: {
        code: "MY_WEEKLY_LOG_FETCH_FAILED",
        message: "지금 주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  const mappedRelationships = relationshipsResult.relationships.map((row) =>
    mapRelationship(row, coachMapResult.coachMap),
  );

  const activeRelationships = mappedRelationships.filter(
    (relationship) => relationship.status === "active",
  );

  let selectedRelationshipId: string | null = null;

  if (relationshipId) {
    selectedRelationshipId = activeRelationships.some(
      (relationship) => relationship.id === relationshipId,
    )
      ? relationshipId
      : null;
  }

  if (!selectedRelationshipId) {
    if (activeRelationships.length === 1) {
      selectedRelationshipId = activeRelationships[0]?.id ?? null;
    } else if (activeRelationships.length > 1) {
      selectedRelationshipId = activeRelationships[0]?.id ?? null;
    }
  }

  let weeklyLog: MyWeeklyLogEntry | null = null;

  if (selectedRelationshipId) {
    const weeklyLogsTable = createWeeklyLogsTable(serviceClient);
    const { data: log, error: logError } = await weeklyLogsTable
      .select(
        "id, relationship_id, coachee_profile_id, week_start, week_end, gratitude, prayer_request, progress_summary, difficulty, message_to_coach, status, version, submitted_at, created_at, updated_at",
      )
      .eq("relationship_id", selectedRelationshipId)
      .eq("coachee_profile_id", me.data.profile.id)
      .eq("week_start", currentWeek.weekStart)
      .is("deleted_at", null)
      .maybeSingle();

    if (logError) {
      logServerError(
        "MY_WEEKLY_LOG_CURRENT_FAILED",
        logError.message ?? "Current weekly log lookup failed.",
      );
      return {
        ok: false,
        error: {
          code: "MY_WEEKLY_LOG_FETCH_FAILED",
          message: "지금 주간 기록을 불러올 수 없습니다.",
        },
      };
    }

    weeklyLog = log ? mapWeeklyLog(log) : null;
  }

  return {
    ok: true,
    data: {
      authEmail: me.data.authEmail,
      profile: me.data.profile,
      roles: me.data.roles,
      relationships: activeRelationships,
      selectedRelationshipId,
      currentWeek,
      weeklyLog,
    },
  };
}

export async function saveMyWeeklyLog(input: {
  relationship_id?: unknown;
  gratitude?: unknown;
  prayer_request?: unknown;
  progress_summary?: unknown;
  difficulty?: unknown;
  message_to_coach?: unknown;
  intent?: unknown;
}): Promise<SaveMyWeeklyLogResult> {
  const me = await getCurrentProfileAndRoles();

  if (!me.ok) {
    return {
      ok: false,
      error: {
        status: 401,
        code: me.error.code,
        message: me.error.message,
      },
    };
  }

  if (me.data.profile === null) {
    return {
      ok: false,
      error: {
        status: 404,
        code: "PROFILE_NOT_FOUND",
        message: "아직 프로필이 생성되지 않았습니다.",
      },
    };
  }

  const relationshipId = normalizeRelationshipId(input.relationship_id);
  const intent = normalizeIntent(input.intent);
  const gratitude = normalizeTextarea(input.gratitude, "감사 제목");
  const prayerRequest = normalizeTextarea(
    input.prayer_request,
    "기도 제목",
  );
  const progressSummary = normalizeTextarea(
    input.progress_summary,
    "진행 상황",
  );
  const difficulty = normalizeTextarea(input.difficulty, "어려웠던 점");
  const messageToCoach = normalizeTextarea(
    input.message_to_coach,
    "코치에게 남길 말",
  );

  if (!relationshipId) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "MISSING_RELATIONSHIP",
        message: "코칭 관계를 선택해 주세요.",
      },
    };
  }

  if (!intent) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_STATUS",
        message: "올바른 저장 작업을 선택해 주세요.",
      },
    };
  }

  const textValidation = [
    gratitude,
    prayerRequest,
    progressSummary,
    difficulty,
    messageToCoach,
  ].find((result) => !result.ok);

  if (textValidation && !textValidation.ok) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_TEXT_FIELD",
        message: textValidation.message,
      },
    };
  }

  const { client: serviceClient, error: serviceClientError } =
    createSupabaseServiceClient();

  if (!serviceClient) {
    logServerError(
      "SERVICE_CLIENT_UNAVAILABLE",
      serviceClientError ?? "Weekly log service client is unavailable.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "SERVICE_CLIENT_UNAVAILABLE",
        message: "주간 기록 서비스를 지금 사용할 수 없습니다.",
      },
    };
  }

  const relationshipsResult = await getOwnRelationships(
    serviceClient,
    me.data.profile.id,
  );

  if (relationshipsResult.error) {
    logServerError(
      "MY_WEEKLY_LOG_RELATIONSHIP_VALIDATION_FAILED",
      relationshipsResult.error.message ??
        "Weekly log relationship validation failed.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "RELATIONSHIP_VALIDATION_FAILED",
        message: "지금 코칭 관계를 확인할 수 없습니다.",
      },
    };
  }

  const selectedRelationship = relationshipsResult.relationships.find(
    (relationship) =>
      relationship.id === relationshipId && relationship.status === "active",
  );

  if (!selectedRelationship) {
    return {
      ok: false,
      error: {
        status: 404,
        code: "RELATIONSHIP_NOT_FOUND",
        message: "이 계정에 연결된 활성 코칭 관계가 없습니다.",
      },
    };
  }

  const currentWeek = getCurrentWeekRange();
  const weeklyLogsTable = createWeeklyLogsTable(serviceClient);
  const { data: existingLog, error: existingLogError } = await weeklyLogsTable
    .select(
      "id, relationship_id, coachee_profile_id, week_start, week_end, gratitude, prayer_request, progress_summary, difficulty, message_to_coach, status, version, submitted_at, created_at, updated_at",
    )
    .eq("relationship_id", selectedRelationship.id)
    .eq("coachee_profile_id", me.data.profile.id)
    .eq("week_start", currentWeek.weekStart)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingLogError) {
    logServerError(
      "MY_WEEKLY_LOG_LOOKUP_FAILED",
      existingLogError.message ?? "Weekly log lookup failed.",
    );
    return {
      ok: false,
      error: {
        status: 500,
        code: "WEEKLY_LOG_LOOKUP_FAILED",
        message: "지금 주간 기록을 불러올 수 없습니다.",
      },
    };
  }

  const now = new Date().toISOString();
  const nextStatus: WeeklyLogStatus = intent;

  if (!existingLog) {
    const insertPayload: WeeklyLogInsert = {
      relationship_id: selectedRelationship.id,
      coachee_profile_id: me.data.profile.id,
      week_start: currentWeek.weekStart,
      week_end: currentWeek.weekEnd,
      gratitude: gratitude.value,
      prayer_request: prayerRequest.value,
      progress_summary: progressSummary.value,
      difficulty: difficulty.value,
      message_to_coach: messageToCoach.value,
      status: nextStatus,
      version: 1,
      submitted_at: nextStatus === "submitted" ? now : null,
      created_at: now,
      updated_at: now,
    };

    const { error: insertError } = await weeklyLogsTable
      .insert(insertPayload)
      .select(
        "id, relationship_id, coachee_profile_id, week_start, week_end, gratitude, prayer_request, progress_summary, difficulty, message_to_coach, status, version, submitted_at, created_at, updated_at",
      )
      .single();

    if (insertError) {
      logServerError(
        "MY_WEEKLY_LOG_CREATE_FAILED",
        insertError.message ?? "Weekly log create failed.",
      );
      return {
        ok: false,
        error: {
          status: 500,
        code: "WEEKLY_LOG_CREATE_FAILED",
          message: "지금 주간 기록을 저장할 수 없습니다.",
        },
      };
    }
  } else {
    const updatePayload: WeeklyLogUpdate = {
      gratitude: gratitude.value,
      prayer_request: prayerRequest.value,
      progress_summary: progressSummary.value,
      difficulty: difficulty.value,
      message_to_coach: messageToCoach.value,
      status: nextStatus,
      submitted_at: nextStatus === "submitted" ? now : null,
      version: existingLog.version + 1,
      updated_at: now,
    };

    const { error: updateError } = await weeklyLogsTable
      .update(updatePayload)
      .eq("id", existingLog.id)
      .eq("coachee_profile_id", me.data.profile.id)
      .is("deleted_at", null)
      .select(
        "id, relationship_id, coachee_profile_id, week_start, week_end, gratitude, prayer_request, progress_summary, difficulty, message_to_coach, status, version, submitted_at, created_at, updated_at",
      )
      .single();

    if (updateError) {
      logServerError(
        "MY_WEEKLY_LOG_UPDATE_FAILED",
        updateError.message ?? "Weekly log update failed.",
      );
      return {
        ok: false,
        error: {
          status: 500,
        code: "WEEKLY_LOG_UPDATE_FAILED",
          message: "지금 주간 기록을 저장할 수 없습니다.",
      },
    };
  }
  }

  return {
    ok: true,
    data: {
      relationshipId: selectedRelationship.id,
      status: nextStatus,
    },
  };
}
