import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  GoalPriority,
  GoalStatus,
  InsertDto,
  Tables,
  UpdateDto,
} from "@/types/database";

const GOAL_STATUSES = new Set<GoalStatus>([
  "active",
  "paused",
  "completed",
  "archived",
]);

const GOAL_PRIORITIES = new Set<GoalPriority>(["low", "normal", "high"]);

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;
const CATEGORY_MAX_LENGTH = 80;
const UNIT_MAX_LENGTH = 40;

type ServiceSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ProfileIdRow = {
  id: string;
};

type PostgrestErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

export type MyCoachingGoal = Pick<
  Tables<"goals">,
  | "id"
  | "profile_id"
  | "relationship_id"
  | "title"
  | "description"
  | "category"
  | "target_value"
  | "current_value"
  | "unit"
  | "status"
  | "priority"
  | "start_date"
  | "due_date"
  | "completed_at"
  | "created_at"
  | "updated_at"
>;

export type MyCoachingGoalsErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "GOALS_QUERY_FAILED"
  | "VALIDATION_FAILED"
  | "SAVE_FAILED"
  | "NOT_FOUND";

export type MyCoachingGoalsError = {
  code: MyCoachingGoalsErrorCode;
  message: string;
};

export type GetMyCoachingGoalsResult =
  | { ok: true; data: { goals: MyCoachingGoal[] } }
  | { ok: false; error: MyCoachingGoalsError };

export type SaveMyCoachingGoalInput = {
  goal_id: unknown;
  title: unknown;
  description: unknown;
  category: unknown;
  target_value: unknown;
  current_value: unknown;
  unit: unknown;
  priority: unknown;
  start_date: unknown;
  due_date: unknown;
};

export type UpdateMyCoachingGoalStatusInput = {
  goal_id: unknown;
  status: unknown;
};

export type MyCoachingGoalMutationResult =
  | { ok: true; goalId: string }
  | { ok: false; error: MyCoachingGoalsError };

type CurrentProfileContext =
  | {
      ok: true;
      profileId: string;
      serviceClient: ServiceSupabaseClient;
    }
  | { ok: false; error: MyCoachingGoalsError };

type NormalizedGoalInput = {
  goalId: string | null;
  title: string;
  description: string | null;
  category: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  priority: GoalPriority;
  startDate: string | null;
  dueDate: string | null;
};

type GoalIdRow = {
  id: string;
};

type GoalsListChain = {
  eq: (column: "profile_id", value: string) => {
    is: (column: "deleted_at", value: null) => {
      order: (
        column: "updated_at",
        options: { ascending: boolean },
      ) => Promise<{
        data: MyCoachingGoal[] | null;
        error: PostgrestErrorLike | null;
      }>;
    };
  };
};

type GoalsUpdateChain = {
  eq: (column: "id" | "profile_id", value: string) => GoalsUpdateChain;
  is: (column: "deleted_at", value: null) => {
    select: (columns: "id") => {
      maybeSingle: () => Promise<{
        data: GoalIdRow | null;
        error: PostgrestErrorLike | null;
      }>;
    };
  };
};

type GoalsTable = {
  select: (columns: typeof GOAL_SELECT_COLUMNS) => GoalsListChain;
  update: (values: UpdateDto<"goals">) => GoalsUpdateChain;
  insert: (values: InsertDto<"goals">) => {
    select: (columns: "id") => {
      single: () => Promise<{
        data: GoalIdRow | null;
        error: PostgrestErrorLike | null;
      }>;
    };
  };
};

const GOAL_SELECT_COLUMNS =
  "id, profile_id, relationship_id, title, description, category, target_value, current_value, unit, status, priority, start_date, due_date, completed_at, created_at, updated_at";

