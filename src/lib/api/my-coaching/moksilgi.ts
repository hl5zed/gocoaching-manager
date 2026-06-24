import { getSession } from "@/lib/auth/getSession";
import { getVerifiedProfileId } from "@/lib/auth/verified-identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createMoksilgiVersion } from "./moksilgi-versions";
import type { ServiceClient } from "./context";
import type {
  InsertDto,
  Json,
  MoksilgiAreaKey,
  MoksilgiMeasurementType,
  MoksilgiStatus,
  Tables,
  UpdateDto,
} from "@/types/database";

const PLAN_SELECT =
  "id, profile_id, title, subtitle, period_start, period_end, written_at, author_name, region_name, team_name, regional_leader_name, coach_name, role_label, generation_label, mission_statement, mission_bible_verse, mission_description, vision_year, vision_statement, vision_metrics, vision_target, vision_description, core_values_json, main_goal, main_goal_description, version_number, version_type, status, created_at, updated_at";
const AREA_SELECT =
  "id, plan_id, area_key, area_title, area_subtitle, sort_order";
const DETAIL_GOAL_SELECT =
  "id, plan_id, area_id, title, description, annual_target, monthly_target, unit, measurement_type, strategies_json, sort_order, created_at, updated_at";

const PLAN_STATUSES = new Set<MoksilgiStatus>(["draft", "active", "archived"]);
const MEASUREMENT_TYPES = new Set<MoksilgiMeasurementType>([
  "daily_check",
  "weekly_count",
  "monthly_number",
  "monthly_comment",
]);

const DEFAULT_CORE_VALUES: MoksilgiCoreValue[] = [
  { value_name: "", meaning: "", practice_example: "" },
  { value_name: "", meaning: "", practice_example: "" },
  { value_name: "", meaning: "", practice_example: "" },
];

const DEFAULT_AREAS: Array<{
  area_key: MoksilgiAreaKey;
  area_title: string;
  area_subtitle: string;
  sort_order: number;
}> = [
  {
    area_key: "spiritual",
    area_title: "영적 성장",
    area_subtitle: "예수님은 하나님 앞에서 사랑스러워 가시더라",
    sort_order: 1,
  },
  {
    area_key: "intellectual",
    area_title: "지적 성장",
    area_subtitle: "예수님은 지혜가 자라며",
    sort_order: 2,
  },
  {
    area_key: "physical",
    area_title: "육체적 성장",
    area_subtitle: "예수님은 키가 자라며",
    sort_order: 3,
  },
  {
    area_key: "social",
    area_title: "사회적 성장",
    area_subtitle: "예수님은 사람 앞에서 사랑스러워 가시더라",
    sort_order: 4,
  },
  {
    area_key: "other",
    area_title: "기타",
    area_subtitle: "그 외 삶과 사역의 필요 영역",
    sort_order: 5,
  },
];

type ServiceSupabaseClient = ServiceClient;

type PostgrestErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

type ProfileIdRow = { id: string };
type IdRow = { id: string };

export type MoksilgiCoreValue = {
  value_name: string;
  meaning: string;
  practice_example: string;
};

export type MoksilgiPlan = Pick<
  Tables<"moksilgi_plans">,
  | "id"
  | "profile_id"
  | "title"
  | "subtitle"
  | "period_start"
  | "period_end"
  | "written_at"
  | "author_name"
  | "region_name"
  | "team_name"
  | "regional_leader_name"
  | "coach_name"
  | "role_label"
  | "generation_label"
  | "mission_statement"
  | "mission_bible_verse"
  | "mission_description"
  | "vision_year"
  | "vision_statement"
  | "vision_metrics"
  | "vision_target"
  | "vision_description"
  | "core_values_json"
  | "main_goal"
  | "main_goal_description"
  | "version_number"
  | "version_type"
  | "status"
  | "created_at"
  | "updated_at"
>;

export type MoksilgiGoalArea = Pick<
  Tables<"moksilgi_goal_areas">,
  "id" | "plan_id" | "area_key" | "area_title" | "area_subtitle" | "sort_order"
>;

