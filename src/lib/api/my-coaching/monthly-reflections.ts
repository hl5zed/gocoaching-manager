import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  MonthlyReflectionInsert,
  MonthlyReflectionRow,
  MonthlyReflectionUpdate,
  PersonalRecordStatus,
  PersonalRecordVisibility,
} from "@/types/database";

export const MONTHLY_REFLECTION_STATUSES = [
  "draft",
  "submitted",
  "reviewed",
] as const satisfies readonly PersonalRecordStatus[];
export const MONTHLY_REFLECTION_VISIBILITIES = [
  "private",
  "coach",
] as const satisfies readonly PersonalRecordVisibility[];

export type MonthlyReflectionItem = Pick<
  MonthlyReflectionRow,
  | "id"
  | "year"
  | "month"
  | "summary"
  | "growth_points"
  | "difficulty"
  | "next_month_plan"
  | "visibility"
  | "shared_with_coach"
  | "status"
  | "submitted_at"
  | "reviewed_at"
  | "created_at"
  | "updated_at"
>;

export type MonthlyReflectionResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      status: 400 | 401 | 403 | 404 | 409 | 500;
      message: string;
    };

type CurrentProfileResult =
  | {
      ok: true;
      profileId: string;
    }
  | {
      ok: false;
      status: 401 | 404 | 500;
      message: string;
    };

type QueryError = {
  code?: string;
  details?: string;
  message?: string;
};

type QueryResult<TData> = Promise<{
  data: TData | null;
  error: QueryError | null;
}>;

type ProfileSelectChain = {
  eq: (column: "auth_user_id", value: string) => ProfileSelectChain;
  neq: (column: "status", value: "anonymized") => ProfileSelectChain;
  is: (
    column: "deleted_at",
    value: null,
  ) => {
    maybeSingle: () => QueryResult<{ id: string }>;
  };
};

type ProfilesTable = {
  select: (columns: "id") => ProfileSelectChain;
};

type ProfilesClient = {
  from: (table: "profiles") => ProfilesTable;
};

type MonthlyReflectionsSelectQuery = PromiseLike<{
  data: Record<string, unknown>[] | null;
  error: QueryError | null;
}> & {
  eq: (column: string, value: string | number) => MonthlyReflectionsSelectQuery;
  ilike: (column: string, value: string) => MonthlyReflectionsSelectQuery;
  is: (column: "deleted_at", value: null) => MonthlyReflectionsSelectQuery;
  limit: (count: number) => MonthlyReflectionsSelectQuery;
  or: (filters: string) => MonthlyReflectionsSelectQuery;
  order: (
    column: "year" | "month" | "created_at",
    options: { ascending: boolean },
  ) => MonthlyReflectionsSelectQuery;
  maybeSingle: () => QueryResult<Record<string, unknown>>;
};

type MonthlyReflectionsUpdateFilter = {
  eq: (column: string, value: string) => MonthlyReflectionsUpdateFilter;
  is: (column: "deleted_at", value: null) => {
    select: (columns: typeof SAFE_SELECT) => {
      maybeSingle: () => QueryResult<MonthlyReflectionItem>;
    };
  };
};

type MonthlyReflectionsTable = {
  select: (columns: string) => MonthlyReflectionsSelectQuery;
  insert: (values: MonthlyReflectionInsert) => {
    select: (columns: typeof SAFE_SELECT) => {
      single: () => QueryResult<MonthlyReflectionItem>;
    };
  };
  update: (values: MonthlyReflectionUpdate) => {
    eq: (column: string, value: string) => MonthlyReflectionsUpdateFilter;
  };
};

type MonthlyReflectionsClient = {
  from: (table: "monthly_reflections") => MonthlyReflectionsTable;
};

const SAFE_SELECT =
  "id, year, month, summary, growth_points, difficulty, next_month_plan, visibility, shared_with_coach, status, submitted_at, reviewed_at, created_at, updated_at";
const MAX_RECORDS_LIMIT = 500;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 4000;
const PATCH_ALLOWED_FIELDS = [
  "year",
  "month",
  "summary",
  "growth_points",
  "difficulty",
  "next_month_plan",
  "visibility",
  "shared_with_coach",
  "status",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  return null;
}

function normalizeYear(value: unknown) {
  const year = normalizeInteger(value);
  return year !== null && year >= 2000 && year <= 2100 ? year : null;
}

function normalizeMonth(value: unknown) {
  const month = normalizeInteger(value);
  return month !== null && month >= 1 && month <= 12 ? month : null;
}