function createGoalsTable(supabase: ServiceSupabaseClient): GoalsTable {
  return supabase.from("goals") as unknown as GoalsTable;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(
  value: unknown,
  fieldLabel: string,
  maxLength: number,
): { ok: true; value: string | null } | { ok: false; message: string } {
  const normalized = normalizeString(value);

  if (normalized.length === 0) {
    return { ok: true, value: null };
  }

  if (normalized.length > maxLength) {
    return {
      ok: false,
      message: `${fieldLabel}은(는) ${maxLength}자 이하여야 합니다.`,
    };
  }

  return { ok: true, value: normalized };
}

function normalizeNumber(
  value: unknown,
  fieldLabel: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const normalized = normalizeString(value);

  if (normalized.length === 0) {
    return { ok: true, value: null };
  }

  const numberValue = Number(normalized);

  if (!Number.isFinite(numberValue)) {
    return { ok: false, message: `${fieldLabel}은(는) 숫자여야 합니다.` };
  }

  return { ok: true, value: numberValue };
}

function normalizeDate(
  value: unknown,
  fieldLabel: string,
): { ok: true; value: string | null } | { ok: false; message: string } {
  const normalized = normalizeString(value);

  if (normalized.length === 0) {
    return { ok: true, value: null };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return {
      ok: false,
      message: `${fieldLabel}은(는) YYYY-MM-DD 형식이어야 합니다.`,
    };
  }

  const date = new Date(`${normalized}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: `${fieldLabel}이(가) 올바르지 않습니다.` };
  }

  return { ok: true, value: normalized };
}

function normalizeGoalInput(
  input: SaveMyCoachingGoalInput,
): { ok: true; value: NormalizedGoalInput } | { ok: false; error: MyCoachingGoalsError } {
  const goalId = normalizeString(input.goal_id) || null;
  const title = normalizeString(input.title);

  if (title.length === 0) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "목표 제목을 입력해 주세요." },
    };
  }

  if (title.length > TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: `목표 제목은 ${TITLE_MAX_LENGTH}자 이하여야 합니다.`,
      },
    };
  }

  const description = normalizeNullableText(
    input.description,
    "설명",
    DESCRIPTION_MAX_LENGTH,
  );
  const category = normalizeNullableText(input.category, "분류", CATEGORY_MAX_LENGTH);
  const unit = normalizeNullableText(input.unit, "단위", UNIT_MAX_LENGTH);
  const targetValue = normalizeNumber(input.target_value, "목표값");
  const currentValue = normalizeNumber(input.current_value, "현재값");
  const startDate = normalizeDate(input.start_date, "시작일");
  const dueDate = normalizeDate(input.due_date, "마감일");

  if (!description.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: description.message },
    };
  }

  if (!category.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: category.message },
    };
  }

  if (!unit.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: unit.message },
    };
  }

  if (!targetValue.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: targetValue.message },
    };
  }

  if (!currentValue.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: currentValue.message },
    };
  }

  if (!startDate.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: startDate.message },
    };
  }

  if (!dueDate.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: dueDate.message },
    };
  }

  const priority =
    typeof input.priority === "string" && GOAL_PRIORITIES.has(input.priority as GoalPriority)
      ? (input.priority as GoalPriority)
      : "normal";

  return {
    ok: true,
    value: {
      goalId,
      title,
      description: description.value,
      category: category.value,
      targetValue: targetValue.value,
      currentValue: currentValue.value,
      unit: unit.value,
      priority,
      startDate: startDate.value,
      dueDate: dueDate.value,
    },
  };
}

function normalizeGoalStatus(value: unknown): GoalStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  return GOAL_STATUSES.has(value as GoalStatus) ? (value as GoalStatus) : null;
}

async function getCurrentProfileContext(
  knownProfileId?: string,
): Promise<CurrentProfileContext> {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
    };
  }

  if (knownProfileId) {
    return {
      ok: true,
      profileId: knownProfileId,
      serviceClient: await createSupabaseServerClient(),
    };
  }

  const verifiedProfileId = await getVerifiedProfileId();
  if (verifiedProfileId) {
    return {
      ok: true,
      profileId: verifiedProfileId,
      serviceClient: await createSupabaseServerClient(),
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
      ok: false,
      error: {
        code: "PROFILE_QUERY_FAILED",
        message: "프로필을 불러올 수 없습니다.",
      },
    };
  }

  if (!profile) {
    return {
      ok: false,
      error: {
        code: "PROFILE_NOT_FOUND",
        message: "아직 프로필이 생성되지 않았습니다.",
      },
    };
  }

  return {
    ok: true,
    profileId: (profile as ProfileIdRow).id,
    serviceClient: supabase,
  };
}

export async function getMyCoachingGoals(options?: {
  knownProfileId?: string;
}): Promise<GetMyCoachingGoalsResult> {
  const context = await getCurrentProfileContext(options?.knownProfileId);

  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const goalsTable = createGoalsTable(context.serviceClient);
  const { data: goals, error: goalsError } = await goalsTable
    .select(GOAL_SELECT_COLUMNS)
    .eq("profile_id", context.profileId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (goalsError) {
    return {
      ok: false,
      error: {
        code: "GOALS_QUERY_FAILED",
        message: "지금 목표를 불러올 수 없습니다.",
      },
    };
  }

  return { ok: true, data: { goals: (goals ?? []) as MyCoachingGoal[] } };
}

export async function saveMyCoachingGoal(
  input: SaveMyCoachingGoalInput,
): Promise<MyCoachingGoalMutationResult> {
  const normalized = normalizeGoalInput(input);

  if (!normalized.ok) {
    return { ok: false, error: normalized.error };
  }

  const context = await getCurrentProfileContext();

  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const now = new Date().toISOString();
  const values = normalized.value;

  if (values.goalId) {
    const updatePayload: UpdateDto<"goals"> = {
      title: values.title,
      description: values.description,
      category: values.category,
      target_value: values.targetValue,
      current_value: values.currentValue,
      unit: values.unit,
      priority: values.priority,
      start_date: values.startDate,
      due_date: values.dueDate,
      updated_at: now,
    };
    const goalsTable = createGoalsTable(context.serviceClient);
    const { data: updatedGoal, error: updateError } = await goalsTable
      .update(updatePayload)
      .eq("id", values.goalId)
      .eq("profile_id", context.profileId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return {
        ok: false,
        error: { code: "SAVE_FAILED", message: "목표를 저장할 수 없습니다." },
      };
    }

    if (!updatedGoal) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "목표를 찾을 수 없습니다." },
      };
    }

    return { ok: true, goalId: updatedGoal.id };
  }

  const insertPayload: InsertDto<"goals"> = {
    profile_id: context.profileId,
    relationship_id: null,
    title: values.title,
    description: values.description,
    category: values.category,
    target_value: values.targetValue,
    current_value: values.currentValue,
    unit: values.unit,
    status: "active",
    priority: values.priority,
    start_date: values.startDate,
    due_date: values.dueDate,
    completed_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const goalsTable = createGoalsTable(context.serviceClient);
  const { data: createdGoal, error: insertError } = await goalsTable
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError || !createdGoal) {
    return {
      ok: false,
      error: { code: "SAVE_FAILED", message: "목표를 저장할 수 없습니다." },
    };
  }

  return { ok: true, goalId: createdGoal.id };
}

export async function updateMyCoachingGoalStatus(
  input: UpdateMyCoachingGoalStatusInput,
): Promise<MyCoachingGoalMutationResult> {
  const goalId = normalizeString(input.goal_id);
  const status = normalizeGoalStatus(input.status);

  if (goalId.length === 0 || !status) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "변경할 목표 상태가 올바르지 않습니다.",
      },
    };
  }

  const context = await getCurrentProfileContext();

  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const now = new Date().toISOString();
  const updatePayload: UpdateDto<"goals"> = {
    status,
    completed_at: status === "completed" ? now : null,
    updated_at: now,
  };
  const goalsTable = createGoalsTable(context.serviceClient);
  const { data: updatedGoal, error: updateError } = await goalsTable
    .update(updatePayload)
    .eq("id", goalId)
    .eq("profile_id", context.profileId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      ok: false,
      error: { code: "SAVE_FAILED", message: "목표 상태를 변경할 수 없습니다." },
    };
  }

  if (!updatedGoal) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "목표를 찾을 수 없습니다." },
    };
  }

  return { ok: true, goalId: updatedGoal.id };
}