export type MoksilgiDetailGoal = Pick<
  Tables<"moksilgi_detail_goals">,
  | "id"
  | "plan_id"
  | "area_id"
  | "title"
  | "description"
  | "annual_target"
  | "monthly_target"
  | "unit"
  | "measurement_type"
  | "strategies_json"
  | "sort_order"
  | "created_at"
  | "updated_at"
>;

export type GetMyMoksilgiResult =
  | {
      ok: true;
      data: {
        plan: MoksilgiPlan | null;
        areas: MoksilgiGoalArea[];
        detailGoals: MoksilgiDetailGoal[];
        defaultCoreValues: MoksilgiCoreValue[];
      };
    }
  | {
      ok: false;
      error: {
        code:
          | "UNAUTHORIZED"
          | "PROFILE_NOT_FOUND"
          | "PROFILE_QUERY_FAILED"
          | "MOKSILGI_QUERY_FAILED"
          | "SAVE_FAILED"
          | "VALIDATION_FAILED"
          | "NOT_FOUND";
        message: string;
      };
    };

type MoksilgiError = Extract<GetMyMoksilgiResult, { ok: false }>["error"];

export type SaveMoksilgiResult =
  | { ok: true; planId: string }
  | { ok: false; error: MoksilgiError };

type CurrentProfileContext =
  | { ok: true; profileId: string; serviceClient: ServiceSupabaseClient }
  | { ok: false; error: MoksilgiError };

type PlanTable = {
  select: (columns: typeof PLAN_SELECT) => {
    eq: (column: "profile_id", value: string) => {
      eq: (column: "status", value: MoksilgiStatus) => {
        is: (column: "deleted_at", value: null) => {
          order: (
            column: "updated_at",
            options: { ascending: boolean },
          ) => {
            limit: (count: 1) => {
              maybeSingle: () => Promise<{
                data: MoksilgiPlan | null;
                error: PostgrestErrorLike | null;
              }>;
            };
          };
        };
      };
    };
  };
  insert: (values: InsertDto<"moksilgi_plans">) => {
    select: (columns: "id") => {
      single: () => Promise<{ data: IdRow | null; error: PostgrestErrorLike | null }>;
    };
  };
  update: (values: UpdateDto<"moksilgi_plans">) => {
    eq: (column: "id" | "profile_id", value: string) => {
      eq: (column: "id" | "profile_id", value: string) => {
        is: (column: "deleted_at", value: null) => {
          select: (columns: "id") => {
            maybeSingle: () => Promise<{
              data: IdRow | null;
              error: PostgrestErrorLike | null;
            }>;
          };
        };
      };
    };
  };
};

type AreaTable = {
  select: (columns: typeof AREA_SELECT | "id, area_key") => {
    eq: (column: "plan_id", value: string) => {
      is: (column: "deleted_at", value: null) => {
        order: (
          column: "sort_order",
          options: { ascending: boolean },
        ) => Promise<{
          data: MoksilgiGoalArea[] | null;
          error: PostgrestErrorLike | null;
        }>;
      };
    };
  };
  insert: (values: Array<InsertDto<"moksilgi_goal_areas">>) => Promise<{
    data: null;
    error: PostgrestErrorLike | null;
  }>;
};

type DetailGoalTable = {
  select: (columns: typeof DETAIL_GOAL_SELECT) => {
    eq: (column: "plan_id", value: string) => {
      is: (column: "deleted_at", value: null) => {
        order: (
          column: "sort_order",
          options: { ascending: boolean },
        ) => Promise<{
          data: MoksilgiDetailGoal[] | null;
          error: PostgrestErrorLike | null;
        }>;
      };
    };
  };
  insert: (values: InsertDto<"moksilgi_detail_goals">) => {
    select: (columns: "id") => {
      single: () => Promise<{ data: IdRow | null; error: PostgrestErrorLike | null }>;
    };
  };
  update: (values: UpdateDto<"moksilgi_detail_goals">) => {
    eq: (column: "id" | "plan_id" | "area_id", value: string) => {
      eq: (column: "id" | "plan_id" | "area_id", value: string) => {
        eq: (column: "id" | "plan_id" | "area_id", value: string) => {
          is: (column: "deleted_at", value: null) => {
            select: (columns: "id") => {
              maybeSingle: () => Promise<{
                data: IdRow | null;
                error: PostgrestErrorLike | null;
              }>;
            };
          };
        };
      };
    };
  };
};

