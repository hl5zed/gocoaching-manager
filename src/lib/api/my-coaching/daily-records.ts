import { getSession } from "@/lib/auth/getSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DailyRecordInsert,
  DailyRecordRow,
  DailyRecordUpdate,
  PersonalRecordStatus,
  PersonalRecordVisibility,
} from "@/types/database";

export const DAILY_RECORD_STATUSES = [
  "draft",
  "submitted",
  "reviewed",
] as const satisfies readonly PersonalRecordStatus[];
export const DAILY_RECORD_VISIBILITIES = [
  "private",
  "coach",
] as const satisfies readonly PersonalRecordVisibility[];

export type DailyRecordItem = Pick<
  DailyRecordRow,
  | "id"
  | "record_date"
  | "title"
  | "reflection"
  | "practice"
  | "prayer_request"
  | "visibility"
  | "shared_with_coach"
  | "status"
  | "submitted_at"
  | "created_at"
  | "updated_at"
>;

export type DailyRecordResult<TData> =
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

type DailyRecordsSelectQuery = PromiseLike<{
  data: Record<string, unknown>[] | null;
  error: QueryError | null;
}> & {
  eq: (column: string, value: string) => DailyRecordsSelectQuery;
  is: (column: "deleted_at", value: null) => DailyRecordsSelectQuery;
  gte: (column: "record_date", value: string) => DailyRecordsSelectQuery;
  lte: (column: "record_date", value: string) => DailyRecordsSelectQuery;
  order: (
    column: "record_date" | "created_at",
    options: { ascending: boolean },
  ) => DailyRecordsSelectQuery;
  maybeSingle: () => QueryResult<Record<string, unknown>>;
};

type DailyRecordsUpdateFilter = {
  eq: (column: string, value: string) => DailyRecordsUpdateFilter;
  is: (column: "deleted_at", value: null) => {
    select: (columns: typeof SAFE_SELECT) => {
      maybeSingle: () => QueryResult<DailyRecordItem>;
    };
  };
};

type DailyRecordsTable = {
  select: (columns: string) => DailyRecordsSelectQuery;
  insert: (values: DailyRecordInsert) => {
    select: (columns: typeof SAFE_SELECT) => {
      single: () => QueryResult<DailyRecordItem>;
    };
  };
  update: (values: DailyRecordUpdate) => {
    eq: (column: string, value: string) => DailyRecordsUpdateFilter;
  };
};

type DailyRecordsClient = {
  from: (table: "daily_records") => DailyRecordsTable;
};

const SAFE_SELECT =
  "id, record_date, title, reflection, practice, prayer_request, visibility, shared_with_coach, status, submitted_at, created_at, updated_at";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 120;
const MAX_TEXT_LENGTH = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return isValidDate(trimmed) ? trimmed : null;
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
  return isAllowedValue(normalized, DAILY_RECORD_VISIBILITIES)
    ? normalized
    : null;
}

function normalizeStatus(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "draft" as const;
  }

  const normalized = value.trim();
  return isAllowedValue(normalized, DAILY_RECORD_STATUSES) ? normalized : null;
}

function normalizeOptionalStatus(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return isAllowedValue(normalized, DAILY_RECORD_STATUSES) ? normalized : null;
}

function normalizeOptionalVisibility(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return isAllowedValue(normalized, DAILY_RECORD_VISIBILITIES)
    ? normalized
    : null;
}

