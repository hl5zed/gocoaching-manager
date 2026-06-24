import { getMoksilgiContext, type ServiceClient } from "./context";
import type {
  InsertDto,
  Json,
  MoksilgiAreaKey,
  MoksilgiMeasurementType,
  Tables,
  UpdateDto,
} from "@/types/database";

type ErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_QUERY_FAILED"
  | "MOKSILGI_QUERY_FAILED"
  | "VALIDATION_FAILED"
  | "SAVE_FAILED"
  | "NOT_FOUND";
type SafeError = { code: ErrorCode; message: string };

type PostgrestErrorLike = { code?: string; message?: string; details?: string };
type IdRow = { id: string };
type PlanRow = Pick<Tables<"moksilgi_plans">, "id" | "profile_id" | "title">;

export type MoksilgiMonthlyRecord = Pick<
  Tables<"moksilgi_monthly_records">,
  | "id"
  | "plan_id"
  | "area_id"
  | "detail_goal_id"
  | "profile_id"
  | "year"
  | "month"
  | "target_value"
  | "actual_value"
  | "achievement_rate"
  | "daily_checks_json"
  | "weekly_counts_json"
  | "comment"
  | "created_at"
  | "updated_at"
>;

export type MoksilgiMonthlySummary = Pick<
  Tables<"moksilgi_monthly_summaries">,
  | "id"
  | "plan_id"
  | "profile_id"
  | "year"
  | "month"
  | "spiritual_rate"
  | "intellectual_rate"
  | "physical_rate"
  | "social_rate"
  | "other_rate"
  | "total_rate"
  | "average_rate"
  | "created_at"
  | "updated_at"
>;

export type MoksilgiMonthlyArea = Pick<
  Tables<"moksilgi_goal_areas">,
  "id" | "plan_id" | "area_key" | "area_title" | "area_subtitle" | "sort_order"
>;

export type MoksilgiMonthlyDetailGoal = Pick<
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
>;

export type GetMyMoksilgiMonthlyResult =
  | {
      ok: true;
      data: {
        plan: PlanRow | null;
        areas: MoksilgiMonthlyArea[];
        detailGoals: MoksilgiMonthlyDetailGoal[];
        records: MoksilgiMonthlyRecord[];
        summary: MoksilgiMonthlySummary | null;
        yearlySummaries: MoksilgiMonthlySummary[];
        year: number;
        month: number;
      };
    }
  | { ok: false; error: SafeError };

export type SaveMyMoksilgiMonthlyRecordResult =
  | { ok: true }
  | { ok: false; error: SafeError };

const AREA_KEYS: MoksilgiAreaKey[] = [
  "spiritual",
  "intellectual",
  "physical",
  "social",
  "other",
];

const RECORD_SELECT =
  "id, plan_id, area_id, detail_goal_id, profile_id, year, month, target_value, actual_value, achievement_rate, daily_checks_json, weekly_counts_json, comment, created_at, updated_at";
const SUMMARY_SELECT =
  "id, plan_id, profile_id, year, month, spiritual_rate, intellectual_rate, physical_rate, social_rate, other_rate, total_rate, average_rate, created_at, updated_at";

type RecordTable = {
  insert: (values: InsertDto<"moksilgi_monthly_records">) => {
    select: (columns: "id") => {
      single: () => Promise<{ data: IdRow | null; error: PostgrestErrorLike | null }>;
    };
  };
  update: (values: UpdateDto<"moksilgi_monthly_records">) => {
    eq: (column: "id", value: string) => {
      eq: (column: "profile_id", value: string) => {
        is: (column: "deleted_at", value: null) => {
          select: (columns: "id") => {
            maybeSingle: () => Promise<{ data: IdRow | null; error: PostgrestErrorLike | null }>;
          };
        };
      };
    };
  };
};

type SummaryTable = {
  insert: (values: InsertDto<"moksilgi_monthly_summaries">) => Promise<{
    data: null;
    error: PostgrestErrorLike | null;
  }>;
  update: (values: UpdateDto<"moksilgi_monthly_summaries">) => {
    eq: (column: "id", value: string) => Promise<{
      data: null;
      error: PostgrestErrorLike | null;
    }>;
  };
};

