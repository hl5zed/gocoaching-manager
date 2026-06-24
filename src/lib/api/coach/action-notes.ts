import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, ScopeType, UserRole } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTION_NOTE_TARGET_TYPES = [
  "coach",
  "team",
  "attention_target",
  "coachee",
  "church",
  "organization",
] as const;
export const ACTION_NOTE_ACTION_TYPES = [
  "contact_line",
  "coaching_encouragement",
  "team_leader_check",
  "next_meeting_check",
  "other",
] as const;
export const ACTION_NOTE_PRIORITIES = ["low", "normal", "high"] as const;
export const ACTION_NOTE_STATUSES = [
  "open",
  "in_progress",
  "completed",
  "archived",
] as const;

export type ActionNoteTargetType = (typeof ACTION_NOTE_TARGET_TYPES)[number];
export type ActionNoteActionType = (typeof ACTION_NOTE_ACTION_TYPES)[number];
export type ActionNotePriority = (typeof ACTION_NOTE_PRIORITIES)[number];
export type ActionNoteStatus = (typeof ACTION_NOTE_STATUSES)[number];

export type CoachActionNoteItem = {
  id: string;
  organization_id: string | null;
  church_id: string | null;
  coach_id: string | null;
  target_user_id: string | null;
  target_type: ActionNoteTargetType;
  target_name: string;
  team_id: string | null;
  team_name: string | null;
  region: string | null;
  action_type: ActionNoteActionType;
  priority: ActionNotePriority;
  status: ActionNoteStatus;
  note: string;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type CoachActionNoteReportItem = Pick<
  CoachActionNoteItem,
  | "id"
  | "target_type"
  | "target_name"
  | "team_name"
  | "action_type"
  | "priority"
  | "status"
  | "note"
  | "due_date"
  | "created_at"
>;

type CoachActionNoteInsert = {
  organization_id: string | null;
  church_id: string | null;
  coach_id: string | null;
  target_user_id: string | null;
  target_type: ActionNoteTargetType;
  target_name: string;
  team_id: string | null;
  team_name: string | null;
  region: string | null;
  action_type: ActionNoteActionType;
  priority: ActionNotePriority;
  status: ActionNoteStatus;
  note: string;
  due_date: string | null;
  created_by: string;
};

type CoachActionNoteUpdate = Partial<{
  note: string;
  action_type: ActionNoteActionType;
  priority: ActionNotePriority;
  status: ActionNoteStatus;
  due_date: string | null;
  team_name: string | null;
  region: string | null;
  completed_at: string;
  deleted_at: string;
  updated_at: string;
}>;

type QueryError = {
  code?: string;
  message?: string;
};

type QueryResult<TData> = Promise<{
  data: TData | null;
  error: QueryError | null;
}>;

type QueryListResult<TData> = Promise<{
  data: TData[] | null;
  error: QueryError | null;
}>;

type ActionNoteSelectBuilder = {
  eq: (column: string, value: string) => ActionNoteSelectBuilder;
  gte: (column: string, value: string) => ActionNoteSelectBuilder;
  ilike: (column: string, value: string) => ActionNoteSelectBuilder;
  is: (column: string, value: null) => ActionNoteSelectBuilder;
  lte: (column: string, value: string) => ActionNoteSelectBuilder;
  maybeSingle: () => QueryResult<CoachActionNoteItem>;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => ActionNoteSelectBuilder;
  range: (from: number, to: number) => QueryListResult<CoachActionNoteItem>;
};

type ActionNoteMutationFilter = {
  is: (column: string, value: null) => ActionNoteMutationFilter;
  select: (columns: string) => {
    maybeSingle: () => QueryResult<CoachActionNoteItem>;
  };
};

type ActionNotesTable = {
  select: (columns: string) => ActionNoteSelectBuilder;
  insert: (values: CoachActionNoteInsert) => {
    select: (columns: string) => {
      single: () => QueryResult<CoachActionNoteItem>;
    };
  };
  update: (values: CoachActionNoteUpdate) => {
    eq: (column: string, value: string) => ActionNoteMutationFilter;
  };
};

type ActionNotesClient = {
  from: (table: "coach_action_notes") => ActionNotesTable;
};

type ProfileScopeRow = {
  id: string;
  organization_id: string | null;
  church_id: string | null;
};

type ActiveRoleRow = {
  role: UserRole;
  scope_type: ScopeType;
  scope_id: string | null;
};

type ActionNotesFilters = {
  dueDate: string | null;
  from: string | null;
  limit: number;
  offset: number;
  page: number;
  priority: ActionNotePriority | null;
  region: string | null;
  status: ActionNoteStatus | null;
  targetType: ActionNoteTargetType | null;
  teamName: string | null;
  to: string | null;
};

export type ActionNotesAccessResult =
  | {
      ok: true;
      supabase: SupabaseClient<Database>;
      profile: ProfileScopeRow;
      roles: ActiveRoleRow[];
    }
  | {
      ok: false;
      status: 401 | 403;
      message: string;
    };

export type ActionNotesResult<TData> =
  | {
      ok: true;
      data: TData;
      pagination?: {
        limit: number;
        offset: number;
        page: number;
      };
    }
  | {
      ok: false;
      status: 400 | 401 | 403 | 404 | 500;
      message: string;
    };

const READ_ROLES: UserRole[] = [
  "super_admin",
  "organization_admin",
  "church_admin",
  "coach_maker",
  "coach",
];
const WRITE_ROLES: UserRole[] = [
  "super_admin",
  "organization_admin",
  "church_admin",
  "coach_maker",
  "coach",
];
const SAFE_SELECT =
  "id, organization_id, church_id, coach_id, target_user_id, target_type, target_name, team_id, team_name, region, action_type, priority, status, note, due_date, created_by, created_at, updated_at, completed_at";
const REPORT_SELECT =
  "id, target_type, target_name, team_name, action_type, priority, status, note, due_date, created_at";
const DEFAULT_ACTION_NOTES_LIMIT = 500;
const REPORT_ACTION_NOTES_LIMIT = 1000;
const MAX_ACTION_NOTES_LIMIT = 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getActionNotesTable(supabase: SupabaseClient<Database>) {
  return (supabase as unknown as ActionNotesClient).from("coach_action_notes");
}

function hasAllowedRole(roles: ActiveRoleRow[], allowedRoles: UserRole[]) {
  return roles.some((roleRow) => allowedRoles.includes(roleRow.role));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNullableText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeRequiredText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function normalizeOptionalUuid(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizePositiveInteger(value: string | null, fallback: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeLimit(value: string | null, fallback: number) {
  return Math.min(normalizePositiveInteger(value, fallback), MAX_ACTION_NOTES_LIMIT);
}

function normalizeStartOfDay(value: string | null) {
  const normalized = normalizeDate(value);
  return normalized ? `${normalized}T00:00:00.000Z` : null;
}

function normalizeEndOfDay(value: string | null) {
  const normalized = normalizeDate(value);
  return normalized ? `${normalized}T23:59:59.999Z` : null;
}

function normalizeIlikePattern(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return `%${trimmed.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

function isAllowedValue<TValue extends string>(
  value: string,
  allowedValues: readonly TValue[],
): value is TValue {
  return allowedValues.includes(value as TValue);
}

function getDerivedScopeId(
  roles: ActiveRoleRow[],
  role: UserRole,
  scopeType: ScopeType,
) {
  return (
    roles.find(
      (roleRow) =>
        roleRow.role === role &&
        roleRow.scope_type === scopeType &&
        roleRow.scope_id !== null,
    )?.scope_id ?? null
  );
}

function hasRoleName(roles: ActiveRoleRow[], role: UserRole) {
  return roles.some((roleRow) => roleRow.role === role);
}

function hasScopedRole(
  roles: ActiveRoleRow[],
  role: UserRole,
  scopeType: ScopeType,
  scopeId: string | null,
) {
  return (
    scopeId !== null &&
    roles.some(
      (roleRow) =>
        roleRow.role === role &&
        roleRow.scope_type === scopeType &&
        roleRow.scope_id === scopeId,
    )
  );
}

function isPermissionError(error: QueryError | null) {
  return error?.code === "42501" || error?.message?.includes("row-level security");
}

async function isActiveCoachForTarget(
  supabase: SupabaseClient<Database>,
  coachProfileId: string,
  targetProfileId: string | null,
) {
  if (!targetProfileId) {
    return false;
  }

  const { data, error } = await supabase
    .from("coaching_relationships")
    .select("id")
    .eq("coach_profile_id", coachProfileId)
    .eq("coachee_profile_id", targetProfileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[ACTION_NOTES_RELATIONSHIP_SCOPE_LOOKUP_FAILED]", error.message);
    return false;
  }

  return Boolean(data);
}

function hasManagerWriteRole(roles: ActiveRoleRow[]) {
  return hasAllowedRole(roles, [
    "super_admin",
    "organization_admin",
    "church_admin",
    "coach_maker",
  ]);
}

async function canCreateActionNote({
  access,
  note,
}: {
  access: Extract<ActionNotesAccessResult, { ok: true }>;
  note: CoachActionNoteInsert;
}) {
  if (hasManagerWriteRole(access.roles)) {
    return true;
  }

  if (!hasRoleName(access.roles, "coach")) {
    return false;
  }

  return isActiveCoachForTarget(
    access.supabase,
    access.profile.id,
    note.target_user_id,
  );
}

async function canSoftDeleteActionNote({
  access,
  note,
}: {
  access: Extract<ActionNotesAccessResult, { ok: true }>;
  note: CoachActionNoteItem;
}) {
  if (hasRoleName(access.roles, "super_admin")) {
    return true;
  }

  if (
    hasScopedRole(
      access.roles,
      "organization_admin",
      "organization",
      note.organization_id,
    )
  ) {
    return true;
  }

  if (hasScopedRole(access.roles, "church_admin", "church", note.church_id)) {
    return true;
  }

  if (
    hasRoleName(access.roles, "coach_maker") &&
    (note.created_by === access.profile.id ||
      note.coach_id === access.profile.id ||
      note.target_user_id === access.profile.id ||
      (await isActiveCoachForTarget(
        access.supabase,
        access.profile.id,
        note.target_user_id,
      )))
  ) {
    return true;
  }

  return note.created_by === access.profile.id;
}

export async function requireActionNotesAccess(
  mode: "read" | "write",
): Promise<ActionNotesAccessResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false,
      status: 401,
      message: "로그인이 필요합니다.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = supabase
    .from("profiles")
    .select("id, organization_id, church_id")
    .eq("status", "active")
    .is("deleted_at", null);

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      status: 403,
      message: "사용자 프로필을 확인할 수 없습니다.",
    };
  }

  const profileRecord = profile as ProfileScopeRow;
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, scope_type, scope_id")
    .eq("profile_id", profileRecord.id)
    .eq("status", "active")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (rolesError) {
    return {
      ok: false,
      status: 403,
      message: "권한 정보를 확인할 수 없습니다.",
    };
  }

  const activeRoles = (roles ?? []) as ActiveRoleRow[];
  const allowedRoles = mode === "read" ? READ_ROLES : WRITE_ROLES;

  if (!hasAllowedRole(activeRoles, allowedRoles)) {
    return {
      ok: false,
      status: 403,
      message: "권한이 없습니다.",
    };
  }

  return {
    ok: true,
    supabase,
    profile: profileRecord,
    roles: activeRoles,
  };
}

export function validateActionNotesFilters(searchParams: URLSearchParams):
  | {
      ok: true;
      filters: ActionNotesFilters;
    }
  | {
      ok: false;
      message: string;
    } {
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const targetType = searchParams.get("target_type");
  let normalizedStatus: ActionNoteStatus | null = null;
  let normalizedPriority: ActionNotePriority | null = null;
  let normalizedTargetType: ActionNoteTargetType | null = null;

  if (status && !isAllowedValue(status, ACTION_NOTE_STATUSES)) {
    return { ok: false, message: "허용되지 않은 상태값입니다." };
  }

  if (status) {
    normalizedStatus = status as ActionNoteStatus;
  }

  if (priority && !isAllowedValue(priority, ACTION_NOTE_PRIORITIES)) {
    return { ok: false, message: "허용되지 않은 우선순위입니다." };
  }

  if (priority) {
    normalizedPriority = priority as ActionNotePriority;
  }

  if (targetType && !isAllowedValue(targetType, ACTION_NOTE_TARGET_TYPES)) {
    return { ok: false, message: "허용되지 않은 대상 구분입니다." };
  }

  if (targetType) {
    normalizedTargetType = targetType as ActionNoteTargetType;
  }

  return {
    ok: true,
    filters: {
      dueDate: normalizeDate(searchParams.get("due_date")),
      from: normalizeDate(searchParams.get("from")),
      limit: normalizeLimit(searchParams.get("limit"), DEFAULT_ACTION_NOTES_LIMIT),
      offset: Math.max(0, normalizePositiveInteger(searchParams.get("offset"), 0)),
      page: normalizePositiveInteger(searchParams.get("page"), 1),
      status: normalizedStatus,
      priority: normalizedPriority,
      targetType: normalizedTargetType,
      teamName: normalizeNullableText(searchParams.get("team_name"), 120),
      to: normalizeDate(searchParams.get("to")),
      region: normalizeNullableText(searchParams.get("region"), 120),
    },
  };
}

function applyActionNotesFilters(
  query: ActionNoteSelectBuilder,
  filters: ActionNotesFilters,
) {
  let nextQuery = query;
  const { dueDate, from, priority, region, status, targetType, teamName, to } =
    filters;

  if (status) {
    nextQuery = nextQuery.eq("status", status);
  }

  if (priority) {
    nextQuery = nextQuery.eq("priority", priority);
  }

  if (targetType) {
    nextQuery = nextQuery.eq("target_type", targetType);
  }

  if (teamName) {
    nextQuery = nextQuery.ilike("team_name", normalizeIlikePattern(teamName) ?? teamName);
  }

  if (region) {
    nextQuery = nextQuery.ilike("region", normalizeIlikePattern(region) ?? region);
  }

  if (from) {
    nextQuery = nextQuery.gte("created_at", normalizeStartOfDay(from) ?? from);
  }

  if (to) {
    nextQuery = nextQuery.lte("created_at", normalizeEndOfDay(to) ?? to);
  }

  if (dueDate) {
    nextQuery = nextQuery.eq("due_date", dueDate);
  }

  return nextQuery;
}

export async function getCoachActionNotes(
  searchParams: URLSearchParams,
): Promise<ActionNotesResult<CoachActionNoteItem[]>> {
  const access = await requireActionNotesAccess("read");

  if (!access.ok) {
    return access;
  }

  const validatedFilters = validateActionNotesFilters(searchParams);

  if (!validatedFilters.ok) {
    return {
      ok: false,
      status: 400,
      message: validatedFilters.message,
    };
  }

  const table = getActionNotesTable(access.supabase);
  let query = table.select(SAFE_SELECT).is("deleted_at", null);
  const { limit, offset, page } = validatedFilters.filters;
  const rangeStart = searchParams.has("offset") ? offset : (page - 1) * limit;
  const rangeEnd = rangeStart + limit - 1;

  query = applyActionNotesFilters(query, validatedFilters.filters);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  if (error) {
    console.error("[ACTION_NOTES_LIST_FAILED]", error.message);
    return {
      ok: false,
      status: isPermissionError(error) ? 403 : 500,
      message: isPermissionError(error)
        ? "권한이 없습니다."
        : "관리 액션 메모를 조회하는 중 오류가 발생했습니다.",
    };
  }

  return {
    ok: true,
    data: data ?? [],
    pagination: {
      limit,
      offset: rangeStart,
      page,
    },
  };
}

export async function getCoachActionNotesForReport(
  searchParams: URLSearchParams,
): Promise<ActionNotesResult<CoachActionNoteReportItem[]>> {
  const access = await requireActionNotesAccess("read");

  if (!access.ok) {
    return access;
  }

  const validatedFilters = validateActionNotesFilters(searchParams);

  if (!validatedFilters.ok) {
    return {
      ok: false,
      status: 400,
      message: validatedFilters.message,
    };
  }

  const limit = normalizeLimit(searchParams.get("limit"), REPORT_ACTION_NOTES_LIMIT);
  const page = normalizePositiveInteger(searchParams.get("page"), 1);
  const offset = Math.max(0, normalizePositiveInteger(searchParams.get("offset"), 0));
  const rangeStart = searchParams.has("offset") ? offset : (page - 1) * limit;
  const rangeEnd = rangeStart + limit - 1;
  const table = getActionNotesTable(access.supabase);
  let query = table.select(REPORT_SELECT).is("deleted_at", null);

  query = applyActionNotesFilters(query, {
    ...validatedFilters.filters,
    limit,
    offset,
    page,
  });

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  if (error) {
    console.error("[ACTION_NOTES_REPORT_LIST_FAILED]", error.message);
    return {
      ok: false,
      status: isPermissionError(error) ? 403 : 500,
      message: isPermissionError(error)
        ? "권한이 없습니다."
        : "관리 액션 메모를 조회하는 중 오류가 발생했습니다.",
    };
  }

  return {
    ok: true,
    data: ((data ?? []) as unknown) as CoachActionNoteReportItem[],
    pagination: {
      limit,
      offset: rangeStart,
      page,
    },
  };
}

export function buildActionNoteInsert(
  input: unknown,
  access: Extract<ActionNotesAccessResult, { ok: true }>,
): ActionNotesResult<CoachActionNoteInsert> {
  if (!isRecord(input)) {
    return {
      ok: false,
      status: 400,
      message: "입력값 형식이 올바르지 않습니다.",
    };
  }

  const targetType = normalizeRequiredText(input.target_type, 60);
  const targetName = normalizeRequiredText(input.target_name, 160);
  const actionType = normalizeRequiredText(input.action_type, 80);
  const priority = normalizeRequiredText(input.priority, 20) || "normal";
  const note = normalizeRequiredText(input.note, 4000);

  if (!isAllowedValue(targetType, ACTION_NOTE_TARGET_TYPES)) {
    return { ok: false, status: 400, message: "허용되지 않은 대상 구분입니다." };
  }

  if (targetName.length === 0) {
    return { ok: false, status: 400, message: "대상 이름을 입력해 주세요." };
  }

  if (!isAllowedValue(actionType, ACTION_NOTE_ACTION_TYPES)) {
    return { ok: false, status: 400, message: "허용되지 않은 액션 유형입니다." };
  }

  if (!isAllowedValue(priority, ACTION_NOTE_PRIORITIES)) {
    return { ok: false, status: 400, message: "허용되지 않은 우선순위입니다." };
  }

  if (note.length === 0) {
    return { ok: false, status: 400, message: "메모 내용을 입력해 주세요." };
  }

  const organizationScopeId =
    getDerivedScopeId(access.roles, "organization_admin", "organization") ??
    access.profile.organization_id;
  const churchScopeId =
    getDerivedScopeId(access.roles, "church_admin", "church") ??
    access.profile.church_id;
  const dueDate = normalizeDate(input.due_date);

  const normalizedCoachId = normalizeOptionalUuid(input.coach_id);
  const coachId =
    !hasManagerWriteRole(access.roles) && hasRoleName(access.roles, "coach")
      ? access.profile.id
      : normalizedCoachId;

  return {
    ok: true,
    data: {
      organization_id: organizationScopeId,
      church_id: churchScopeId,
      coach_id: coachId,
      target_user_id: normalizeOptionalUuid(input.target_user_id),
      target_type: targetType,
      target_name: targetName,
      team_id: normalizeOptionalUuid(input.team_id),
      team_name: normalizeNullableText(input.team_name, 120),
      region: normalizeNullableText(input.region, 120),
      action_type: actionType,
      priority,
      status: "open",
      note,
      due_date: dueDate,
      created_by: access.profile.id,
    },
  };
}

export async function createCoachActionNote(
  input: unknown,
): Promise<ActionNotesResult<CoachActionNoteItem>> {
  const access = await requireActionNotesAccess("write");

  if (!access.ok) {
    return access;
  }

  const insertValues = buildActionNoteInsert(input, access);

  if (!insertValues.ok) {
    return insertValues;
  }

  const canCreate = await canCreateActionNote({
    access,
    note: insertValues.data,
  });

  if (!canCreate) {
    return {
      ok: false,
      status: 403,
      message: "배정된 코치이에게만 내부 관리 메모를 작성할 수 있습니다.",
    };
  }

  const shouldUseAdminMutationClient =
    hasRoleName(access.roles, "coach") && !hasManagerWriteRole(access.roles);
  const adminClientResult = shouldUseAdminMutationClient
    ? createSupabaseAdminClient()
    : null;

  if (shouldUseAdminMutationClient && !adminClientResult?.client) {
    console.error("[ACTION_NOTES_CREATE_SERVICE_CLIENT_MISSING]", adminClientResult?.error);
    return {
      ok: false,
      status: 500,
      message: "관리 액션 메모를 생성하는 중 오류가 발생했습니다.",
    };
  }

  const table = getActionNotesTable(adminClientResult?.client ?? access.supabase);
  const { data, error } = await table
    .insert(insertValues.data)
    .select(SAFE_SELECT)
    .single();

  if (error || !data) {
    console.error("[ACTION_NOTES_CREATE_FAILED]", error?.message);
    return {
      ok: false,
      status: isPermissionError(error) ? 403 : 500,
      message: isPermissionError(error)
        ? "권한이 없습니다."
        : "관리 액션 메모를 생성하는 중 오류가 발생했습니다.",
    };
  }

  return {
    ok: true,
    data,
  };
}

export function buildActionNoteUpdate(
  input: unknown,
): ActionNotesResult<CoachActionNoteUpdate> {
  if (!isRecord(input)) {
    return {
      ok: false,
      status: 400,
      message: "입력값 형식이 올바르지 않습니다.",
    };
  }

  const updateValues: CoachActionNoteUpdate = {};

  if ("note" in input) {
    const note = normalizeRequiredText(input.note, 4000);

    if (note.length === 0) {
      return { ok: false, status: 400, message: "메모 내용을 입력해 주세요." };
    }

    updateValues.note = note;
  }

  if ("action_type" in input) {
    const actionType = normalizeRequiredText(input.action_type, 80);

    if (!isAllowedValue(actionType, ACTION_NOTE_ACTION_TYPES)) {
      return { ok: false, status: 400, message: "허용되지 않은 액션 유형입니다." };
    }

    updateValues.action_type = actionType;
  }

  if ("priority" in input) {
    const priority = normalizeRequiredText(input.priority, 20);

    if (!isAllowedValue(priority, ACTION_NOTE_PRIORITIES)) {
      return { ok: false, status: 400, message: "허용되지 않은 우선순위입니다." };
    }

    updateValues.priority = priority;
  }

  if ("status" in input) {
    const status = normalizeRequiredText(input.status, 30);

    if (!isAllowedValue(status, ACTION_NOTE_STATUSES)) {
      return { ok: false, status: 400, message: "허용되지 않은 상태값입니다." };
    }

    updateValues.status = status;

    if (status === "completed") {
      updateValues.completed_at = new Date().toISOString();
    }
  }

  if ("due_date" in input) {
    updateValues.due_date = normalizeDate(input.due_date);
  }

  if ("team_name" in input) {
    updateValues.team_name = normalizeNullableText(input.team_name, 120);
  }

  if ("region" in input) {
    updateValues.region = normalizeNullableText(input.region, 120);
  }

  if (Object.keys(updateValues).length === 0) {
    return {
      ok: false,
      status: 400,
      message: "변경할 값이 없습니다.",
    };
  }

  return {
    ok: true,
    data: updateValues,
  };
}

export async function updateCoachActionNote(
  id: string,
  input: unknown,
): Promise<ActionNotesResult<CoachActionNoteItem>> {
  if (!UUID_PATTERN.test(id)) {
    return { ok: false, status: 400, message: "메모 ID가 올바르지 않습니다." };
  }

  const access = await requireActionNotesAccess("write");

  if (!access.ok) {
    return access;
  }

  const updateValues = buildActionNoteUpdate(input);

  if (!updateValues.ok) {
    return updateValues;
  }

  const table = getActionNotesTable(access.supabase);
  const { data, error } = await table
    .update(updateValues.data)
    .eq("id", id)
    .is("deleted_at", null)
    .select(SAFE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[ACTION_NOTES_UPDATE_FAILED]", error.message);
    return {
      ok: false,
      status: isPermissionError(error) ? 403 : 500,
      message: isPermissionError(error)
        ? "권한이 없습니다."
        : "관리 액션 메모를 수정하는 중 오류가 발생했습니다.",
    };
  }

  if (!data) {
    return { ok: false, status: 404, message: "메모를 찾을 수 없습니다." };
  }

  return {
    ok: true,
    data,
  };
}

export async function softDeleteCoachActionNote(
  id: string,
): Promise<ActionNotesResult<CoachActionNoteItem>> {
  if (!UUID_PATTERN.test(id)) {
    return { ok: false, status: 400, message: "메모 ID가 올바르지 않습니다." };
  }

  const access = await requireActionNotesAccess("read");

  if (!access.ok) {
    console.error("[ACTION_NOTES_DELETE_ACCESS_FAILED]", access.message);
    return access;
  }

  const adminClientResult = createSupabaseAdminClient();

  if (!adminClientResult.client) {
    console.error("[ACTION_NOTES_DELETE_SERVICE_CLIENT_MISSING]", adminClientResult.error);
    return {
      ok: false,
      status: 500,
      message: "관리 액션 메모 처리에 실패했습니다.",
    };
  }

  const adminTable = getActionNotesTable(adminClientResult.client);
  const { data: note, error: lookupError } = await adminTable
    .select(SAFE_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookupError) {
    console.error("[ACTION_NOTES_DELETE_LOOKUP_FAILED]", lookupError.message);
    return {
      ok: false,
      status: 500,
      message: "관리 액션 메모 처리에 실패했습니다.",
    };
  }

  if (!note) {
    console.error("[ACTION_NOTES_DELETE_NOT_FOUND]", id);
    return {
      ok: false,
      status: 404,
      message: "관리 액션 메모를 찾을 수 없습니다.",
    };
  }

  const canDelete = await canSoftDeleteActionNote({ access, note });

  if (!canDelete) {
    console.error("[ACTION_NOTES_DELETE_FORBIDDEN]", {
      noteId: id,
      profileId: access.profile.id,
    });
    return {
      ok: false,
      status: 403,
      message: "이 관리 액션 메모를 제거할 권한이 없습니다.",
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await adminTable
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select(SAFE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[ACTION_NOTES_DELETE_UPDATE_FAILED]", error.message);
    return {
      ok: false,
      status: 500,
      message: "관리 액션 메모 처리에 실패했습니다.",
    };
  }

  if (!data) {
    console.error("[ACTION_NOTES_DELETE_UPDATE_NOT_FOUND]", id);
    return {
      ok: false,
      status: 404,
      message: "관리 액션 메모를 찾을 수 없습니다.",
    };
  }

  return {
    ok: true,
    data,
  };
}