function normalizePositiveInteger(value: string | null) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0
    ? Math.min(numeric, MAX_RECORDS_LIMIT)
    : null;
}

function buildIlikePattern(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || /[(),]/.test(trimmed)) return null;
  return `%${trimmed.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

function normalizeNullableText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function isAllowedValue<TValue extends string>(
  value: string,
  allowedValues: readonly TValue[],
): value is TValue {
  return allowedValues.includes(value as TValue);
}

function normalizeVisibility(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "private" as const;
  }

  const normalized = value.trim();
  return isAllowedValue(normalized, MONTHLY_REFLECTION_VISIBILITIES)
    ? normalized
    : null;
}

function normalizeStatus(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "draft" as const;
  }

  const normalized = value.trim();
  return isAllowedValue(normalized, MONTHLY_REFLECTION_STATUSES)
    ? normalized
    : null;
}

function normalizeOptionalStatus(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return isAllowedValue(normalized, MONTHLY_REFLECTION_STATUSES)
    ? normalized
    : null;
}

function normalizeOptionalVisibility(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return isAllowedValue(normalized, MONTHLY_REFLECTION_VISIBILITIES)
    ? normalized
    : null;
}

function normalizeOptionalTimestamp(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isDuplicateError(error: QueryError | null) {
  return error?.code === "23505";
}

function logInvalidMonthlyReflectionInput(
  phase: "create" | "update",
  input: Record<string, unknown>,
) {
  console.warn("[MONTHLY_REFLECTION_INVALID_INPUT]", {
    phase,
    year: input.year,
    month: input.month,
    visibility: input.visibility,
    status: input.status,
  });
}

function logMonthlyReflectionBadRequest(
  phase: "patch" | "delete",
  reason: string,
  metadata?: Record<string, unknown>,
) {
  console.warn("[MONTHLY_REFLECTION_BAD_REQUEST]", {
    phase,
    reason,
    ...metadata,
  });
}

function getProfilesClient(supabase: unknown) {
  return supabase as ProfilesClient;
}

function getMonthlyReflectionsTable(supabase: unknown) {
  return (supabase as MonthlyReflectionsClient).from("monthly_reflections");
}

async function getCurrentProfile(): Promise<CurrentProfileResult> {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false,
      status: 401,
      message: "로그인이 필요합니다.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await getProfilesClient(supabase)
    .from("profiles")
    .select("id")
    .eq("auth_user_id", session.user.id)
    .neq("status", "anonymized")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[MONTHLY_REFLECTION_PROFILE_QUERY_FAILED]", error.message);
    return {
      ok: false,
      status: 500,
      message: "월간 회고 처리 중 오류가 발생했습니다.",
    };
  }

  if (!profile) {
    return {
      ok: false,
      status: 404,
      message: "현재 로그인 사용자의 프로필을 찾을 수 없습니다.",
    };
  }

  return {
    ok: true,
    profileId: profile.id,
  };
}

export async function getMonthlyReflections(
  searchParams: URLSearchParams,
): Promise<MonthlyReflectionResult<MonthlyReflectionItem[]>> {
  const currentProfile = await getCurrentProfile();

  if (!currentProfile.ok) {
    return currentProfile;
  }

  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const status = searchParams.get("status");
  const visibility = searchParams.get("visibility");
  const search = searchParams.get("q");
  const limit = normalizePositiveInteger(searchParams.get("limit"));
  const year = yearParam ? normalizeYear(yearParam) : null;
  const month = monthParam ? normalizeMonth(monthParam) : null;

  if ((yearParam && !year) || (monthParam && !month)) {
    return {
      ok: false,
      status: 400,
      message: "입력값을 확인해 주세요.",
    };
  }

  if (status && !isAllowedValue(status, MONTHLY_REFLECTION_STATUSES)) {
    return {
      ok: false,
      status: 400,
      message: "입력값을 확인해 주세요.",
    };
  }

  if (visibility && !isAllowedValue(visibility, MONTHLY_REFLECTION_VISIBILITIES)) {
    return {
      ok: false,
      status: 400,
      message: "입력값을 확인해 주세요.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const monthlyReflectionsTable = getMonthlyReflectionsTable(supabase);
  let query = monthlyReflectionsTable
    .select(SAFE_SELECT)
    .eq("profile_id", currentProfile.profileId)
    .is("deleted_at", null);

  if (year) {
    query = query.eq("year", year);
  }

  if (month) {
    query = query.eq("month", month);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (visibility) {
    query = query.eq("visibility", visibility);
  }

  const searchPattern = buildIlikePattern(search);
  if (searchPattern) {
    query = query.or(
      [
        `summary.ilike.${searchPattern}`,
        `growth_points.ilike.${searchPattern}`,
        `difficulty.ilike.${searchPattern}`,
        `next_month_plan.ilike.${searchPattern}`,
      ].join(","),
    );
  }

  let orderedQuery = query
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("created_at", { ascending: false });

  if (limit) {
    orderedQuery = orderedQuery.limit(limit);
  }

  const { data, error } = await orderedQuery;

  if (error) {
    console.error("[MONTHLY_REFLECTION_LIST_FAILED]", error.message);
    return {
      ok: false,
      status: 500,
      message: "월간 회고 처리 중 오류가 발생했습니다.",
    };
  }

  return {
    ok: true,
    data: (data ?? []) as MonthlyReflectionItem[],
  };
}

export async function createMonthlyReflection(
  input: unknown,
): Promise<MonthlyReflectionResult<MonthlyReflectionItem>> {
  const currentProfile = await getCurrentProfile();

  if (!currentProfile.ok) {
    return currentProfile;
  }

  if (!isRecord(input)) {
    return {
      ok: false,
      status: 400,
      message: "입력값을 확인해 주세요.",
    };
  }

  const year = normalizeYear(input.year);
  const month = normalizeMonth(input.month);
  const visibility = normalizeVisibility(input.visibility);
  const status = normalizeStatus(input.status);

  if (!year) {
    logInvalidMonthlyReflectionInput("create", input);
    return {
      ok: false,
      status: 400,
      message: "연도를 선택해 주세요.",
    };
  }

  if (!month) {
    logInvalidMonthlyReflectionInput("create", input);
    return {
      ok: false,
      status: 400,
      message: "월을 선택해 주세요.",
    };
  }

  if (!visibility || !status) {
    logInvalidMonthlyReflectionInput("create", input);
    return {
      ok: false,
      status: 400,
      message: "공유 상태 또는 저장 상태를 확인해 주세요.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const monthlyReflectionsTable = getMonthlyReflectionsTable(supabase);
  const { data: existing, error: existingError } = await monthlyReflectionsTable
    .select("id")
    .eq("profile_id", currentProfile.profileId)
    .eq("year", year)
    .eq("month", month)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    console.error(
      "[MONTHLY_REFLECTION_DUPLICATE_CHECK_FAILED]",
      existingError.message,
    );
    return {
      ok: false,
      status: 500,
      message: "월간 회고 처리 중 오류가 발생했습니다.",
    };
  }

  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "이미 해당 월의 회고 기록이 있습니다. 기존 기록을 수정해 주세요.",
    };
  }

  const now = new Date().toISOString();
  const payload: MonthlyReflectionInsert = {
    profile_id: currentProfile.profileId,
    year,
    month,
    summary: normalizeNullableText(input.summary, MAX_TEXT_LENGTH),
    growth_points: normalizeNullableText(input.growth_points, MAX_TEXT_LENGTH),
    difficulty: normalizeNullableText(input.difficulty, MAX_TEXT_LENGTH),
    next_month_plan: normalizeNullableText(
      input.next_month_plan,
      MAX_TEXT_LENGTH,
    ),
    visibility,
    shared_with_coach: visibility === "coach",
    status,
    submitted_at: status === "submitted" ? now : null,
    reviewed_at: status === "reviewed" ? now : null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await monthlyReflectionsTable
    .insert(payload)
    .select(SAFE_SELECT)
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      return {
        ok: false,
        status: 409,
        message:
          "이미 해당 월의 회고 기록이 있습니다. 기존 기록을 수정해 주세요.",
      };
    }

    console.error("[MONTHLY_REFLECTION_CREATE_FAILED]", error.message);
    return {
      ok: false,
      status: 500,
      message: "월간 회고 처리 중 오류가 발생했습니다.",
    };
  }

  return {
    ok: true,
    data: data as MonthlyReflectionItem,
  };
}

export async function updateMonthlyReflection(
  id: string,
  input: unknown,
): Promise<MonthlyReflectionResult<MonthlyReflectionItem>> {
  const currentProfile = await getCurrentProfile();

  if (!currentProfile.ok) {
    return currentProfile;
  }

  if (!UUID_PATTERN.test(id)) {
    logMonthlyReflectionBadRequest("patch", "invalid id", { id });
    return {
      ok: false,
      status: 400,
      message: "월간 회고 ID를 확인할 수 없습니다.",
    };
  }

  if (!isRecord(input)) {
    logMonthlyReflectionBadRequest("patch", "invalid patch body", { id });
    return {
      ok: false,
      status: 400,
      message: "수정 입력값을 확인해 주세요.",
    };
  }

  const hasPatchField = PATCH_ALLOWED_FIELDS.some((field) =>
    Object.hasOwn(input, field),
  );

  if (!hasPatchField) {
    logMonthlyReflectionBadRequest("patch", "empty patch body", { id });
    return {
      ok: false,
      status: 400,
      message: "수정할 내용이 없습니다.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const monthlyReflectionsTable = getMonthlyReflectionsTable(supabase);
  const { data: existing, error: existingError } = await monthlyReflectionsTable
    .select("id, profile_id, year, month, status, submitted_at, reviewed_at")
    .eq("id", id)
    .eq("profile_id", currentProfile.profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    console.error("[MONTHLY_REFLECTION_LOOKUP_FAILED]", existingError.message);
    return {
      ok: false,
      status: 500,
      message: "월간 회고 처리 중 오류가 발생했습니다.",
    };
  }

  if (!existing) {
    return {
      ok: false,
      status: 404,
      message: "월간 회고를 찾을 수 없습니다.",
    };
  }

  const updatePayload: MonthlyReflectionUpdate = {
    updated_at: new Date().toISOString(),
  };
  const nextYear = Object.hasOwn(input, "year")
    ? normalizeYear(input.year)
    : (existing.year as number);
  const nextMonth = Object.hasOwn(input, "month")
    ? normalizeMonth(input.month)
    : (existing.month as number);

  if (!nextYear || !nextMonth) {
    logMonthlyReflectionBadRequest(
      "patch",
      !nextYear ? "invalid year" : "invalid month",
      {
        id,
        month: input.month,
        year: input.year,
      },
    );
    return {
      ok: false,
      status: 400,
      message: !nextYear ? "연도를 선택해 주세요." : "월을 선택해 주세요.",
    };
  }

  if (Object.hasOwn(input, "year")) {
    updatePayload.year = nextYear;
  }

  if (Object.hasOwn(input, "month")) {
    updatePayload.month = nextMonth;
  }

  if (nextYear !== existing.year || nextMonth !== existing.month) {
    const { data: duplicate, error: duplicateError } =
      await monthlyReflectionsTable
        .select("id")
        .eq("profile_id", currentProfile.profileId)
        .eq("year", nextYear)
        .eq("month", nextMonth)
        .is("deleted_at", null)
        .maybeSingle();

    if (duplicateError) {
      console.error(
        "[MONTHLY_REFLECTION_UPDATE_DUPLICATE_CHECK_FAILED]",
        duplicateError.message,
      );
      return {
        ok: false,
        status: 500,
        message: "월간 회고 처리 중 오류가 발생했습니다.",
      };
    }

    if (duplicate) {
      logMonthlyReflectionBadRequest("patch", "duplicate year/month", {
        id,
        month: nextMonth,
        year: nextYear,
      });
      return {
        ok: false,
        status: 409,
        message:
          "이미 해당 월의 회고 기록이 있습니다. 기존 기록을 수정해 주세요.",
      };
    }
  }

  if (Object.hasOwn(input, "summary")) {
    updatePayload.summary = normalizeNullableText(input.summary, MAX_TEXT_LENGTH);
  }

  if (Object.hasOwn(input, "growth_points")) {
    updatePayload.growth_points = normalizeNullableText(
      input.growth_points,
      MAX_TEXT_LENGTH,
    );
  }

  if (Object.hasOwn(input, "difficulty")) {
    updatePayload.difficulty = normalizeNullableText(
      input.difficulty,
      MAX_TEXT_LENGTH,
    );
  }

  if (Object.hasOwn(input, "next_month_plan")) {
    updatePayload.next_month_plan = normalizeNullableText(
      input.next_month_plan,
      MAX_TEXT_LENGTH,
    );
  }

  if (Object.hasOwn(input, "visibility")) {
    const visibility = normalizeOptionalVisibility(input.visibility);
    if (!visibility) {
      logMonthlyReflectionBadRequest("patch", "invalid visibility", {
        id,
        visibility: input.visibility,
      });
      return {
        ok: false,
        status: 400,
        message: "공유 상태 또는 저장 상태를 확인해 주세요.",
      };
    }
    updatePayload.visibility = visibility;
    updatePayload.shared_with_coach = visibility === "coach";
  }

  if (
    Object.hasOwn(input, "shared_with_coach") &&
    !Object.hasOwn(input, "visibility")
  ) {
    if (typeof input.shared_with_coach !== "boolean") {
      logMonthlyReflectionBadRequest("patch", "invalid shared_with_coach", {
        id,
        shared_with_coach: input.shared_with_coach,
      });
      return {
        ok: false,
        status: 400,
        message: "공유 상태 또는 저장 상태를 확인해 주세요.",
      };
    }
    updatePayload.shared_with_coach = input.shared_with_coach;
  }

  const hasStatusChange = Object.hasOwn(input, "status");
  let nextStatus: PersonalRecordStatus | undefined;

  if (hasStatusChange) {
    const status = normalizeOptionalStatus(input.status);
    if (!status) {
      logMonthlyReflectionBadRequest("patch", "invalid status", {
        id,
        status: input.status,
      });
      return {
        ok: false,
        status: 400,
        message: "공유 상태 또는 저장 상태를 확인해 주세요.",
      };
    }
    nextStatus = status;
    updatePayload.status = status;
  }

  if (nextStatus === "submitted") {
    updatePayload.submitted_at = new Date().toISOString();
  } else if (nextStatus === "reviewed") {
    updatePayload.reviewed_at = new Date().toISOString();
  } else if (nextStatus === "draft") {
    updatePayload.submitted_at = null;
    updatePayload.reviewed_at = null;
  } else {
    if (Object.hasOwn(input, "submitted_at")) {
      const submittedAt = normalizeOptionalTimestamp(input.submitted_at);
      if (submittedAt === undefined) {
        return {
          ok: false,
          status: 400,
          message: "입력값을 확인해 주세요.",
        };
      }
      updatePayload.submitted_at = submittedAt;
    }

    if (Object.hasOwn(input, "reviewed_at")) {
      const reviewedAt = normalizeOptionalTimestamp(input.reviewed_at);
      if (reviewedAt === undefined) {
        return {
          ok: false,
          status: 400,
          message: "입력값을 확인해 주세요.",
        };
      }
      updatePayload.reviewed_at = reviewedAt;
    }
  }

  const { data, error } = await monthlyReflectionsTable
    .update(updatePayload)
    .eq("id", id)
    .eq("profile_id", currentProfile.profileId)
    .is("deleted_at", null)
    .select(SAFE_SELECT)
    .maybeSingle();

  if (error) {
    if (isDuplicateError(error)) {
      return {
        ok: false,
        status: 409,
        message:
          "이미 해당 월의 회고 기록이 있습니다. 기존 기록을 수정해 주세요.",
      };
    }

    console.error("[MONTHLY_REFLECTION_UPDATE_FAILED]", error.message);
    return {
      ok: false,
      status: 500,
      message: "월간 회고 처리 중 오류가 발생했습니다.",
    };
  }

  if (!data) {
    return {
      ok: false,
      status: 404,
      message: "월간 회고를 찾을 수 없습니다.",
    };
  }

  return {
    ok: true,
    data: data as MonthlyReflectionItem,
  };
}

export async function softDeleteMonthlyReflection(
  id: string,
): Promise<MonthlyReflectionResult<MonthlyReflectionItem>> {
  const currentProfile = await getCurrentProfile();

  if (!currentProfile.ok) {
    return currentProfile;
  }

  if (!UUID_PATTERN.test(id)) {
    logMonthlyReflectionBadRequest("delete", "invalid id", { id });
    return {
      ok: false,
      status: 400,
      message: "월간 회고 ID를 확인할 수 없습니다.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const monthlyReflectionsTable = getMonthlyReflectionsTable(supabase);
  const { data, error } = await monthlyReflectionsTable
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("profile_id", currentProfile.profileId)
    .is("deleted_at", null)
    .select(SAFE_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[MONTHLY_REFLECTION_SOFT_DELETE_FAILED]", {
      code: error.code,
      details: error.details,
      message: error.message,
    });
    return {
      ok: false,
      status: 500,
      message: "월간 회고 처리에 실패했습니다.",
    };
  }

  if (!data) {
    return {
      ok: false,
      status: 404,
      message: "월간 회고를 찾을 수 없습니다.",
    };
  }

  return {
    ok: true,
    data: data as MonthlyReflectionItem,
  };
}