function normalizeOptionalSubmittedAt(value: unknown) {
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

function getProfilesClient(supabase: unknown) {
  return supabase as ProfilesClient;
}

function getDailyRecordsTable(supabase: unknown) {
  return (supabase as DailyRecordsClient).from("daily_records");
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
    console.error("[DAILY_RECORD_PROFILE_QUERY_FAILED]", error.message);
    return {
      ok: false,
      status: 500,
      message: "하루 기록 처리 중 오류가 발생했습니다.",
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

export async function getDailyRecords(
  searchParams: URLSearchParams,
): Promise<DailyRecordResult<DailyRecordItem[]>> {
  const currentProfile = await getCurrentProfile();

  if (!currentProfile.ok) {
    return currentProfile;
  }

  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");

  const normalizedDate = date ? normalizeDate(date) : null;
  const normalizedFrom = from ? normalizeDate(from) : null;
  const normalizedTo = to ? normalizeDate(to) : null;

  if (
    (date && !normalizedDate) ||
    (from && !normalizedFrom) ||
    (to && !normalizedTo)
  ) {
    return {
      ok: false,
      status: 400,
      message: "입력값을 확인해 주세요.",
    };
  }

  if (status && !isAllowedValue(status, DAILY_RECORD_STATUSES)) {
    return {
      ok: false,
      status: 400,
      message: "입력값을 확인해 주세요.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const dailyRecordsTable = getDailyRecordsTable(supabase);
  let query = dailyRecordsTable
    .select(SAFE_SELECT)
    .eq("profile_id", currentProfile.profileId)
    .is("deleted_at", null);

  if (normalizedDate) {
    query = query.eq("record_date", normalizedDate);
  }

  if (normalizedFrom) {
    query = query.gte("record_date", normalizedFrom);
  }

  if (normalizedTo) {
    query = query.lte("record_date", normalizedTo);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[DAILY_RECORD_LIST_FAILED]", error.message);
    return {
      ok: false,
      status: 500,
      message: "하루 기록 처리 중 오류가 발생했습니다.",
    };
  }

  return {
    ok: true,
    data: (data ?? []) as DailyRecordItem[],
  };
}

export async function createDailyRecord(
  input: unknown,
): Promise<DailyRecordResult<DailyRecordItem>> {
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

  const recordDate = normalizeDate(input.record_date);
  const visibility = normalizeVisibility(input.visibility);
  const status = normalizeStatus(input.status);

  if (!recordDate || !visibility || !status) {
    return {
      ok: false,
      status: 400,
      message: "입력값을 확인해 주세요.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const dailyRecordsTable = getDailyRecordsTable(supabase);
  const { data: existing, error: existingError } = await dailyRecordsTable
    .select("id")
    .eq("profile_id", currentProfile.profileId)
    .eq("record_date", recordDate)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    console.error("[DAILY_RECORD_DUPLICATE_CHECK_FAILED]", existingError.message);
    return {
      ok: false,
      status: 500,
      message: "하루 기록 처리 중 오류가 발생했습니다.",
    };
  }

  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "이미 해당 날짜의 하루 기록이 있습니다.",
    };
  }

  const now = new Date().toISOString();
  const payload: DailyRecordInsert = {
    profile_id: currentProfile.profileId,
    record_date: recordDate,
    title: normalizeNullableText(input.title, MAX_TITLE_LENGTH),
    reflection: normalizeNullableText(input.reflection, MAX_TEXT_LENGTH),
    practice: normalizeNullableText(input.practice, MAX_TEXT_LENGTH),
    prayer_request: normalizeNullableText(input.prayer_request, MAX_TEXT_LENGTH),
    visibility,
    shared_with_coach: normalizeBoolean(input.shared_with_coach, false),
    status,
    submitted_at: status === "submitted" ? now : null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await dailyRecordsTable
    .insert(payload)
    .select(SAFE_SELECT)
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      return {
        ok: false,
        status: 409,
        message: "이미 해당 날짜의 하루 기록이 있습니다.",
      };
    }

    console.error("[DAILY_RECORD_CREATE_FAILED]", error.message);
    return {
      ok: false,
      status: 500,
      message: "하루 기록 처리 중 오류가 발생했습니다.",
    };
  }

  return {
    ok: true,
    data: data as DailyRecordItem,
  };
}

export async function updateDailyRecord(
  id: string,
  input: unknown,
): Promise<DailyRecordResult<DailyRecordItem>> {
  const currentProfile = await getCurrentProfile();

  if (!currentProfile.ok) {
    return currentProfile;
  }

  if (!UUID_PATTERN.test(id) || !isRecord(input)) {
    return {
      ok: false,
      status: 400,
      message: "입력값을 확인해 주세요.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const dailyRecordsTable = getDailyRecordsTable(supabase);
  const { data: existing, error: existingError } = await dailyRecordsTable
    .select("id, profile_id, record_date, status, submitted_at")
    .eq("id", id)
    .eq("profile_id", currentProfile.profileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    console.error("[DAILY_RECORD_LOOKUP_FAILED]", existingError.message);
    return {
      ok: false,
      status: 500,
      message: "하루 기록 처리 중 오류가 발생했습니다.",
    };
  }

  if (!existing) {
    return {
      ok: false,
      status: 404,
      message: "하루 기록을 찾을 수 없습니다.",
    };
  }

  const updatePayload: DailyRecordUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (Object.hasOwn(input, "record_date")) {
    const recordDate = normalizeDate(input.record_date);
    if (!recordDate) {
      return {
        ok: false,
        status: 400,
        message: "입력값을 확인해 주세요.",
      };
    }

    if (recordDate !== existing.record_date) {
      const { data: duplicate, error: duplicateError } = await dailyRecordsTable
        .select("id")
        .eq("profile_id", currentProfile.profileId)
        .eq("record_date", recordDate)
        .is("deleted_at", null)
        .maybeSingle();

      if (duplicateError) {
        console.error(
          "[DAILY_RECORD_UPDATE_DUPLICATE_CHECK_FAILED]",
          duplicateError.message,
        );
        return {
          ok: false,
          status: 500,
          message: "하루 기록 처리 중 오류가 발생했습니다.",
        };
      }

      if (duplicate) {
        return {
          ok: false,
          status: 409,
          message: "이미 해당 날짜의 하루 기록이 있습니다.",
        };
      }
    }

    updatePayload.record_date = recordDate;
  }

  if (Object.hasOwn(input, "title")) {
    updatePayload.title = normalizeNullableText(input.title, MAX_TITLE_LENGTH);
  }

  if (Object.hasOwn(input, "reflection")) {
    updatePayload.reflection = normalizeNullableText(
      input.reflection,
      MAX_TEXT_LENGTH,
    );
  }

  if (Object.hasOwn(input, "practice")) {
    updatePayload.practice = normalizeNullableText(input.practice, MAX_TEXT_LENGTH);
  }

  if (Object.hasOwn(input, "prayer_request")) {
    updatePayload.prayer_request = normalizeNullableText(
      input.prayer_request,
      MAX_TEXT_LENGTH,
    );
  }

  if (Object.hasOwn(input, "visibility")) {
    const visibility = normalizeOptionalVisibility(input.visibility);
    if (!visibility) {
      return {
        ok: false,
        status: 400,
        message: "입력값을 확인해 주세요.",
      };
    }
    updatePayload.visibility = visibility;
  }

  if (Object.hasOwn(input, "shared_with_coach")) {
    if (typeof input.shared_with_coach !== "boolean") {
      return {
        ok: false,
        status: 400,
        message: "입력값을 확인해 주세요.",
      };
    }
    updatePayload.shared_with_coach = input.shared_with_coach;
  }

  const hasStatusChange = Object.hasOwn(input, "status");
  let nextStatus: PersonalRecordStatus | undefined;

  if (hasStatusChange) {
    const status = normalizeOptionalStatus(input.status);
    if (!status) {
      return {
        ok: false,
        status: 400,
        message: "입력값을 확인해 주세요.",
      };
    }
    nextStatus = status;
    updatePayload.status = status;
  }

  if (nextStatus === "submitted") {
    updatePayload.submitted_at = new Date().toISOString();
  } else if (nextStatus === "draft") {
    updatePayload.submitted_at = null;
  } else if (Object.hasOwn(input, "submitted_at")) {
    const submittedAt = normalizeOptionalSubmittedAt(input.submitted_at);
    if (submittedAt === undefined) {
      return {
        ok: false,
        status: 400,
        message: "입력값을 확인해 주세요.",
      };
    }
    updatePayload.submitted_at = submittedAt;
  }

  const { data, error } = await dailyRecordsTable
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
        message: "이미 해당 날짜의 하루 기록이 있습니다.",
      };
    }

    console.error("[DAILY_RECORD_UPDATE_FAILED]", error.message);
    return {
      ok: false,
      status: 500,
      message: "하루 기록 처리 중 오류가 발생했습니다.",
    };
  }

  if (!data) {
    return {
      ok: false,
      status: 404,
      message: "하루 기록을 찾을 수 없습니다.",
    };
  }

  return {
    ok: true,
    data: data as DailyRecordItem,
  };
}

export async function softDeleteDailyRecord(
  id: string,
): Promise<DailyRecordResult<DailyRecordItem>> {
  const currentProfile = await getCurrentProfile();

  if (!currentProfile.ok) {
    return currentProfile;
  }

  if (!UUID_PATTERN.test(id)) {
    return {
      ok: false,
      status: 400,
      message: "입력값을 확인해 주세요.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const dailyRecordsTable = getDailyRecordsTable(supabase);
  const { data, error } = await dailyRecordsTable
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
    console.error("[DAILY_RECORD_SOFT_DELETE_FAILED]", error.message);
    return {
      ok: false,
      status: 500,
      message: "하루 기록 처리 중 오류가 발생했습니다.",
    };
  }

  if (!data) {
    return {
      ok: false,
      status: 404,
      message: "하루 기록을 찾을 수 없습니다.",
    };
  }

  return {
    ok: true,
    data: data as DailyRecordItem,
  };
}