function recordTable(client: ServiceClient) {
  return client.from("moksilgi_monthly_records") as unknown as RecordTable;
}

function summaryTable(client: ServiceClient) {
  return client.from("moksilgi_monthly_summaries") as unknown as SummaryTable;
}

function safeInt(value: unknown, fallback: number) {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function validateYearMonth(year: number, month: number): SafeError | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { code: "VALIDATION_FAILED", message: "연도가 올바르지 않습니다." };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { code: "VALIDATION_FAILED", message: "월이 올바르지 않습니다." };
  }
  return null;
}

function numberOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function sanitizeDailyChecks(formData: FormData, year: number, month: number) {
  const checks: Record<string, boolean> = {};
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    checks[String(day)] = formData.get(`day_${day}`) === "on";
  }
  return checks;
}

function sanitizeWeeklyCounts(formData: FormData) {
  const counts: Record<string, number> = {};
  for (let week = 1; week <= 5; week += 1) {
    const value = numberOrNull(formData.get(`week${week}`));
    counts[`week${week}`] = value ?? 0;
  }
  return counts;
}

function sumObjectNumbers(values: Record<string, number>) {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

function countTrue(values: Record<string, boolean>) {
  return Object.values(values).filter(Boolean).length;
}

function calculateAchievementRate(actual: number | null, target: number | null) {
  if (!target || target <= 0 || actual === null) return 0;
  return Math.max(0, (actual / target) * 100);
}

function capForSummary(value: number) {
  return Math.min(100, Math.max(0, value));
}

async function getOwnedPlan(client: ServiceClient, profileId: string) {
  return client
    .from("moksilgi_plans")
    .select("id, profile_id, title")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function getPlanData(client: ServiceClient, planId: string) {
  const [areasResult, detailsResult] = await Promise.all([
    client
      .from("moksilgi_goal_areas")
      .select("id, plan_id, area_key, area_title, area_subtitle, sort_order")
      .eq("plan_id", planId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    client
      .from("moksilgi_detail_goals")
      .select("id, plan_id, area_id, title, description, annual_target, monthly_target, unit, measurement_type, strategies_json, sort_order")
      .eq("plan_id", planId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
  ]);
  return { areasResult, detailsResult };
}

export async function getMyMoksilgiMonthly(
  year: number,
  month: number,
  options?: { profileId?: string },
): Promise<GetMyMoksilgiMonthlyResult> {
  const validation = validateYearMonth(year, month);
  if (validation) return { ok: false, error: validation };

  const context = await getMoksilgiContext(
    options?.profileId ? { profileId: options.profileId } : undefined,
  );
  if (!context.ok) return { ok: false, error: context.error };

  const { data: plan, error: planError } = await getOwnedPlan(
    context.serviceClient,
    context.profileId,
  );
  const ownedPlan = plan as PlanRow | null;
  if (planError) {
    return { ok: false, error: { code: "MOKSILGI_QUERY_FAILED", message: "목실기 정보를 불러올 수 없습니다." } };
  }
  if (!ownedPlan) {
    return {
      ok: true,
      data: {
        plan: null,
        areas: [],
        detailGoals: [],
        records: [],
        summary: null,
        yearlySummaries: [],
        year,
        month,
      },
    };
  }

  const [
    { areasResult, detailsResult },
    recordsResult,
    summaryResult,
    yearlySummariesResult,
  ] = await Promise.all([
    getPlanData(context.serviceClient, ownedPlan.id),
    context.serviceClient
      .from("moksilgi_monthly_records")
      .select(RECORD_SELECT)
      .eq("plan_id", ownedPlan.id)
      .eq("profile_id", context.profileId)
      .eq("year", year)
      .eq("month", month)
      .is("deleted_at", null),
    context.serviceClient
      .from("moksilgi_monthly_summaries")
      .select(SUMMARY_SELECT)
      .eq("plan_id", ownedPlan.id)
      .eq("profile_id", context.profileId)
      .eq("year", year)
      .eq("month", month)
      .is("deleted_at", null)
      .maybeSingle(),
    context.serviceClient
      .from("moksilgi_monthly_summaries")
      .select(SUMMARY_SELECT)
      .eq("plan_id", ownedPlan.id)
      .eq("profile_id", context.profileId)
      .eq("year", year)
      .is("deleted_at", null)
      .order("month", { ascending: true }),
  ]);

  if (areasResult.error || detailsResult.error) {
    return { ok: false, error: { code: "MOKSILGI_QUERY_FAILED", message: "목실기 목표를 불러올 수 없습니다." } };
  }

  if (recordsResult.error || summaryResult.error || yearlySummariesResult.error) {
    return { ok: false, error: { code: "MOKSILGI_QUERY_FAILED", message: "월별 기록을 불러올 수 없습니다." } };
  }

  return {
    ok: true,
    data: {
      plan: ownedPlan,
      areas: (areasResult.data ?? []) as MoksilgiMonthlyArea[],
      detailGoals: (detailsResult.data ?? []) as MoksilgiMonthlyDetailGoal[],
      records: (recordsResult.data ?? []) as MoksilgiMonthlyRecord[],
      summary: (summaryResult.data as MoksilgiMonthlySummary | null) ?? null,
      yearlySummaries: (yearlySummariesResult.data ?? []) as MoksilgiMonthlySummary[],
      year,
      month,
    },
  };
}

/**
 * 이미 가져온 context/areas/details를 재사용해서 summary를 업서트합니다.
 * saveMyMoksilgiMonthlyRecord에서 context를 다시 조회하지 않도록 분리된 내부 헬퍼입니다.
 */
async function recalculateSummaryWithContext(
  context: { ok: true; profileId: string; serviceClient: ServiceClient },
  planId: string,
  areas: MoksilgiMonthlyArea[],
  details: MoksilgiMonthlyDetailGoal[],
  year: number,
  month: number,
): Promise<SaveMyMoksilgiMonthlyRecordResult> {
  const [recordsResult, summaryCheckResult] = await Promise.all([
    context.serviceClient
      .from("moksilgi_monthly_records")
      .select("detail_goal_id, achievement_rate")
      .eq("plan_id", planId)
      .eq("profile_id", context.profileId)
      .eq("year", year)
      .eq("month", month)
      .is("deleted_at", null),
    context.serviceClient
      .from("moksilgi_monthly_summaries")
      .select("id")
      .eq("plan_id", planId)
      .eq("profile_id", context.profileId)
      .eq("year", year)
      .eq("month", month)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  const { data: records, error: recordsError } = recordsResult;
  const { data: existing } = summaryCheckResult;
  if (recordsError) {
    return { ok: false, error: { code: "MOKSILGI_QUERY_FAILED", message: "월별 기록을 불러올 수 없습니다." } };
  }

  const recordMap = new Map(
    ((records ?? []) as Array<{ detail_goal_id: string; achievement_rate: number }>).map((record) => [
      record.detail_goal_id,
      capForSummary(record.achievement_rate),
    ]),
  );
  const areaRates = new Map<MoksilgiAreaKey, number>();
  const activeAreaRates: number[] = [];
  for (const area of areas) {
    const areaDetails = details.filter((detail) => detail.area_id === area.id);
    if (areaDetails.length === 0) {
      areaRates.set(area.area_key, 0);
      continue;
    }
    const rate =
      areaDetails.reduce((sum, detail) => sum + (recordMap.get(detail.id) ?? 0), 0) /
      areaDetails.length;
    areaRates.set(area.area_key, rate);
    activeAreaRates.push(rate);
  }

  const values = {
    spiritual_rate: areaRates.get("spiritual") ?? 0,
    intellectual_rate: areaRates.get("intellectual") ?? 0,
    physical_rate: areaRates.get("physical") ?? 0,
    social_rate: areaRates.get("social") ?? 0,
    other_rate: areaRates.get("other") ?? 0,
  };
  const totalRate = AREA_KEYS.reduce((sum, key) => sum + (areaRates.get(key) ?? 0), 0);
  const averageRate =
    activeAreaRates.length > 0
      ? activeAreaRates.reduce((sum, value) => sum + value, 0) / activeAreaRates.length
      : 0;
  const now = new Date().toISOString();
  const existingSummary = existing as IdRow | null;

  if (existingSummary) {
    const { error } = await summaryTable(context.serviceClient)
      .update({ ...values, total_rate: totalRate, average_rate: averageRate, updated_at: now })
      .eq("id", existingSummary.id);
    return error ? { ok: false, error: { code: "SAVE_FAILED", message: "월별 요약을 저장할 수 없습니다." } } : { ok: true };
  }

  const { error } = await summaryTable(context.serviceClient).insert({
    plan_id: planId,
    profile_id: context.profileId,
    year,
    month,
    ...values,
    total_rate: totalRate,
    average_rate: averageRate,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  return error ? { ok: false, error: { code: "SAVE_FAILED", message: "월별 요약을 저장할 수 없습니다." } } : { ok: true };
}

export async function recalculateMyMoksilgiMonthlySummary(
  planId: string,
  year: number,
  month: number,
): Promise<SaveMyMoksilgiMonthlyRecordResult> {
  const context = await getMoksilgiContext();
  if (!context.ok) return { ok: false, error: context.error };

  const { data: plan } = await getOwnedPlan(context.serviceClient, context.profileId);
  const ownedPlan = plan as PlanRow | null;
  if (!ownedPlan || ownedPlan.id !== planId) {
    return { ok: false, error: { code: "NOT_FOUND", message: "목실기 정보를 찾을 수 없습니다." } };
  }

  const { areasResult, detailsResult } = await getPlanData(context.serviceClient, planId);
  if (areasResult.error || detailsResult.error) {
    return { ok: false, error: { code: "MOKSILGI_QUERY_FAILED", message: "목실기 목표를 불러올 수 없습니다." } };
  }

  const areas = (areasResult.data ?? []) as MoksilgiMonthlyArea[];
  const details = (detailsResult.data ?? []) as MoksilgiMonthlyDetailGoal[];

  return recalculateSummaryWithContext(context, planId, areas, details, year, month);
}

// 세부 목표 저장 시 필요한 최소 필드 타입
type SaveDetailGoal = Pick<
  MoksilgiMonthlyDetailGoal,
  "id" | "plan_id" | "area_id" | "measurement_type" | "monthly_target" | "unit"
>;

export async function saveMyMoksilgiMonthlyRecord(
  formData: FormData,
): Promise<SaveMyMoksilgiMonthlyRecordResult> {
  const year = safeInt(formData.get("year"), new Date().getFullYear());
  const month = safeInt(formData.get("month"), new Date().getMonth() + 1);
  const validation = validateYearMonth(year, month);
  if (validation) return { ok: false, error: validation };

  const context = await getMoksilgiContext();
  if (!context.ok) return { ok: false, error: context.error };

  const detailGoalId =
    typeof formData.get("detail_goal_id") === "string"
      ? String(formData.get("detail_goal_id"))
      : "";
  if (detailGoalId.length === 0) {
    return { ok: false, error: { code: "NOT_FOUND", message: "목실기 정보를 찾을 수 없습니다." } };
  }

  // Round 1 (병렬): plan + 세부목표 + 기존 기록 동시 조회.
  // - existingRecord: detail_goal_id + profile_id + year + month로 조회 (plan_id 불필요).
  //   unique index (detail_goal_id, year, month) WHERE deleted_at IS NULL 활용.
  // - detailById: RLS가 사용자 소유 plan으로 접근을 제한.
  // Round 1 결과로 Round 2에서 record upsert + getPlanData를 병렬로 실행 가능.
  const [planResult, detailResult, existingResult] = await Promise.all([
    getOwnedPlan(context.serviceClient, context.profileId),
    context.serviceClient
      .from("moksilgi_detail_goals")
      .select("id, plan_id, area_id, measurement_type, monthly_target, unit")
      .eq("id", detailGoalId)
      .is("deleted_at", null)
      .maybeSingle(),
    context.serviceClient
      .from("moksilgi_monthly_records")
      .select("id")
      .eq("detail_goal_id", detailGoalId)
      .eq("profile_id", context.profileId)
      .eq("year", year)
      .eq("month", month)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  const ownedPlan = planResult.data as PlanRow | null;
  const detail = detailResult.data as SaveDetailGoal | null;
  const existingRecord = existingResult.data as IdRow | null;

  if (!ownedPlan || !detail) {
    return { ok: false, error: { code: "NOT_FOUND", message: "목실기 정보를 찾을 수 없습니다." } };
  }
  // 보안: 세부 목표가 사용자의 plan에 속하는지 확인
  if (detail.plan_id !== ownedPlan.id) {
    return { ok: false, error: { code: "NOT_FOUND", message: "세부 목표를 찾을 수 없습니다." } };
  }

  const targetValue = numberOrNull(formData.get("target_value")) ?? detail.monthly_target;
  let actualValue = numberOrNull(formData.get("actual_value"));
  let dailyChecks: Record<string, boolean> = {};
  let weeklyCounts: Record<string, number> = {};

  if (detail.measurement_type === "daily_check") {
    dailyChecks = sanitizeDailyChecks(formData, year, month);
    actualValue = countTrue(dailyChecks);
  }
  if (detail.measurement_type === "weekly_count") {
    weeklyCounts = sanitizeWeeklyCounts(formData);
    actualValue = sumObjectNumbers(weeklyCounts);
  }

  const fallbackTarget =
    detail.measurement_type === "daily_check" && !targetValue
      ? daysInMonth(year, month)
      : targetValue;
  const achievementRate =
    detail.measurement_type === "monthly_comment" && (!actualValue || !fallbackTarget)
      ? 0
      : calculateAchievementRate(actualValue, fallbackTarget);
  const now = new Date().toISOString();
  const comment = textOrNull(formData.get("comment"), 2000);

  const payload = {
    target_value: fallbackTarget,
    actual_value: actualValue,
    achievement_rate: achievementRate,
    daily_checks_json: dailyChecks as unknown as Json,
    weekly_counts_json: weeklyCounts as unknown as Json,
    comment,
    updated_at: now,
  };

  // Round 2 (병렬): record upsert + getPlanData 동시 실행.
  // Round 1에서 existingRecord를 알고 있으므로 upsert 브랜치를 즉시 결정 가능.
  // getPlanData는 summary 재계산에 필요한 areas/details를 가져오는데,
  // upsert와 독립적이므로 병렬로 실행해 대기 시간을 줄인다.
  const upsertP: Promise<{ data: IdRow | null; error: PostgrestErrorLike | null }> =
    existingRecord !== null
      ? recordTable(context.serviceClient)
          .update(payload)
          .eq("id", existingRecord.id)
          .eq("profile_id", context.profileId)
          .is("deleted_at", null)
          .select("id")
          .maybeSingle()
      : recordTable(context.serviceClient)
          .insert({
            ...payload,
            plan_id: ownedPlan.id,
            area_id: detail.area_id,
            detail_goal_id: detail.id,
            profile_id: context.profileId,
            year,
            month,
            created_at: now,
            deleted_at: null,
          } as InsertDto<"moksilgi_monthly_records">)
          .select("id")
          .single();

  const [upsertResult, { areasResult, detailsResult }] = await Promise.all([
    upsertP,
    getPlanData(context.serviceClient, ownedPlan.id),
  ]);

  if (upsertResult.error || !upsertResult.data) {
    return { ok: false, error: { code: "SAVE_FAILED", message: "월별 기록을 저장할 수 없습니다." } };
  }
  if (areasResult.error || detailsResult.error) {
    return { ok: false, error: { code: "MOKSILGI_QUERY_FAILED", message: "목실기 목표를 불러올 수 없습니다." } };
  }

  const areas = (areasResult.data ?? []) as MoksilgiMonthlyArea[];
  const details = (detailsResult.data ?? []) as MoksilgiMonthlyDetailGoal[];

  // areas/details를 Round 2에서 이미 가져왔으므로 recalculate 시 재조회하지 않습니다.
  return recalculateSummaryWithContext(context, ownedPlan.id, areas, details, year, month);
}