function planTable(client: ServiceSupabaseClient) {
  return client.from("moksilgi_plans") as unknown as PlanTable;
}

function areaTable(client: ServiceSupabaseClient) {
  return client.from("moksilgi_goal_areas") as unknown as AreaTable;
}

function detailGoalTable(client: ServiceSupabaseClient) {
  return client.from("moksilgi_detail_goals") as unknown as DetailGoalTable;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown, maxLength: number, label: string) {
  const normalized = normalizeString(value);

  if (normalized.length === 0) {
    return { ok: true as const, value: null };
  }

  if (normalized.length > maxLength) {
    return {
      ok: false as const,
      message: `${label}은(는) ${maxLength}자 이하여야 합니다.`,
    };
  }

  return { ok: true as const, value: normalized };
}

function requiredText(value: unknown, maxLength: number, label: string) {
  const normalized = normalizeString(value);

  if (normalized.length === 0) {
    return { ok: false as const, message: `${label}을(를) 입력해 주세요.` };
  }

  if (normalized.length > maxLength) {
    return {
      ok: false as const,
      message: `${label}은(는) ${maxLength}자 이하여야 합니다.`,
    };
  }

  return { ok: true as const, value: normalized };
}

function nullableDate(value: unknown) {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

function nullableNumber(value: unknown, label: string) {
  const normalized = normalizeString(value);

  if (normalized.length === 0) {
    return { ok: true as const, value: null };
  }

  const numberValue = Number(normalized);

  if (!Number.isFinite(numberValue)) {
    return { ok: false as const, message: `${label}은(는) 숫자여야 합니다.` };
  }

  return { ok: true as const, value: numberValue };
}

function coreValuesFromForm(formData: FormData): MoksilgiCoreValue[] {
  return [0, 1, 2, 3, 4]
    .map((index) => ({
      value_name: normalizeString(formData.get(`core_value_name_${index}`)),
      meaning: normalizeString(formData.get(`core_value_meaning_${index}`)),
      practice_example: normalizeString(formData.get(`core_value_practice_${index}`)),
    }))
    .filter(
      (value) =>
        value.value_name.length > 0 ||
        value.meaning.length > 0 ||
        value.practice_example.length > 0,
    )
    .slice(0, 5);
}

function strategiesFromForm(formData: FormData): string[] {
  return [1, 2, 3, 4, 5]
    .map((index) => normalizeString(formData.get(`strategy_${index}`)))
    .filter((strategy) => strategy.length > 0)
    .slice(0, 5);
}

async function getCurrentProfileContext(): Promise<CurrentProfileContext> {
  const session = await getSession();

  if (!session.user) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
    };
  }

  const supabase = await createSupabaseServerClient();
  const verifiedProfileId = await getVerifiedProfileId();

  const profileQuery = supabase
    .from("profiles")
    .select("id")
    .is("deleted_at", null)
    .neq("status", "anonymized");

  const { data: profile, error: profileError } = verifiedProfileId
    ? await profileQuery.eq("id", verifiedProfileId).maybeSingle()
    : await profileQuery.eq("auth_user_id", session.user.id).maybeSingle();

  if (profileError) {
    return {
      ok: false,
      error: { code: "PROFILE_QUERY_FAILED", message: "프로필을 불러올 수 없습니다." },
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

  return { ok: true, profileId: (profile as ProfileIdRow).id, serviceClient: supabase };
}

async function getOwnedPlan(
  serviceClient: ServiceSupabaseClient,
  profileId: string,
) {
  return planTable(serviceClient)
    .select(PLAN_SELECT)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function ensureDefaultAreas(
  serviceClient: ServiceSupabaseClient,
  planId: string,
): Promise<{ ok: boolean; areas: MoksilgiGoalArea[] }> {
  const { data: existingAreas, error } = await areaTable(serviceClient)
    .select(AREA_SELECT)
    .eq("plan_id", planId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    return { ok: false, areas: [] };
  }

  const areas = existingAreas ?? [];
  const existingKeys = new Set(areas.map((area) => area.area_key));
  const now = new Date().toISOString();
  const missingAreas = DEFAULT_AREAS.filter(
    (area) => !existingKeys.has(area.area_key),
  ).map((area) => ({
    plan_id: planId,
    area_key: area.area_key,
    area_title: area.area_title,
    area_subtitle: area.area_subtitle,
    sort_order: area.sort_order,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }));

  if (missingAreas.length === 0) {
    return { ok: true, areas };
  }

  const { error: insertError } = await areaTable(serviceClient).insert(missingAreas);
  if (insertError) {
    return { ok: false, areas };
  }

  // INSERT 후 최신 목록 재조회
  const { data: updatedAreas } = await areaTable(serviceClient)
    .select(AREA_SELECT)
    .eq("plan_id", planId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  return { ok: true, areas: updatedAreas ?? areas };
}

async function createCurrentPlanVersionSnapshot({
  changeReason,
  planId,
  profileId,
  serviceClient,
  versionNumber,
}: {
  changeReason: string;
  planId: string;
  profileId: string;
  serviceClient: ServiceSupabaseClient;
  versionNumber: number;
}) {
  const [planResult, areasResult, detailGoalsResult] = await Promise.all([
    getOwnedPlan(serviceClient, profileId),
    areaTable(serviceClient)
      .select(AREA_SELECT)
      .eq("plan_id", planId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    detailGoalTable(serviceClient)
      .select(DETAIL_GOAL_SELECT)
      .eq("plan_id", planId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  if (planResult.error || areasResult.error || detailGoalsResult.error) {
    console.error("[MOKSILGI_VERSION_SNAPSHOT_FETCH_FAILED]", {
      planId,
      planError: planResult.error,
      areasError: areasResult.error,
      detailGoalsError: detailGoalsResult.error,
    });
    return;
  }

  if (!planResult.data || planResult.data.id !== planId) {
    return;
  }

  const result = await createMoksilgiVersion({
    plan_id: planId,
    version_number: versionNumber,
    version_type: "self_updated",
    snapshot_json: {
      plan: planResult.data,
      goal_areas: areasResult.data ?? [],
      detail_goals: detailGoalsResult.data ?? [],
    },
    change_reason: changeReason,
    created_by: profileId,
  });

  if (!result.ok) {
    console.error("[MOKSILGI_VERSION_SNAPSHOT_CREATE_FAILED]", {
      planId,
      error: result.error,
    });
  }
}

async function markPlanSelfUpdated({
  changeReason,
  plan,
  profileId,
  serviceClient,
}: {
  changeReason: string;
  plan: MoksilgiPlan;
  profileId: string;
  serviceClient: ServiceSupabaseClient;
}) {
  const nextVersionNumber = plan.version_number + 1;
  const now = new Date().toISOString();
  const { error } = await planTable(serviceClient)
    .update({
      version_number: nextVersionNumber,
      version_type: "self_updated",
      change_reason: changeReason,
      submitted_at: null,
      approved_at: null,
      approved_by_profile_id: null,
      updated_at: now,
    })
    .eq("id", plan.id)
    .eq("profile_id", profileId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[MOKSILGI_VERSION_STATUS_UPDATE_FAILED]", {
      planId: plan.id,
      error,
    });
    return;
  }

  await createCurrentPlanVersionSnapshot({
    changeReason,
    planId: plan.id,
    profileId,
    serviceClient,
    versionNumber: nextVersionNumber,
  });
}

export async function getMyMoksilgi(knownProfileId?: string): Promise<GetMyMoksilgiResult> {
  let context: CurrentProfileContext;

  if (knownProfileId) {
    const session = await getSession();
    if (!session.user) {
      return {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
      };
    }

    let supabase: ServiceSupabaseClient;
    try {
      supabase = await createSupabaseServerClient();
    } catch (error) {
      console.error("[MOKSILGI_SERVER_CLIENT_UNAVAILABLE]", error);
      return {
        ok: false,
        error: { code: "MOKSILGI_QUERY_FAILED", message: "지금 목실기를 불러올 수 없습니다." },
      };
    }

    context = { ok: true, profileId: knownProfileId, serviceClient: supabase };
  } else {
    context = await getCurrentProfileContext();
  }

  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const { data: plan, error: planError } = await getOwnedPlan(
    context.serviceClient,
    context.profileId,
  );

  if (planError) {
    return {
      ok: false,
      error: {
        code: "MOKSILGI_QUERY_FAILED",
        message: "지금 목실기를 불러올 수 없습니다.",
      },
    };
  }

  if (!plan) {
    return {
      ok: true,
      data: {
        plan: null,
        areas: [],
        detailGoals: [],
        defaultCoreValues: DEFAULT_CORE_VALUES,
      },
    };
  }

  const [areasResult, detailGoalsResult] = await Promise.all([
    ensureDefaultAreas(context.serviceClient, plan.id),
    detailGoalTable(context.serviceClient)
      .select(DETAIL_GOAL_SELECT)
      .eq("plan_id", plan.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
  ]);

  if (!areasResult.ok) {
    return {
      ok: false,
      error: {
        code: "MOKSILGI_QUERY_FAILED",
        message: "목표 영역을 불러올 수 없습니다.",
      },
    };
  }

  if (detailGoalsResult.error) {
    return {
      ok: false,
      error: {
        code: "MOKSILGI_QUERY_FAILED",
        message: "세부 목표를 불러올 수 없습니다.",
      },
    };
  }

  return {
    ok: true,
    data: {
      plan,
      areas: areasResult.areas,
      detailGoals: detailGoalsResult.data ?? [],
      defaultCoreValues: DEFAULT_CORE_VALUES,
    },
  };
}

export async function saveMyMoksilgiPlan(
  formData: FormData,
): Promise<SaveMoksilgiResult> {
  const context = await getCurrentProfileContext();

  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const title = requiredText(formData.get("title"), 160, "제목");
  const subtitle = nullableText(formData.get("subtitle"), 160, "부제");
  const visionYear = nullableNumber(formData.get("vision_year"), "비전 목표 연도");

  if (!title.ok) {
    return { ok: false, error: { code: "VALIDATION_FAILED", message: title.message } };
  }

  if (!subtitle.ok) {
    return { ok: false, error: { code: "VALIDATION_FAILED", message: subtitle.message } };
  }

  if (!visionYear.ok) {
    return { ok: false, error: { code: "VALIDATION_FAILED", message: visionYear.message } };
  }

  const textFields = {
    author_name: nullableText(formData.get("author_name"), 120, "작성자"),
    region_name: nullableText(
      formData.get("region_name"),
      120,
      "국가/소속/공동체",
    ),
    team_name: nullableText(formData.get("team_name"), 120, "팀"),
    regional_leader_name: nullableText(
      formData.get("regional_leader_name"),
      120,
      "지역팀장",
    ),
    coach_name: nullableText(formData.get("coach_name"), 120, "코치"),
    role_label: nullableText(formData.get("role_label"), 80, "직책"),
    generation_label: nullableText(formData.get("generation_label"), 80, "세대"),
    mission_statement: nullableText(
      formData.get("mission_statement"),
      3000,
      "사명선언 문장",
    ),
    mission_bible_verse: nullableText(
      formData.get("mission_bible_verse"),
      120,
      "관련 성경구절",
    ),
    mission_description: nullableText(
      formData.get("mission_description"),
      4000,
      "사명 설명",
    ),
    vision_statement: nullableText(
      formData.get("vision_statement"),
      3000,
      "비전 문장",
    ),
    vision_metrics: nullableText(formData.get("vision_metrics"), 1000, "핵심 수치"),
    vision_target: nullableText(formData.get("vision_target"), 1000, "대상"),
    vision_description: nullableText(
      formData.get("vision_description"),
      4000,
      "비전 설명",
    ),
    main_goal: nullableText(formData.get("main_goal"), 1000, "전체 목표 문장"),
    main_goal_description: nullableText(
      formData.get("main_goal_description"),
      3000,
      "목표 설명",
    ),
  };

  for (const field of Object.values(textFields)) {
    if (!field.ok) {
      return { ok: false, error: { code: "VALIDATION_FAILED", message: field.message } };
    }
  }

  const statusValue = normalizeString(formData.get("status"));
  const status = PLAN_STATUSES.has(statusValue as MoksilgiStatus)
    ? (statusValue as MoksilgiStatus)
    : "draft";
  const now = new Date().toISOString();
  const planId = normalizeString(formData.get("plan_id"));
  const payload = {
    title: title.value,
    subtitle: subtitle.value ?? "목실기와 체크리스트",
    period_start: nullableDate(formData.get("period_start")),
    period_end: nullableDate(formData.get("period_end")),
    written_at: nullableDate(formData.get("written_at")),
    author_name: textFields.author_name.value,
    region_name: textFields.region_name.value,
    team_name: textFields.team_name.value,
    regional_leader_name: textFields.regional_leader_name.value,
    coach_name: textFields.coach_name.value,
    role_label: textFields.role_label.value,
    generation_label: textFields.generation_label.value,
    mission_statement: textFields.mission_statement.value,
    mission_bible_verse: textFields.mission_bible_verse.value,
    mission_description: textFields.mission_description.value,
    vision_year: visionYear.value,
    vision_statement: textFields.vision_statement.value,
    vision_metrics: textFields.vision_metrics.value,
    vision_target: textFields.vision_target.value,
    vision_description: textFields.vision_description.value,
    core_values_json: coreValuesFromForm(formData) as unknown as Json,
    main_goal: textFields.main_goal.value,
    main_goal_description: textFields.main_goal_description.value,
    status,
    updated_at: now,
  };

  if (planId.length > 0) {
    const { data: existingPlan, error: existingPlanError } = await getOwnedPlan(
      context.serviceClient,
      context.profileId,
    );

    if (existingPlanError || !existingPlan || existingPlan.id !== planId) {
      return { ok: false, error: { code: "NOT_FOUND", message: "목실기 정보를 찾을 수 없습니다." } };
    }

    const nextVersionNumber = existingPlan.version_number + 1;
    const { data: updatedPlan, error } = await planTable(context.serviceClient)
      .update({
        ...payload,
        version_number: nextVersionNumber,
        version_type: "self_updated",
        change_reason: "목실기 기본 정보 수정",
        submitted_at: null,
        approved_at: null,
        approved_by_profile_id: null,
      })
      .eq("id", planId)
      .eq("profile_id", context.profileId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error || !updatedPlan) {
      return { ok: false, error: { code: "SAVE_FAILED", message: "목실기를 저장할 수 없습니다." } };
    }

    await ensureDefaultAreas(context.serviceClient, updatedPlan.id);
    await createCurrentPlanVersionSnapshot({
      changeReason: "목실기 기본 정보 수정",
      planId: updatedPlan.id,
      profileId: context.profileId,
      serviceClient: context.serviceClient,
      versionNumber: nextVersionNumber,
    });
    return { ok: true, planId: updatedPlan.id };
  }

  const insertPayload: InsertDto<"moksilgi_plans"> = {
    ...payload,
    profile_id: context.profileId,
    created_at: now,
    deleted_at: null,
  };
  const { data: createdPlan, error } = await planTable(context.serviceClient)
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !createdPlan) {
    return { ok: false, error: { code: "SAVE_FAILED", message: "목실기를 저장할 수 없습니다." } };
  }

  await ensureDefaultAreas(context.serviceClient, createdPlan.id);
  return { ok: true, planId: createdPlan.id };
}

export async function saveMyMoksilgiDetailGoal(
  formData: FormData,
): Promise<SaveMoksilgiResult> {
  const context = await getCurrentProfileContext();

  if (!context.ok) {
    return { ok: false, error: context.error };
  }

  const planId = normalizeString(formData.get("plan_id"));
  const areaId = normalizeString(formData.get("area_id"));
  const detailGoalId = normalizeString(formData.get("detail_goal_id"));
  const title = requiredText(formData.get("detail_title"), 300, "세부 목표 제목");
  const description = nullableText(formData.get("detail_description"), 3000, "세부 목표 설명");
  const annualTarget = nullableNumber(formData.get("annual_target"), "연간 목표량");
  const monthlyTarget = nullableNumber(formData.get("monthly_target"), "월 목표량");
  const unit = nullableText(formData.get("unit"), 40, "단위");

  if (!title.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: title.message },
    };
  }

  if (!description.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: description.message },
    };
  }

  if (!annualTarget.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: annualTarget.message },
    };
  }

  if (!monthlyTarget.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: monthlyTarget.message },
    };
  }

  if (!unit.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: unit.message },
    };
  }

  const measurementTypeValue = normalizeString(formData.get("measurement_type"));
  const measurementType = MEASUREMENT_TYPES.has(
    measurementTypeValue as MoksilgiMeasurementType,
  )
    ? (measurementTypeValue as MoksilgiMeasurementType)
    : "monthly_number";

  const { data: plan, error: planError } = await getOwnedPlan(
    context.serviceClient,
    context.profileId,
  );

  if (planError || !plan || plan.id !== planId || areaId.length === 0) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "목실기 정보를 찾을 수 없습니다." },
    };
  }

  const { data: areas, error: areasError } = await areaTable(context.serviceClient)
    .select(AREA_SELECT)
    .eq("plan_id", plan.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (areasError || !(areas ?? []).some((area) => area.id === areaId)) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "목표 영역을 찾을 수 없습니다." },
    };
  }

  const now = new Date().toISOString();
  const payload = {
    title: title.value,
    description: description.value,
    annual_target: annualTarget.value,
    monthly_target: monthlyTarget.value,
    unit: unit.value,
    measurement_type: measurementType,
    strategies_json: strategiesFromForm(formData) as unknown as Json,
    updated_at: now,
  };

  if (detailGoalId.length > 0) {
    const { data: updatedGoal, error } = await detailGoalTable(context.serviceClient)
      .update(payload)
      .eq("id", detailGoalId)
      .eq("plan_id", plan.id)
      .eq("area_id", areaId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error || !updatedGoal) {
      return { ok: false, error: { code: "SAVE_FAILED", message: "세부 목표를 저장할 수 없습니다." } };
    }

    await markPlanSelfUpdated({
      changeReason: "세부 목표 수정",
      plan,
      profileId: context.profileId,
      serviceClient: context.serviceClient,
    });
    return { ok: true, planId: plan.id };
  }

  const detailGoalsForArea = (await detailGoalTable(context.serviceClient)
    .select(DETAIL_GOAL_SELECT)
    .eq("plan_id", plan.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })).data?.filter(
    (goal) => goal.area_id === areaId,
  ) ?? [];
  const insertPayload: InsertDto<"moksilgi_detail_goals"> = {
    ...payload,
    plan_id: plan.id,
    area_id: areaId,
    sort_order: detailGoalsForArea.length + 1,
    created_at: now,
    deleted_at: null,
  };
  const { data: createdGoal, error } = await detailGoalTable(context.serviceClient)
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !createdGoal) {
    return { ok: false, error: { code: "SAVE_FAILED", message: "세부 목표를 저장할 수 없습니다." } };
  }

  await markPlanSelfUpdated({
    changeReason: "세부 목표 추가",
    plan,
    profileId: context.profileId,
    serviceClient: context.serviceClient,
  });
  return { ok: true, planId: plan.id };
}

export const MOKSILGI_VERSION_TYPES = [
  "draft",
  "submitted",
  "approved",
  "self_updated",
  "review_requested",
] as const;

export type MoksilgiVersionType = (typeof MOKSILGI_VERSION_TYPES)[number];

export function isMoksilgiVersionType(value: unknown): value is MoksilgiVersionType {
  return (
    typeof value === "string" &&
    (MOKSILGI_VERSION_TYPES as readonly string[]).includes(value)
  );
}

export const MOKSILGI_VERSION_TYPE_LABELS: Record<MoksilgiVersionType, string> = {
  draft: "작성 중",
  submitted: "코치 검토 대기",
  approved: "코치 승인 완료",
  self_updated: "자기 업데이트",
  review_requested: "코치 재검토 요청",
};
